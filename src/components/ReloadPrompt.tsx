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
      className="fixed bottom-20 sm:bottom-6 left-4 right-4 max-w-lg mx-auto p-4 sm:p-5 bg-gray-900 text-white pixel-border z-50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl"
      role="alert"
    >
      <div className="flex items-center space-x-3 w-full sm:w-auto">
        <span className="text-2xl" role="img" aria-label="sparkles">✨</span>
        <div>
          <h4 className="font-bold text-base sm:text-lg text-yellow-300">
            {language === 'zh-TW' ? '系統有新版本可供更新' : 'New version available'}
          </h4>
          <p className="text-xs sm:text-sm text-gray-300">
            {promptMessage}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
        <button
          id="pwa-update-btn"
          onClick={() => updateServiceWorker(true)}
          className="flex-1 sm:flex-initial px-5 py-2.5 text-sm sm:text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-green-500 hover:bg-green-400 text-black text-center cursor-pointer"
        >
          {t('pwa.reload') || '立即更新'}
        </button>
        <button
          id="pwa-close-btn"
          onClick={close}
          className="px-4 py-2.5 text-sm sm:text-base font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer"
        >
          {t('pwa.close') || '稍後'}
        </button>
      </div>
    </div>
  );
};
