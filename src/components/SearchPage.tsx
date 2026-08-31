import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import type { Transaction } from '@/types';

export const SearchPage: React.FC = () => {
  const { transactionsWithDetails, setCurrentPage, openEditTransactionModal } = useApp();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState<string>('');

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.trim().toLowerCase();
    return transactionsWithDetails
      .filter((tx) => {
        const amountStr = tx.amount.toString();
        const categoryName = tx.categoryName ? tx.categoryName.toLowerCase() : '';
        const notes = tx.notes ? tx.notes.toLowerCase() : '';
        const invoice = tx.invoiceNumber ? tx.invoiceNumber.toLowerCase() : '';
        const date = tx.date ? tx.date.toLowerCase() : '';

        return (
          amountStr.includes(query) ||
          categoryName.includes(query) ||
          notes.includes(query) ||
          invoice.includes(query) ||
          date.includes(query)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [searchQuery, transactionsWithDetails]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-yellow-400">{t('search.title')}</h1>
        <button
          onClick={() => setCurrentPage('stats')}
          className="px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-gray-500"
        >
          {t('common.back')}
        </button>
      </div>

      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <input
          id="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="text"
          placeholder={t('search.placeholder')}
          className="w-full bg-gray-800 text-white p-3 text-lg placeholder-gray-500 pixel-border-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          autoFocus
        />
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {searchQuery && searchResults.length === 0 ? (
          <div className="text-center text-gray-400 py-4">{t('search.noResults')}</div>
        ) : !searchQuery ? (
          <div className="text-center text-gray-400 py-4">{t('search.startTyping')}</div>
        ) : (
          searchResults.map((tx) => (
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
                  {(tx.categoryType === 'expense' ? '-' : '+') + tx.amount.toLocaleString()}
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
