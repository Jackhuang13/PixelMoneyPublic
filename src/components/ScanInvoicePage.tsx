import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';

export const ScanInvoicePage: React.FC = () => {
  const { categories, accounts, addTransaction, showConfirmationModal, setCurrentPage } = useApp();
  const { t } = useI18n();

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastProcessedInvoiceRef = useRef<string | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const convertTaiwanDateToISO = (taiwanDate: string): string => {
    const year = parseInt(taiwanDate.substring(0, 3), 10) + 1911;
    const month = taiwanDate.substring(3, 5);
    const day = taiwanDate.substring(5, 7);
    return `${year}-${month}-${day}`;
  };

  const processInvoiceCode = async (rawValue: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setErrorMessage('');

    try {
      let fullRawString = rawValue;
      if (fullRawString.startsWith('**')) {
        // Right QR only, waiting for left QR
        isProcessingRef.current = false;
        return;
      }

      const fixedInfoLength = 77;
      if (fullRawString.length < fixedInfoLength) {
        throw new Error(t('scanInvoice.invalidMainInfo'));
      }

      const invoiceNumber = fullRawString.substring(0, 10);
      if (lastProcessedInvoiceRef.current === invoiceNumber) {
        isProcessingRef.current = false;
        return;
      }

      const dateTaiwan = fullRawString.substring(10, 17);
      const totalAmountHex = fullRawString.substring(29, 37);

      const totalAmount = parseInt(totalAmountHex, 16);
      const date = convertTaiwanDateToISO(dateTaiwan);

      let variableData = fullRawString.substring(fixedInfoLength);
      if (variableData.startsWith(':')) {
        variableData = variableData.substring(1);
      }

      let parts = variableData.split(':');
      let encodingParam = '1';
      if (parts.length >= 4) {
        encodingParam = parts[3];
      }

      if (encodingParam === '0') {
        try {
          const rawBytes = new Uint8Array(fullRawString.length);
          for (let i = 0; i < fullRawString.length; i++) {
            const code = fullRawString.charCodeAt(i);
            if (code >= 0xff61 && code <= 0xff9f) {
              rawBytes[i] = code - 0xfec0;
            } else {
              rawBytes[i] = code & 0xff;
            }
          }
          const decoder = new TextDecoder('big5');
          fullRawString = decoder.decode(rawBytes);

          variableData = fullRawString.substring(fixedInfoLength);
          if (variableData.startsWith(':')) {
            variableData = variableData.substring(1);
          }
          parts = variableData.split(':');
        } catch {
          // Fallback if big5 decoder fails
        }
      }

      const itemDescriptions: string[] = [];
      if (parts.length >= 5) {
        const itemParts = parts.slice(4).filter((p) => p.trim() !== '');
        for (let i = 0; i < itemParts.length; i += 3) {
          const name = itemParts[i];
          const qty = itemParts[i + 1];
          const price = itemParts[i + 2];
          if (name && qty !== undefined && price !== undefined) {
            itemDescriptions.push(`${name.trim()} x ${qty} @ ${price}`);
          }
        }
      }

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
        date,
        categoryId: defaultCategory.id,
        accountId: defaultAccount.id,
        amount: isNaN(totalAmount) ? 0 : totalAmount,
        notes,
        invoiceNumber,
      });

      lastProcessedInvoiceRef.current = invoiceNumber;

      showConfirmationModal(
        t('modal.recordAddedTitle'),
        t('modal.recordAddedMessage'),
        () => {
          setCurrentPage('home');
        },
        'success'
      );
    } catch (error: unknown) {
      const err = error as Error;
      setErrorMessage(t('scanInvoice.parseError') + `: ${err.message}`);
    } finally {
      isProcessingRef.current = false;
    }
  };

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
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

    const scanFrame = () => {
      if (!active || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          processInvoiceCode(code.data);
        }
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

        <button
          onClick={() => setCurrentPage('home')}
          className="w-full px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-600 mt-4"
        >
          {t('scanInvoice.backButton')}
        </button>
      </div>
    </div>
  );
};
