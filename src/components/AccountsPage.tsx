import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/i18n';
import type { Account } from '@/types';

export const AccountsPage: React.FC = () => {
  const { accounts, addAccount, updateAccount } = useApp();
  const { t } = useI18n();

  const [name, setName] = useState<string>('');
  const [balance, setBalance] = useState<number | ''>(0);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  const handleSubmit = async () => {
    if (!name.trim() || balance === '') {
      alert(t('alert.enterAccountName'));
      return;
    }
    await addAccount({
      name: name.trim(),
      balance: Number(balance),
      active: true,
    });
    setName('');
    setBalance(0);
  };

  const startEdit = (acc: Account) => {
    if (acc.id) {
      setEditingAccountId(acc.id);
      setEditAmount(acc.balance);
    }
  };

  const cancelEdit = () => {
    setEditingAccountId(null);
  };

  const saveBalance = async (acc: Account) => {
    await updateAccount({ ...acc, balance: editAmount });
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-yellow-400">{t('accounts.title')}</h1>

      {/* Add Account Card */}
      <div className="p-4 bg-gray-700 pixel-border space-y-4">
        <h2 className="text-xl font-bold">{t('accounts.addAccount')}</h2>
        <div>
          <label className="font-bold">{t('accounts.accountName')}</label>
          <input
            id="new-account-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('accounts.accountNamePlaceholder')}
            className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
          />
        </div>
        <div>
          <label className="font-bold">{t('accounts.initialBalance')}</label>
          <input
            id="new-account-balance-input"
            type="number"
            value={balance === '' ? '' : balance}
            onChange={(e) => setBalance(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={t('accounts.initialBalancePlaceholder')}
            className="w-full bg-gray-200 text-black p-2 text-lg placeholder-gray-500 pixel-border-sm"
          />
        </div>
        <button
          id="add-account-btn"
          onClick={handleSubmit}
          className="w-full px-4 py-2 text-lg font-bold transition-transform transform active:translate-y-px active:translate-x-px pixel-border bg-blue-500"
        >
          {t('accounts.addButton')}
        </button>
      </div>

      {/* Account List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t('accounts.accountList')}</h2>
        {accounts.length === 0 ? (
          <div className="p-4 bg-gray-700 pixel-border text-center">
            <p>{t('accounts.noAccounts')}</p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className={`p-3 bg-gray-700 pixel-border ${!acc.active ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-bold">{acc.name}</span>
                <span
                  className={`text-xl font-bold ${
                    acc.balance >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  $ {acc.balance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <label className="text-sm">{t('accounts.enable')}</label>
                  <input
                    type="checkbox"
                    checked={acc.active}
                    onChange={(e) => updateAccount({ ...acc, active: e.target.checked })}
                    className="w-6 h-6"
                  />
                </div>
                {editingAccountId === acc.id ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="bg-gray-200 text-black p-1 text-sm placeholder-gray-500 pixel-border-sm w-32"
                    />
                    <button
                      onClick={() => saveBalance(acc)}
                      className="px-2 py-1 text-xs font-bold transition-transform pixel-border-sm bg-green-500 active:translate-y-px active:translate-x-px"
                    >
                      {t('accounts.save')}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-2 py-1 text-xs font-bold transition-transform pixel-border-sm bg-gray-400 active:translate-y-px active:translate-x-px"
                    >
                      {t('accounts.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(acc)}
                    className="px-2 py-1 text-xs font-bold transition-transform pixel-border-sm bg-yellow-500 active:translate-y-px active:translate-x-px"
                  >
                    {t('accounts.adjustBalance')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
