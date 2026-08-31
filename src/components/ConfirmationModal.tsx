import React from 'react';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';

export const ConfirmationModal: React.FC = () => {
  const { confirmationModal, closeConfirmationModal, confirmAction } = useApp();
  const { t } = useI18n();

  if (!confirmationModal.show) return null;

  const isAlert = confirmationModal.type === 'alert';
  const isSuccess = confirmationModal.type === 'success';

  return (
    <div
      id="confirmation-modal-backdrop"
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeConfirmationModal();
        }
      }}
    >
      <div className="pixel-border bg-gray-600 p-6 rounded-none max-w-sm w-full">
        <h3 className="text-2xl font-bold mb-4">{confirmationModal.title}</h3>
        <p className="mb-6">{confirmationModal.message}</p>
        <div className="flex justify-end space-x-4">
          {!isAlert && !isSuccess && (
            <button
              id="modal-cancel-btn"
              onClick={closeConfirmationModal}
              className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-400"
            >
              {t('modal.cancel')}
            </button>
          )}
          <button
            id="modal-confirm-btn"
            onClick={confirmAction}
            className={`px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border ${
              isSuccess ? 'bg-green-500' : isAlert ? 'bg-yellow-500' : 'bg-red-500'
            }`}
          >
            {isSuccess || isAlert ? t('accounts.save') || 'OK' : t('modal.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
