import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import type { Transaction } from '@/types';

export const EditTransactionModal: React.FC = () => {
  const {
    editModalTransaction,
    closeEditTransactionModal,
    saveEditedTransaction,
    activeCategories,
    activeAccounts,
  } = useApp();
  const { t } = useI18n();

  const [form, setForm] = useState<Transaction | null>(null);

  useEffect(() => {
    if (editModalTransaction) {
      setForm({ ...editModalTransaction });
    } else {
      setForm(null);
    }
  }, [editModalTransaction]);

  if (!form) return null;

  const handleSave = () => {
    if (form) {
      saveEditedTransaction(form);
    }
  };

  return (
    <div
      id="edit-transaction-modal-backdrop"
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeEditTransactionModal();
        }
      }}
    >
      <div className="pixel-border bg-gray-600 rounded-none max-w-sm w-full flex flex-col max-h-full">
        {/* Modal Header */}
        <h3 className="text-2xl font-bold p-6 pb-4 flex-shrink-0">{t('home.editTransaction')}</h3>

        {/* Scrollable Content */}
        <div className="p-6 pt-0 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <label className="font-bold">{t('home.date')}</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm appearance-none"
            />
          </div>
          <div className="space-y-2">
            <label className="font-bold">{t('home.category')}</label>
            <select
              value={form.categoryId ?? ''}
              onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
            >
              {activeCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.isDefault ? t('categories.uncategorized') : cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="font-bold">{t('home.account')}</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: Number(e.target.value) })}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
            >
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="font-bold">{t('home.amount')}</label>
            <input
              type="number"
              value={form.amount === 0 ? '' : form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="font-bold">{t('home.invoiceNumber')}</label>
            <input
              type="text"
              value={form.invoiceNumber || ''}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              placeholder={t('home.invoiceNumberPlaceholder')}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="font-bold">{t('home.notes')}</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('home.notesPlaceholder')}
              rows={3}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm resize-y overflow-y-auto"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end space-x-4 p-6 pt-4 flex-shrink-0">
          <button
            id="edit-modal-cancel-btn"
            onClick={closeEditTransactionModal}
            className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-400"
          >
            {t('modal.cancel')}
          </button>
          <button
            id="edit-modal-save-btn"
            onClick={handleSave}
            className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-green-500"
          >
            {t('accounts.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
