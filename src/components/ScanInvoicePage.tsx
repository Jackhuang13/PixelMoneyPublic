import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import {
  InvoiceItem,
  ParsedLeftQR,
  ParsedRightQR,
  RawQRResult,
  decodeTaiwanInvoiceQR,
  parseLeftInvoiceQR,
  parseRightInvoiceQR,
} from '@/utils/invoiceDecoder';

export const ScanInvoicePage: React.FC = () => {
  const { categories, accounts, addTransaction, showConfirmationModal, setCurrentPage } = useApp();
  const { t } = useI18n();

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isProcessingRef = useRef<boolean>(false);
  const isFinalizingRef = useRef<boolean>(false);
  const lastProcessedInvoiceRef = useRef<string | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const leftScannedRef = useRef<ParsedLeftQR | null>(null);
  const rightScannedRef = useRef<ParsedRightQR | null>(null);
  const knownEncodingRef = useRef<'big5' | 'utf-8' | undefined>(undefined);

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

  const finalizeTransaction = async (left: ParsedLeftQR, right: ParsedRightQR | null) => {
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;

    try {
      const allItems: InvoiceItem[] = [...left.items, ...(right ? right.items : [])];
      const itemDescriptions = allItems.map((item) => `${item.name} x ${item.qty} @ ${item.price}`);

      const notes =
        t('scanInvoice.items') +
        ': ' +
        (itemDescriptions.length > 0 ? itemDescriptions.join(', ') : t('scanInvoice.noItems'));

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
        const parsedRight = parseRightInvoiceQR(
          code.data,
          code.binaryData,
          knownEncodingRef.current
        );
        if (parsedRight && (!currentRight || currentRight.raw !== parsedRight.raw)) {
          currentRight = parsedRight;
          newRightDetected = true;
        }
      } else if (code.data.length >= 77) {
        const parsedLeft = parseLeftInvoiceQR(code.data, code.binaryData);
        if (parsedLeft && (!currentLeft || currentLeft.invoiceNumber !== parsedLeft.invoiceNumber)) {
          if (lastProcessedInvoiceRef.current === parsedLeft.invoiceNumber) {
            continue;
          }
          currentLeft = parsedLeft;
          newLeftDetected = true;

          if (parsedLeft.encodingType === 'big5') {
            knownEncodingRef.current = 'big5';
          } else if (parsedLeft.encodingType === 'utf-8') {
            knownEncodingRef.current = 'utf-8';
          }
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

    // Case 2: Left QR code scanned and already has all expected items
    if (currentLeft && !currentRight) {
      if (
        (currentLeft.expectedTotalItems !== null &&
          currentLeft.items.length >= currentLeft.expectedTotalItems) ||
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPhoto(true);
    setErrorMessage('');
    setToastMessage({
      text: t('scanInvoice.analyzingPhoto'),
      type: 'info',
    });

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = objectUrl;
      });

      const offscreenCanvas = document.createElement('canvas');
      const maxDim = 2000;
      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;
      if (targetWidth > maxDim || targetHeight > maxDim) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
          targetWidth = maxDim;
        } else {
          targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
          targetHeight = maxDim;
        }
      }
      offscreenCanvas.width = targetWidth;
      offscreenCanvas.height = targetHeight;
      const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Cannot get canvas context');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      URL.revokeObjectURL(objectUrl);

      const foundCodes: RawQRResult[] = [];
      const seenDataSet = new Set<string>();

      // 1. Try Native BarcodeDetector if available with bounding box extraction
      if (barcodeDetectorRef.current) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(offscreenCanvas);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const barcode of barcodes) {
            if (barcode.boundingBox) {
              const pad = 12;
              const bx = Math.max(0, Math.floor(barcode.boundingBox.x - pad));
              const by = Math.max(0, Math.floor(barcode.boundingBox.y - pad));
              const bw = Math.min(
                offscreenCanvas.width - bx,
                Math.floor(barcode.boundingBox.width + pad * 2)
              );
              const bh = Math.min(
                offscreenCanvas.height - by,
                Math.floor(barcode.boundingBox.height + pad * 2)
              );
              if (bw > 20 && bh > 20) {
                const patchData = ctx.getImageData(bx, by, bw, bh);
                const patchRes = jsQR(patchData.data, bw, bh, { inversionAttempts: 'attemptBoth' });
                if (patchRes && (patchRes.binaryData?.length || patchRes.data)) {
                  const decoded = decodeTaiwanInvoiceQR(
                    patchRes.data,
                    patchRes.binaryData,
                    knownEncodingRef.current
                  );
                  if (decoded && !seenDataSet.has(decoded)) {
                    seenDataSet.add(decoded);
                    foundCodes.push({ data: decoded, binaryData: patchRes.binaryData });
                  }
                }
              }
            }
            if (barcode.rawValue && !barcode.rawValue.includes('\ufffd')) {
              const decoded = decodeTaiwanInvoiceQR(
                barcode.rawValue,
                undefined,
                knownEncodingRef.current
              );
              if (decoded && !seenDataSet.has(decoded)) {
                seenDataSet.add(decoded);
                foundCodes.push({ data: decoded });
              }
            }
          }
        } catch {
          // fallback to jsQR
        }
      }

      // 2. Spatial scans with jsQR
      if (foundCodes.length < 2) {
        const w = offscreenCanvas.width;
        const h = offscreenCanvas.height;

        // Scan full image
        const fullImgData = ctx.getImageData(0, 0, w, h);
        const fullRes = jsQR(fullImgData.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (fullRes && (fullRes.binaryData?.length || fullRes.data)) {
          const decoded = decodeTaiwanInvoiceQR(
            fullRes.data,
            fullRes.binaryData,
            knownEncodingRef.current
          );
          if (decoded && !seenDataSet.has(decoded)) {
            seenDataSet.add(decoded);
            foundCodes.push({ data: decoded, binaryData: fullRes.binaryData });
          }
        }

        // Scan Left Half (0% to 58%)
        const leftW = Math.floor(w * 0.58);
        const leftImgData = ctx.getImageData(0, 0, leftW, h);
        const leftRes = jsQR(leftImgData.data, leftW, h, { inversionAttempts: 'attemptBoth' });
        if (leftRes && (leftRes.binaryData?.length || leftRes.data)) {
          const decoded = decodeTaiwanInvoiceQR(
            leftRes.data,
            leftRes.binaryData,
            knownEncodingRef.current
          );
          if (decoded && !seenDataSet.has(decoded)) {
            seenDataSet.add(decoded);
            foundCodes.push({ data: decoded, binaryData: leftRes.binaryData });
          }
        }

        // Scan Right Half (42% to 100%)
        const rightStartX = Math.floor(w * 0.42);
        const rightW = w - rightStartX;
        const rightImgData = ctx.getImageData(rightStartX, 0, rightW, h);
        const rightRes = jsQR(rightImgData.data, rightW, h, { inversionAttempts: 'attemptBoth' });
        if (rightRes && (rightRes.binaryData?.length || rightRes.data)) {
          const decoded = decodeTaiwanInvoiceQR(
            rightRes.data,
            rightRes.binaryData,
            knownEncodingRef.current
          );
          if (decoded && !seenDataSet.has(decoded)) {
            seenDataSet.add(decoded);
            foundCodes.push({ data: decoded, binaryData: rightRes.binaryData });
          }
        }
      }

      if (foundCodes.length > 0) {
        await handleDetectedCodes(foundCodes);
      } else {
        setToastMessage({
          text: t('scanInvoice.noQrFoundInPhoto'),
          type: 'warning',
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Error processing photo');
    } finally {
      setIsAnalyzingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

        // 1. Try Native BarcodeDetector if available with high-speed bounding-box patch decoding
        if (barcodeDetectorRef.current) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const barcodes = await barcodeDetectorRef.current.detect(video);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const barcode of barcodes) {
              if (barcode.boundingBox) {
                const pad = 12;
                const bx = Math.max(0, Math.floor(barcode.boundingBox.x - pad));
                const by = Math.max(0, Math.floor(barcode.boundingBox.y - pad));
                const bw = Math.min(canvas.width - bx, Math.floor(barcode.boundingBox.width + pad * 2));
                const bh = Math.min(canvas.height - by, Math.floor(barcode.boundingBox.height + pad * 2));
                if (bw > 20 && bh > 20) {
                  const patchImgData = ctx.getImageData(bx, by, bw, bh);
                  const patchRes = jsQR(patchImgData.data, bw, bh, {
                    inversionAttempts: 'dontInvert',
                  });
                  if (patchRes && (patchRes.binaryData?.length || patchRes.data)) {
                    const decoded = decodeTaiwanInvoiceQR(
                      patchRes.data,
                      patchRes.binaryData,
                      knownEncodingRef.current
                    );
                    if (decoded && !seenDataSet.has(decoded)) {
                      seenDataSet.add(decoded);
                      foundCodes.push({ data: decoded, binaryData: patchRes.binaryData });
                    }
                  }
                }
              }

              // Fallback for barcode.rawValue only if it does not contain replacement character \ufffd
              if (barcode.rawValue && !barcode.rawValue.includes('\ufffd')) {
                const decoded = decodeTaiwanInvoiceQR(
                  barcode.rawValue,
                  undefined,
                  knownEncodingRef.current
                );
                if (decoded && !seenDataSet.has(decoded)) {
                  seenDataSet.add(decoded);
                  foundCodes.push({ data: decoded });
                }
              }
            }
          } catch {
            // fallback to jsQR
          }
        }

        // 2. Spatial scans using jsQR for full robustness
        if (foundCodes.length < 2) {
          const w = canvas.width;
          const h = canvas.height;

          // Region A: Left Half (0% to 58%)
          const leftW = Math.floor(w * 0.58);
          const leftImgData = ctx.getImageData(0, 0, leftW, h);
          const leftResult = jsQR(leftImgData.data, leftW, h, { inversionAttempts: 'dontInvert' });
          if (leftResult && (leftResult.binaryData?.length || leftResult.data)) {
            const decoded = decodeTaiwanInvoiceQR(
              leftResult.data,
              leftResult.binaryData,
              knownEncodingRef.current
            );
            if (decoded && !seenDataSet.has(decoded)) {
              seenDataSet.add(decoded);
              foundCodes.push({
                data: decoded,
                binaryData: leftResult.binaryData,
              });
            }
          }

          // Region B: Right Half (42% to 100%)
          const rightStartX = Math.floor(w * 0.42);
          const rightW = w - rightStartX;
          const rightImgData = ctx.getImageData(rightStartX, 0, rightW, h);
          const rightResult = jsQR(rightImgData.data, rightW, h, {
            inversionAttempts: 'dontInvert',
          });
          if (rightResult && (rightResult.binaryData?.length || rightResult.data)) {
            const decoded = decodeTaiwanInvoiceQR(
              rightResult.data,
              rightResult.binaryData,
              knownEncodingRef.current
            );
            if (decoded && !seenDataSet.has(decoded)) {
              seenDataSet.add(decoded);
              foundCodes.push({
                data: decoded,
                binaryData: rightResult.binaryData,
              });
            }
          }

          // Region C: Full Frame (if still none detected)
          if (foundCodes.length === 0) {
            const fullImgData = ctx.getImageData(0, 0, w, h);
            const fullResult = jsQR(fullImgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (fullResult && (fullResult.binaryData?.length || fullResult.data)) {
              const decoded = decodeTaiwanInvoiceQR(
                fullResult.data,
                fullResult.binaryData,
                knownEncodingRef.current
              );
              if (decoded && !seenDataSet.has(decoded)) {
                seenDataSet.add(decoded);
                foundCodes.push({
                  data: decoded,
                  binaryData: fullResult.binaryData,
                });
              }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-3xl font-bold text-yellow-400">{t('scanInvoice.title')}</h1>
        <span className="text-xs px-2.5 py-1 bg-gray-800 text-yellow-300 pixel-border self-start sm:self-auto">
          {t('scanInvoice.encodingSupport')}
        </span>
      </div>

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
                    leftScanned
                      ? 'border-green-400 bg-green-950/30'
                      : 'border-yellow-400/70 bg-black/20'
                  }`}
                >
                  <span className="text-xs font-bold px-2 py-0.5 bg-black/60 rounded text-yellow-300">
                    {t('scanInvoice.leftCodeStatus')}
                  </span>
                  <span className="text-xs mt-1 font-semibold text-white">
                    {leftScanned
                      ? `✓ ${leftScanned.invoiceNumber}${
                          leftScanned.items.length > 0
                            ? ` (${leftScanned.items.length} ${t('scanInvoice.itemCount')})`
                            : ''
                        }`
                      : t('scanInvoice.statusWaiting')}
                  </span>
                </div>

                {/* Right QR Target Box */}
                <div
                  className={`flex-1 border-2 border-dashed rounded flex flex-col items-center justify-center p-2 transition-colors ${
                    rightScanned
                      ? 'border-green-400 bg-green-950/30'
                      : 'border-yellow-400/70 bg-black/20'
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

        {/* Action Controls: Photo Upload & Return */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          <button
            type="button"
            disabled={isAnalyzingPhoto}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 px-4 py-2.5 text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-yellow-500 hover:bg-yellow-400 text-gray-900 cursor-pointer flex items-center justify-center gap-2 shadow"
          >
            {isAnalyzingPhoto ? (
              <span>⏳ {t('scanInvoice.analyzingPhoto')}</span>
            ) : (
              <span>📷 {t('scanInvoice.uploadPhoto')}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('home')}
            className="flex-1 px-4 py-2.5 text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-600 hover:bg-gray-500 text-white cursor-pointer"
          >
            {t('scanInvoice.backButton')}
          </button>
        </div>
      </div>
    </div>
  );
};
