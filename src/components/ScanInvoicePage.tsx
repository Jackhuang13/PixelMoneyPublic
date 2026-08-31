import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';

interface InvoiceItem {
  name: string;
  qty: string;
  price: string;
}

interface ParsedLeftQR {
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  expectedTotalItems: number | null;
  items: InvoiceItem[];
  sellerId: string;
  buyerId: string;
  raw: string;
}

interface ParsedRightQR {
  items: InvoiceItem[];
  raw: string;
}

interface RawQRResult {
  data: string;
  binaryData?: number[];
}

export const ScanInvoicePage: React.FC = () => {
  const { categories, accounts, addTransaction, showConfirmationModal, setCurrentPage } = useApp();
  const { t } = useI18n();

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<boolean>(false);

  // Status for Left and Right QR Codes
  const [leftScanned, setLeftScanned] = useState<ParsedLeftQR | null>(null);
  const [rightScanned, setRightScanned] = useState<ParsedRightQR | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'info' | 'warning' | 'success';
    showDirectSave?: boolean;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const isFinalizingRef = useRef<boolean>(false);
  const lastProcessedInvoiceRef = useRef<string | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const leftScannedRef = useRef<ParsedLeftQR | null>(null);
  const rightScannedRef = useRef<ParsedRightQR | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barcodeDetectorRef = useRef<any>(null);

  useEffect(() => {
    leftScannedRef.current = leftScanned;
  }, [leftScanned]);

  useEffect(() => {
    rightScannedRef.current = rightScanned;
  }, [rightScanned]);

  // Initialize native BarcodeDetector if supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  const convertTaiwanDateToISO = (taiwanDate: string): string => {
    const year = parseInt(taiwanDate.substring(0, 3), 10) + 1911;
    const month = taiwanDate.substring(3, 5);
    const day = taiwanDate.substring(5, 7);
    return `${year}-${month}-${day}`;
  };

  const isNumeric = (str: string | undefined): boolean => {
    if (!str || typeof str !== 'string') return false;
    return /^-?\d+(\.\d+)?$/.test(str.trim());
  };

  const cleanItemName = (rawName: string): string => {
    if (!rawName) return '';
    const trimmed = rawName.trim();
    // Remove leading index digits if format is "1品名" or "01品名" where it's followed by non-digits
    const stripped = trimmed.replace(/^(\d{1,2})([^\d\s].*)$/, '$2');
    return (stripped.trim() || trimmed).replace(/^:+/, '');
  };

  const decodeRawInvoiceString = (rawStr: string, binaryData?: number[], forceBig5 = false): string => {
    if (binaryData && binaryData.length > 0) {
      try {
        const bytes = new Uint8Array(binaryData);
        if (forceBig5) {
          try {
            return new TextDecoder('big5').decode(bytes);
          } catch {
            // fallback
          }
        }
        // Try UTF-8 first
        try {
          return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          // Not clean UTF-8 -> decode Big5
          try {
            return new TextDecoder('big5').decode(bytes);
          } catch {
            return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
          }
        }
      } catch {
        // fallback
      }
    }

    try {
      const rawBytes = new Uint8Array(rawStr.length);
      let hasHighByte = false;
      for (let i = 0; i < rawStr.length; i++) {
        const code = rawStr.charCodeAt(i);
        if (code >= 0xff61 && code <= 0xff9f) {
          rawBytes[i] = code - 0xfec0;
          hasHighByte = true;
        } else {
          rawBytes[i] = code & 0xff;
          if ((code & 0xff) > 127) hasHighByte = true;
        }
      }
      if (hasHighByte || forceBig5) {
        try {
          const decoded = new TextDecoder('big5').decode(rawBytes);
          if (!decoded.includes('\ufffd')) {
            return decoded;
          }
        } catch {
          // fallback
        }
      }
    } catch {
      // fallback
    }

    return rawStr;
  };

  const parseLeftQR = (qr: RawQRResult): ParsedLeftQR | null => {
    const raw = qr.data;
    if (raw.startsWith('**') || raw.length < 77) {
      return null;
    }

    const invoiceNumber = raw.substring(0, 10);
    const dateTaiwan = raw.substring(10, 17);
    const totalAmountHex = raw.substring(29, 37);
    const buyerId = raw.substring(37, 45);
    const sellerId = raw.substring(45, 53);

    const totalAmount = parseInt(totalAmountHex, 16);
    const date = convertTaiwanDateToISO(dateTaiwan);

    const fixedInfoLength = 77;
    let variableData = raw.substring(fixedInfoLength);
    if (variableData.startsWith(':')) {
      variableData = variableData.substring(1);
    }

    // Determine if encoding specifies Big-5 (0 = Big-5, 1 = UTF-8, 2 = Base64)
    const initialParts = variableData.split(':');
    const isBig5 = initialParts[2] === '0' || initialParts[3] === '0' || variableData.includes(':0:');

    const decodedFull = decodeRawInvoiceString(raw, qr.binaryData, isBig5);
    let decodedVariable = decodedFull.substring(fixedInfoLength);
    if (decodedVariable.startsWith(':')) {
      decodedVariable = decodedVariable.substring(1);
    }

    const parts = decodedVariable.split(':').map((p) => p.trim());

    let expectedTotalItems: number | null = null;
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
      expectedTotalItems = parseInt(parts[1], 10);
    }

    // Find starting index of item triples (name, qty, price)
    let startIdx = -1;
    for (let i = 1; i < parts.length - 2; i++) {
      const candidateName = parts[i];
      const candidateQty = parts[i + 1];
      const candidatePrice = parts[i + 2];
      if (!isNumeric(candidateQty) || !isNumeric(candidatePrice)) {
        continue;
      }
      // If candidateName is a single or 2-digit number and we're at header positions (index 1, 2, 3), skip header flags
      if (/^\d{1,2}$/.test(candidateName) && i <= 3) {
        continue;
      }
      startIdx = i;
      break;
    }

    if (startIdx === -1) {
      if (parts.length >= 7 && (parts.length - 4) % 3 === 0 && isNumeric(parts[5]) && isNumeric(parts[6])) {
        startIdx = 4;
      } else if (parts.length >= 6 && (parts.length - 3) % 3 === 0 && isNumeric(parts[4]) && isNumeric(parts[5])) {
        startIdx = 3;
      } else if (parts.length >= 5 && (parts.length - 2) % 3 === 0 && isNumeric(parts[3]) && isNumeric(parts[4])) {
        startIdx = 2;
      }
    }

    const items: InvoiceItem[] = [];
    if (startIdx !== -1) {
      for (let i = startIdx; i + 2 < parts.length; i += 3) {
        const rawName = parts[i];
        const qty = parts[i + 1];
        const price = parts[i + 2];
        if (rawName && isNumeric(qty) && isNumeric(price)) {
          items.push({
            name: cleanItemName(rawName),
            qty,
            price,
          });
        }
      }
    }

    return {
      invoiceNumber,
      date,
      totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
      expectedTotalItems,
      items,
      sellerId,
      buyerId,
      raw,
    };
  };

  const parseRightQR = (qr: RawQRResult): ParsedRightQR | null => {
    const raw = qr.data;
    if (!raw.startsWith('**')) {
      return null;
    }

    const decoded = decodeRawInvoiceString(raw, qr.binaryData, true);
    let content = decoded.replace(/^\*\*+/, '');
    if (content.startsWith(':')) {
      content = content.substring(1);
    }

    const parts = content.split(':').map((p) => p.trim()).filter((p) => p.length > 0);
    let startIdx = 0;
    if (parts.length >= 4 && /^\d{1,2}$/.test(parts[0]) && !isNumeric(parts[1]) && isNumeric(parts[2]) && isNumeric(parts[3])) {
      startIdx = 1;
    }

    const items: InvoiceItem[] = [];
    for (let i = startIdx; i + 2 < parts.length; i += 3) {
      const rawName = parts[i];
      const qty = parts[i + 1];
      const price = parts[i + 2];
      if (rawName && isNumeric(qty) && isNumeric(price)) {
        items.push({
          name: cleanItemName(rawName),
          qty,
          price,
        });
      }
    }

    return {
      items,
      raw,
    };
  };

  const finalizeTransaction = async (left: ParsedLeftQR, right: ParsedRightQR | null) => {
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;

    try {
      const allItems: InvoiceItem[] = [...left.items, ...(right ? right.items : [])];
      const itemDescriptions = allItems.map((item) => `${item.name} x ${item.qty} @ ${item.price}`);

      const notes =
        t('scanInvoice.items') +
        ': ' +
        (itemDescriptions.length > 0
          ? itemDescriptions.join(', ')
          : t('scanInvoice.noItems'));

      const defaultCategory =
        categories.find((cat) => cat.isDefault && cat.type === 'expense') ||
        categories.find((cat) => cat.type === 'expense') ||
        categories[0];

      const defaultAccount =
        accounts.find((acc) => acc.name === '現金') ||
        accounts.find((acc) => acc.active) ||
        accounts[0];

      if (!defaultCategory?.id) {
        throw new Error(t('scanInvoice.noDefaultCategory'));
      }
      if (!defaultAccount?.id) {
        throw new Error(t('scanInvoice.noDefaultAccount'));
      }

      await addTransaction({
        date: left.date,
        categoryId: defaultCategory.id,
        accountId: defaultAccount.id,
        amount: isNaN(left.totalAmount) ? 0 : left.totalAmount,
        notes,
        invoiceNumber: left.invoiceNumber,
      });

      lastProcessedInvoiceRef.current = left.invoiceNumber;
      setToastMessage({
        text: t('scanInvoice.toastPairSuccess'),
        type: 'success',
      });

      setTimeout(() => {
        showConfirmationModal(
          t('modal.recordAddedTitle'),
          t('modal.recordAddedMessage'),
          () => {
            setCurrentPage('home');
          },
          'success'
        );
      }, 500);
    } catch (error: unknown) {
      const err = error as Error;
      setErrorMessage(t('scanInvoice.parseError') + `: ${err.message}`);
      isFinalizingRef.current = false;
    }
  };

  const handleDetectedCodes = async (detectedCodes: RawQRResult[]) => {
    if (isFinalizingRef.current) return;

    let currentLeft: ParsedLeftQR | null = leftScannedRef.current;
    let currentRight: ParsedRightQR | null = rightScannedRef.current;
    let newLeftDetected = false;
    let newRightDetected = false;

    for (const code of detectedCodes) {
      if (code.data.startsWith('**')) {
        const parsedRight = parseRightQR(code);
        if (parsedRight && (!currentRight || currentRight.raw !== parsedRight.raw)) {
          currentRight = parsedRight;
          newRightDetected = true;
        }
      } else if (code.data.length >= 77) {
        const parsedLeft = parseLeftQR(code);
        if (parsedLeft && (!currentLeft || currentLeft.invoiceNumber !== parsedLeft.invoiceNumber)) {
          if (lastProcessedInvoiceRef.current === parsedLeft.invoiceNumber) {
            continue;
          }
          currentLeft = parsedLeft;
          newLeftDetected = true;
        }
      }
    }

    if (newLeftDetected) {
      setLeftScanned(currentLeft);
    }
    if (newRightDetected) {
      setRightScanned(currentRight);
    }

    // Case 1: Both QR codes scanned -> Finalize immediately with all items!
    if (currentLeft && currentRight) {
      finalizeTransaction(currentLeft, currentRight);
      return;
    }

    // Case 2: Left QR code scanned and already has items (or full items)
    if (currentLeft && !currentRight) {
      // If expectedTotalItems is known and we already have all items, or if Left QR has items and expectedTotalItems is 1
      if (
        (currentLeft.expectedTotalItems !== null && currentLeft.items.length >= currentLeft.expectedTotalItems) ||
        (currentLeft.items.length > 0 && currentLeft.expectedTotalItems === null)
      ) {
        finalizeTransaction(currentLeft, null);
        return;
      }

      // Left QR has 0 items or fewer items than expected -> prompt user with Toast
      setToastMessage({
        text: t('scanInvoice.toastHoldStraightLeft'),
        type: 'warning',
        showDirectSave: true,
      });
      return;
    }

    // Case 3: Only Right QR code scanned -> prompt user to scan Left QR
    if (!currentLeft && currentRight) {
      setToastMessage({
        text: t('scanInvoice.toastHoldStraightRight'),
        type: 'info',
      });
      return;
    }
  };

  const handleDirectSave = () => {
    if (leftScannedRef.current && !isFinalizingRef.current) {
      finalizeTransaction(leftScannedRef.current, null);
    }
  };

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setCameraReady(true);
          setCameraError(false);
          scanFrame();
        }
      } catch (err: unknown) {
        if (!active) return;
        setCameraReady(false);
        setCameraError(true);
        const error = err as Error;
        if (error.name === 'NotAllowedError') {
          setErrorMessage(t('scanInvoice.cameraPermissionDenied'));
        } else if (error.name === 'NotFoundError') {
          setErrorMessage(t('scanInvoice.noCameraFound'));
        } else if (error.name === 'NotReadableError') {
          setErrorMessage(t('scanInvoice.cameraInUse'));
        } else {
          setErrorMessage(t('scanInvoice.genericCameraError') + `: ${error.message}`);
        }
      }
    };

    const scanFrame = async () => {
      if (!active || !videoRef.current || !canvasRef.current || isFinalizingRef.current) {
        if (active && !isFinalizingRef.current) {
          animationFrameIdRef.current = requestAnimationFrame(scanFrame);
        }
        return;
      }

      if (isProcessingRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        isProcessingRef.current = true;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const foundCodes: RawQRResult[] = [];
        const seenDataSet = new Set<string>();

        // 1. Try Native BarcodeDetector if available
        if (barcodeDetectorRef.current) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const barcodes = await barcodeDetectorRef.current.detect(video);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const barcode of barcodes) {
              if (barcode.rawValue && !seenDataSet.has(barcode.rawValue)) {
                seenDataSet.add(barcode.rawValue);
                foundCodes.push({ data: barcode.rawValue });
              }
            }
          } catch {
            // fallback to jsQR
          }
        }

        // 2. If fewer than 2 codes found, scan spatial regions using jsQR
        if (foundCodes.length < 2) {
          const w = canvas.width;
          const h = canvas.height;

          // Region A: Left Half (0% to 58%)
          const leftW = Math.floor(w * 0.58);
          const leftImgData = ctx.getImageData(0, 0, leftW, h);
          const leftResult = jsQR(leftImgData.data, leftW, h, { inversionAttempts: 'dontInvert' });
          if (leftResult && leftResult.data && !seenDataSet.has(leftResult.data)) {
            seenDataSet.add(leftResult.data);
            foundCodes.push({
              data: leftResult.data,
              binaryData: leftResult.binaryData,
            });
          }

          // Region B: Right Half (42% to 100%)
          const rightStartX = Math.floor(w * 0.42);
          const rightW = w - rightStartX;
          const rightImgData = ctx.getImageData(rightStartX, 0, rightW, h);
          const rightResult = jsQR(rightImgData.data, rightW, h, { inversionAttempts: 'dontInvert' });
          if (rightResult && rightResult.data && !seenDataSet.has(rightResult.data)) {
            seenDataSet.add(rightResult.data);
            foundCodes.push({
              data: rightResult.data,
              binaryData: rightResult.binaryData,
            });
          }

          // Region C: Full Frame (if still none)
          if (foundCodes.length === 0) {
            const fullImgData = ctx.getImageData(0, 0, w, h);
            const fullResult = jsQR(fullImgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (fullResult && fullResult.data && !seenDataSet.has(fullResult.data)) {
              seenDataSet.add(fullResult.data);
              foundCodes.push({
                data: fullResult.data,
                binaryData: fullResult.binaryData,
              });
            }
          }
        }

        if (foundCodes.length > 0) {
          await handleDetectedCodes(foundCodes);
        }

        isProcessingRef.current = false;
      }

      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    startCamera();

    return () => {
      active = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-yellow-400">{t('scanInvoice.title')}</h1>

      <div className="p-4 bg-gray-700 pixel-border space-y-4 text-center">
        <p className="text-lg font-bold">{t('scanInvoice.instruction')}</p>
        {errorMessage && <p className="text-red-500 font-bold">{errorMessage}</p>}

        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden pixel-border">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Dual QR Scanning Guide Lines */}
          {cameraReady && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-4">
              <div className="w-full max-w-md flex justify-between gap-4 h-3/5">
                {/* Left QR Target Box */}
                <div
                  className={`flex-1 border-2 border-dashed rounded flex flex-col items-center justify-center p-2 transition-colors ${
                    leftScanned ? 'border-green-400 bg-green-950/30' : 'border-yellow-400/70 bg-black/20'
                  }`}
                >
                  <span className="text-xs font-bold px-2 py-0.5 bg-black/60 rounded text-yellow-300">
                    {t('scanInvoice.leftCodeStatus')}
                  </span>
                  <span className="text-xs mt-1 font-semibold text-white">
                    {leftScanned
                      ? `✓ ${leftScanned.invoiceNumber}${leftScanned.items.length > 0 ? ` (${leftScanned.items.length} ${t('scanInvoice.itemCount')})` : ''}`
                      : t('scanInvoice.statusWaiting')}
                  </span>
                </div>

                {/* Right QR Target Box */}
                <div
                  className={`flex-1 border-2 border-dashed rounded flex flex-col items-center justify-center p-2 transition-colors ${
                    rightScanned ? 'border-green-400 bg-green-950/30' : 'border-yellow-400/70 bg-black/20'
                  }`}
                >
                  <span className="text-xs font-bold px-2 py-0.5 bg-black/60 rounded text-yellow-300">
                    {t('scanInvoice.rightCodeStatus')}
                  </span>
                  <span className="text-xs mt-1 font-semibold text-white">
                    {rightScanned
                      ? `✓ ${rightScanned.items.length} ${t('scanInvoice.itemCount')}`
                      : t('scanInvoice.statusWaiting')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center">
              <p className="text-white text-xl">{t('scanInvoice.loadingCamera')}</p>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex flex-col items-center justify-center p-4">
              <p className="text-red-400 text-xl font-bold mb-2">{t('scanInvoice.cameraError')}</p>
              <p className="text-gray-300 text-sm">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Floating Non-Modal Toast Notification for Dual QR Alignment */}
        {toastMessage && (
          <div
            className={`p-3 pixel-border flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-bold shadow-lg transition-all duration-300 ${
              toastMessage.type === 'success'
                ? 'bg-green-800 border-green-400 text-green-100'
                : toastMessage.type === 'warning'
                ? 'bg-amber-800 border-yellow-400 text-yellow-100 animate-pulse'
                : 'bg-blue-800 border-blue-400 text-blue-100'
            }`}
          >
            <div className="flex items-center gap-2 text-left">
              <span className="text-xl">
                {toastMessage.type === 'success' ? '✨' : '📐'}
              </span>
              <span>{toastMessage.text}</span>
            </div>

            {toastMessage.showDirectSave && leftScanned && (
              <button
                type="button"
                onClick={handleDirectSave}
                className="whitespace-nowrap px-3 py-1 text-xs sm:text-sm bg-yellow-400 hover:bg-yellow-300 text-black font-bold pixel-border cursor-pointer transition-transform active:translate-y-px active:translate-x-px"
              >
                {t('scanInvoice.saveWithoutDetails')}
              </button>
            )}
          </div>
        )}

        {/* Real-time scan indicators */}
        <div className="flex justify-between items-center bg-gray-800 p-2.5 pixel-border text-xs sm:text-sm font-bold text-gray-300">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                leftScanned ? 'bg-green-400 animate-ping' : 'bg-gray-500'
              }`}
            />
            <span>
              {t('scanInvoice.leftCodeStatus')}:{' '}
              {leftScanned ? (
                <span className="text-green-400 font-bold">
                  {leftScanned.invoiceNumber} (${leftScanned.totalAmount})
                  {leftScanned.items.length > 0 ? ` [${leftScanned.items.length}項]` : ''}
                </span>
              ) : (
                <span className="text-gray-400">{t('scanInvoice.statusWaiting')}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                rightScanned ? 'bg-green-400 animate-ping' : 'bg-gray-500'
              }`}
            />
            <span>
              {t('scanInvoice.rightCodeStatus')}:{' '}
              {rightScanned ? (
                <span className="text-green-400 font-bold">
                  {rightScanned.items.length} {t('scanInvoice.itemCount')}
                </span>
              ) : (
                <span className="text-gray-400">{t('scanInvoice.statusWaiting')}</span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={() => setCurrentPage('home')}
          className="w-full px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-600 mt-4 cursor-pointer hover:bg-gray-500"
        >
          {t('scanInvoice.backButton')}
        </button>
      </div>
    </div>
  );
};
