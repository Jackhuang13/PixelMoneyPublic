import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useI18n } from '@/i18n';

/**
 * ReloadPrompt component displaying a pixel-styled notification when a new PWA service worker is ready.
 */
export const ReloadPrompt: React.FC = () => {
  const { t, language } = useI18n();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Periodic check for SW updates every hour
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  const versionString = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.6.0';
  const promptMessage =
    language === 'zh-TW'
      ? `發現新版本 v${versionString}，是否立即更新？`
      : `New version v${versionString} available, update now?`;

  return (
    <div
      id="pwa-reload-prompt"
      className="fixed right-4 bottom-20 sm:bottom-4 p-4 bg-gray-800 text-white pixel-border z-50 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 shadow-2xl max-w-sm"
      role="alert"
    >
      <div className="flex-grow">
        <span className="font-bold text-sm sm:text-base text-yellow-300">
          {promptMessage}
        </span>
      </div>
      <div className="flex space-x-2 w-full sm:w-auto justify-end">
        <button
          id="pwa-update-btn"
          onClick={() => updateServiceWorker(true)}
          className="px-4 py-2 text-sm sm:text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-green-500 hover:bg-green-400"
        >
          {t('pwa.reload') || '更新'}
        </button>
        <button
          id="pwa-close-btn"
          onClick={close}
          className="px-4 py-2 text-sm sm:text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-500 hover:bg-gray-400"
        >
          {t('pwa.close') || '關閉'}
        </button>
      </div>
    </div>
  );
};
