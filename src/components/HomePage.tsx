import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import { Calculator } from './Calculator';
import type { Transaction } from '@/types';

export const HomePage: React.FC = () => {
  const {
    activeAccounts,
    activeCategories,
    transactionsWithDetails,
    addTransaction,
    deleteTransaction,
    openEditTransactionModal,
    showConfirmationModal,
    setCurrentPage,
    settings,
  } = useApp();

  const { t } = useI18n();

  const [date, setDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');

  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyDate, setHistoryDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  // Initialize category to default '未分類' or first active category
  useEffect(() => {
    if (categoryId === null && activeCategories.length > 0) {
      const defaultCat = activeCategories.find((c) => c.isDefault) || activeCategories[0];
      if (defaultCat?.id) {
        setCategoryId(defaultCat.id);
      }
    }
  }, [activeCategories, categoryId]);

  // Restore last used account
  useEffect(() => {
    if (activeAccounts.length > 0 && accountId === '') {
      const lastUsed = localStorage.getItem('lastUsedAccountId');
      if (lastUsed) {
        const found = activeAccounts.some((a) => a.id === parseInt(lastUsed));
        if (found) {
          setAccountId(parseInt(lastUsed));
          return;
        }
      }
      if (activeAccounts[0]?.id) {
        setAccountId(activeAccounts[0].id);
      }
    }
  }, [activeAccounts, accountId]);

  const handleAccountChange = (val: number) => {
    setAccountId(val);
    localStorage.setItem('lastUsedAccountId', String(val));
  };

  const todayStr = dayjs().format('YYYY-MM-DD');

  const todayTransactions = useMemo(() => {
    return transactionsWithDetails.filter((tx) => tx.date === todayStr);
  }, [transactionsWithDetails, todayStr]);

  const historyTransactions = useMemo(() => {
    return transactionsWithDetails.filter((tx) => tx.date === historyDate);
  }, [transactionsWithDetails, historyDate]);

  const handleSubmit = async () => {
    if (!accountId) {
      showConfirmationModal(
        t('modal.accountRequiredTitle'),
        t('modal.accountRequiredMessage'),
        undefined,
        'alert'
      );
      return;
    }
    if (!amount || amount <= 0) {
      showConfirmationModal(
        t('modal.invalidAmountTitle'),
        t('modal.invalidAmountMessage'),
        undefined,
        'alert'
      );
      return;
    }

    await addTransaction({
      date,
      categoryId,
      accountId: Number(accountId),
      amount,
      notes,
      invoiceNumber,
    });

    setDate(dayjs().format('YYYY-MM-DD'));
    setAmount(null);
    setNotes('');
    setInvoiceNumber('');

    showConfirmationModal(
      t('modal.recordAddedTitle'),
      t('modal.recordAddedMessage'),
      undefined,
      'success'
    );
  };

  const confirmDelete = (id?: number) => {
    if (!id) return;
    showConfirmationModal(
      t('modal.confirmDeleteTitle'),
      t('modal.confirmDeleteMessage'),
      () => deleteTransaction(id)
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-yellow-400">
        {t('home.title')} v1.6.0
      </h1>

      {/* Add Transaction Form */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('home.addTransaction')}</h2>
          <button
            id="scan-invoice-btn"
            onClick={() => setCurrentPage('scanInvoice')}
            className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-blue-500 flex items-center space-x-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 4.5M6.25 4.5H18M18.25 4.5V19.5M3.75 19.5H15.25M15.25 19.5V4.5M6.25 19.5V11.25M12.5 19.5V7.5M18.25 11.25H21.25M3.75 11.25H6.25M12.5 7.5H15.25M12.5 11.25H15.25"
              />
            </svg>
            <span>{t('home.scanInvoice')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="font-bold">{t('home.date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full block bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm appearance-none"
            />
          </div>

          <div className="space-y-2">
            <label className="font-bold">{t('home.category')}</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
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
              value={accountId}
              onChange={(e) => handleAccountChange(Number(e.target.value))}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
            >
              <option disabled value="">
                {t('home.selectAccount')}
              </option>
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
              value={amount === null ? '' : amount}
              onChange={(e) => setAmount(e.target.value === '' ? null : Number(e.target.value))}
              placeholder={t('home.enterAmount')}
              onFocus={() => {
                if (settings.showCalculator) {
                  setShowCalculator(true);
                }
              }}
              readOnly={settings.showCalculator}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="font-bold">{t('home.invoiceNumber')}</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder={t('home.invoiceNumberPlaceholder')}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="font-bold">{t('home.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('home.notesPlaceholder')}
              className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm resize-y overflow-y-auto"
              rows={3}
            />
          </div>
        </div>

        <button
          id="add-transaction-submit-btn"
          onClick={handleSubmit}
          className="w-full px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-green-500 mt-4"
        >
          {t('home.addButton')}
        </button>
      </div>

      {/* Calculator Modal */}
      {showCalculator && (
        <Calculator
          value={amount}
          onConfirm={(val) => setAmount(val)}
          onClose={() => setShowCalculator(false)}
        />
      )}

      {/* Today's Records vs History View */}
      {!showHistory ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{t('home.todayRecords')}</h2>
            <button
              id="view-history-btn"
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 text-sm font-bold transition-transform pixel-border bg-gray-600 active:translate-y-px active:translate-x-px"
            >
              {t('home.history')}
            </button>
          </div>

          {todayTransactions.length === 0 ? (
            <div className="p-4 bg-gray-700 pixel-border text-center">
              <p>{t('home.noRecordsToday')}</p>
            </div>
          ) : (
            todayTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-gray-700 pixel-border flex justify-between items-center"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p
                    className={`font-bold text-lg break-words ${
                      tx.categoryType === 'income' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {tx.categoryName}: {tx.amount.toLocaleString()}
                  </p>
                  {tx.invoiceNumber && (
                    <p className="text-sm text-gray-300 break-words">
                      {t('home.invoice')}: {tx.invoiceNumber}
                    </p>
                  )}
                  {tx.notes && (
                    <p className="text-sm text-gray-300 break-words line-clamp-2">{tx.notes}</p>
                  )}
                  <p className="text-sm text-gray-400">
                    {tx.date}・{tx.accountName}
                  </p>
                </div>
                <div className="flex space-x-2 flex-shrink-0">
                  <button
                    onClick={() => openEditTransactionModal(tx as Transaction)}
                    className="px-3 py-2 text-xs font-bold transition-transform pixel-border-sm bg-blue-500 active:translate-y-px active:translate-x-px"
                  >
                    {t('home.edit')}
                  </button>
                  <button
                    onClick={() => confirmDelete(tx.id)}
                    className="px-3 py-2 text-xs font-bold transition-transform pixel-border-sm bg-red-600 active:translate-y-px active:translate-x-px"
                  >
                    {t('home.delete')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{t('home.history')}</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="px-4 py-2 text-sm font-bold transition-transform pixel-border bg-gray-600 active:translate-y-px active:translate-x-px"
            >
              {t('home.back')}
            </button>
          </div>

          <div className="p-4 bg-gray-700 pixel-border space-y-4">
            <label className="font-bold">{t('home.selectDate')}</label>
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="w-full block bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm appearance-none"
            />
          </div>

          {historyTransactions.length === 0 ? (
            <div className="p-4 bg-gray-700 pixel-border text-center">
              <p>{t('home.noRecordsOnDate')}</p>
            </div>
          ) : (
            historyTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-gray-700 pixel-border flex justify-between items-center"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p
                    className={`font-bold text-lg break-words ${
                      tx.categoryType === 'income' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {tx.categoryName}: {tx.amount.toLocaleString()}
                  </p>
                  {tx.invoiceNumber && (
                    <p className="text-sm text-gray-300 break-words">
                      {t('home.invoice')}: {tx.invoiceNumber}
                    </p>
                  )}
                  {tx.notes && (
                    <p className="text-sm text-gray-300 break-words line-clamp-2">{tx.notes}</p>
                  )}
                  <p className="text-sm text-gray-400">
                    {tx.date}・{tx.accountName}
                  </p>
                </div>
                <div className="flex space-x-2 flex-shrink-0">
                  <button
                    onClick={() => openEditTransactionModal(tx as Transaction)}
                    className="px-3 py-2 text-xs font-bold transition-transform pixel-border-sm bg-blue-500 active:translate-y-px active:translate-x-px"
                  >
                    {t('home.edit')}
                  </button>
                  <button
                    onClick={() => confirmDelete(tx.id)}
                    className="px-3 py-2 text-xs font-bold transition-transform pixel-border-sm bg-red-600 active:translate-y-px active:translate-x-px"
                  >
                    {t('home.delete')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
