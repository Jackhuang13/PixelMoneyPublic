import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import type { Transaction } from '@/types';

export const CategoryDetailsPage: React.FC = () => {
  const {
    statsDetailsContext,
    categories,
    transactionsWithDetails,
    setCurrentPage,
    openEditTransactionModal,
  } = useApp();
  const { t, language } = useI18n();

  const categoryName = useMemo(() => {
    if (!statsDetailsContext?.categoryId) return '';
    const cat = categories.find((c) => c.id === statsDetailsContext.categoryId);
    return cat ? (cat.isDefault ? t('categories.uncategorized') : cat.name) : t('categories.uncategorized');
  }, [statsDetailsContext, categories, t]);

  const dateRangeLabel = useMemo(() => {
    if (!statsDetailsContext?.startDate || !statsDetailsContext?.endDate) return '';
    const startDate = new Date(statsDetailsContext.startDate);
    const endDate = new Date(statsDetailsContext.endDate);
    const locale = language === 'zh-TW' ? 'zh-TW' : 'en-US';

    const startStr = startDate.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const endStr = endDate.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
    if (startDate.toDateString() === endDate.toDateString()) {
      return startStr;
    }
    return `${startStr} - ${endStr}`;
  }, [statsDetailsContext, language]);

  const transactions = useMemo(() => {
    if (!statsDetailsContext) return [];
    const { categoryId, startDate, endDate } = statsDetailsContext;
    const start = new Date(startDate);
    const end = new Date(endDate);

    return transactionsWithDetails.filter((tx) => {
      const txDate = new Date(tx.date);
      return tx.categoryId === categoryId && txDate >= start && txDate <= end;
    });
  }, [statsDetailsContext, transactionsWithDetails]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-yellow-400">{categoryName}</h1>
          <p className="text-gray-400 text-sm">{dateRangeLabel}</p>
        </div>
        <button
          onClick={() => setCurrentPage('stats')}
          className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-500"
        >
          {t('common.back')}
        </button>
      </div>

      <div className="space-y-2 max-h-[75vh] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="text-center text-gray-400 py-4">{t('search.noResults')}</div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              onClick={() => openEditTransactionModal(tx as Transaction)}
              className="flex justify-between items-center bg-gray-800 p-2 pixel-border-sm cursor-pointer hover:bg-gray-700 active:translate-y-px active:translate-x-px transition-transform"
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{tx.categoryIcon}</span>
                <div>
                  <p className="font-bold">{tx.categoryName}</p>
                  <p className="text-xs text-gray-400">{tx.notes || '...'}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`font-bold text-lg ${
                    tx.categoryType === 'income' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {tx.amount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">{tx.date}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
