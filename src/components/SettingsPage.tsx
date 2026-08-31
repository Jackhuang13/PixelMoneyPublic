import React, { useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import { db } from '@/db';
import type { Language, Category, Account, Transaction, FontChoice } from '@/types';

export const SettingsPage: React.FC = () => {
  const { settings, saveSettings, loadData, showConfirmationModal } = useApp();
  const { language, setLanguage, t } = useI18n();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleCalculator = (val: boolean) => {
    saveSettings({ ...settings, showCalculator: val });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  const handleFontChange = (font: FontChoice) => {
    saveSettings({ ...settings, fontFamily: font });
  };

  const exportDatabase = async () => {
    try {
      const accounts = await db.accounts.toArray();
      const categories = await db.categories.toArray();
      const transactions = await db.transactions.toArray();

      const backupData = {
        timestamp: new Date().toISOString(),
        accounts,
        categories,
        transactions,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `pixel_money_backup_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showConfirmationModal(
        t('settings.exportSuccess'),
        t('settings.exportSuccess'),
        undefined,
        'success'
      );
    } catch {
      showConfirmationModal('Error', 'Export failed', undefined, 'alert');
    }
  };

  const importDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backupData = JSON.parse(content);

        let accounts = backupData.accounts;
        let categories = backupData.categories;
        let transactions = backupData.transactions;

        // Support old backup format where data is nested inside backupData.data
        if ((!accounts || !categories || !transactions) && backupData.data) {
          accounts = backupData.data.accounts || accounts;
          categories = backupData.data.categories || categories;
          transactions = backupData.data.transactions || transactions;
        }

        if (!accounts || !categories || !transactions) {
          throw new Error('Invalid structure');
        }

        const sanitizedAccounts = (Array.isArray(accounts) ? accounts : []).map((a: any) => ({
          name: a.name || '未命名',
          balance: Number(a.balance) || 0,
          active: a.active !== undefined ? Boolean(a.active) : true,
          ...(a.id !== undefined ? { id: a.id } : {}),
        }));

        const sanitizedCategories: Category[] = (Array.isArray(categories) ? categories : []).map((c: any) => ({
          name: c.name || '未分類',
          type: (c.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
          active: c.active !== undefined ? Boolean(c.active) : true,
          isDefault: !!c.isDefault,
          icon: c.icon || (c.type === 'income' ? '💰' : '📦'),
          ...(c.id !== undefined ? { id: c.id } : {}),
        }));

        const sanitizedTransactions = (Array.isArray(transactions) ? transactions : []).map((t: any) => ({
          date: t.date || new Date().toISOString().slice(0, 10),
          categoryId: t.categoryId !== undefined && t.categoryId !== null ? Number(t.categoryId) : null,
          accountId: t.accountId !== undefined ? Number(t.accountId) : (sanitizedAccounts[0]?.id || 1),
          amount: Number(t.amount) || 0,
          notes: t.notes || '',
          invoiceNumber: t.invoiceNumber || '',
          ...(t.id !== undefined ? { id: t.id } : {}),
        }));

        await db.transaction('rw', db.accounts, db.categories, db.transactions, async () => {
          await db.accounts.clear();
          await db.categories.clear();
          await db.transactions.clear();

          await db.accounts.bulkAdd(sanitizedAccounts);
          await db.categories.bulkAdd(sanitizedCategories);
          await db.transactions.bulkAdd(sanitizedTransactions);
        });

        await loadData();

        showConfirmationModal(
          t('settings.importSuccess'),
          t('settings.importSuccess'),
          undefined,
          'success'
        );
      } catch {
        showConfirmationModal(
          t('settings.importError'),
          t('settings.importError'),
          undefined,
          'alert'
        );
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-yellow-400">{t('settings.title')}</h1>

      {/* Language Section */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <h2 className="text-xl font-bold">{t('settings.displayLanguage')}</h2>
        <div>
          <select
            id="settings-language-select"
            value={language}
            onChange={handleLanguageChange}
            className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
          >
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {/* Font Settings Section */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <h2 className="text-xl font-bold">{t('settings.fontFamily')}</h2>
        <div>
          <select
            id="settings-font-select"
            value={settings.fontFamily || 'iansui'}
            onChange={(e) => handleFontChange(e.target.value as FontChoice)}
            className="w-full bg-gray-200 text-black p-2 text-lg pixel-border-sm"
          >
            <option value="iansui">{t('font.iansui')}</option>
            <option value="zen-maru">{t('font.zenMaru')}</option>
          </select>
        </div>
      </div>

      {/* Feature Settings Section */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <h2 className="text-xl font-bold">{t('settings.features')}</h2>
        <div className="flex items-center justify-between">
          <span className="font-bold">{t('settings.showCalculator')}</span>
          <input
            id="settings-calculator-toggle"
            type="checkbox"
            checked={settings.showCalculator}
            onChange={(e) => toggleCalculator(e.target.checked)}
            className="w-6 h-6"
          />
        </div>
      </div>

      {/* Data Management Section */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <h2 className="text-xl font-bold">{t('settings.dataManagement')}</h2>
        <div className="space-y-4">
          <button
            id="export-backup-btn"
            onClick={exportDatabase}
            className="w-full px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-blue-500"
          >
            {t('settings.exportDB')}
          </button>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={importDatabase}
              className="hidden"
              id="import-db-file"
            />
            <button
              id="import-backup-btn"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-yellow-500"
            >
              {t('settings.importDB')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
