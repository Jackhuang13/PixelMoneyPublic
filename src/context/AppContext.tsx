import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { db } from '@/db';
import type {
  Account,
  Category,
  Transaction,
  TransactionWithDetails,
  AppSettings,
  ConfirmationModalState,
  StatsDetailsContext,
  PageType,
} from '@/types';
import { useI18n } from '@/i18n';

interface AppContextType {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  activeAccounts: Account[];
  activeCategories: Category[];
  transactionsWithDetails: TransactionWithDetails[];
  settings: AppSettings;
  saveSettings: (newSettings: AppSettings) => void;
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  statsDetailsContext: StatsDetailsContext | null;
  setStatsDetailsContext: (ctx: StatsDetailsContext | null) => void;
  confirmationModal: ConfirmationModalState;
  showConfirmationModal: (
    title: string,
    message: string,
    onConfirm?: () => void,
    type?: 'confirm' | 'alert' | 'success'
  ) => void;
  closeConfirmationModal: () => void;
  confirmAction: () => void;
  editModalTransaction: Transaction | null;
  openEditTransactionModal: (tx: Transaction) => void;
  closeEditTransactionModal: () => void;
  saveEditedTransaction: (tx: Transaction) => Promise<void>;
  loadData: () => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (transactionId: number) => Promise<void>;
  updateTransaction: (updatedTx: Transaction) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [statsDetailsContext, setStatsDetailsContext] = useState<StatsDetailsContext | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pixel-money-settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback default
      }
    }
    return { showCalculator: true };
  });

  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    show: false,
    title: '',
    message: '',
    onConfirm: undefined,
    type: 'confirm',
  });

  const [editModalTransaction, setEditModalTransaction] = useState<Transaction | null>(null);

  /**
   * Loads accounts, categories, and transactions from IndexedDB, seeding default data if empty.
   */
  const loadData = async () => {
    const accs = await db.accounts.toArray();
    const cats = await db.categories.toArray();
    const txs = await db.transactions.toArray();

    let updatedCats = [...cats];
    let updatedAccs = [...accs];

    // Ensure default '未分類' category exists
    const uncategorizedExists = cats.some((c) => c.isDefault);
    if (!uncategorizedExists) {
      const defaultCatId = await db.categories.add({
        name: '未分類',
        type: 'expense',
        active: true,
        isDefault: true,
        icon: '📦',
      });
      updatedCats.push({
        id: Number(defaultCatId),
        name: '未分類',
        type: 'expense',
        active: true,
        isDefault: true,
        icon: '📦',
      });
    }

    // Seed starter data if entirely empty
    if (accs.length === 0 && cats.length <= 1) {
      const cashId = await db.accounts.add({ name: '現金', balance: 0, active: true });
      const bankId = await db.accounts.add({ name: '銀行', balance: 0, active: true });
      const c1Id = await db.categories.add({ name: '餐飲', type: 'expense', active: true, icon: '🍔' });
      const c2Id = await db.categories.add({ name: '交通', type: 'expense', active: true, icon: '🚗' });
      const c3Id = await db.categories.add({ name: '薪水', type: 'income', active: true, icon: '💰' });

      updatedAccs = [
        { id: Number(cashId), name: '現金', balance: 0, active: true },
        { id: Number(bankId), name: '銀行', balance: 0, active: true },
      ];
      updatedCats = [
        ...updatedCats,
        { id: Number(c1Id), name: '餐飲', type: 'expense', active: true, icon: '🍔' },
        { id: Number(c2Id), name: '交通', type: 'expense', active: true, icon: '🚗' },
        { id: Number(c3Id), name: '薪水', type: 'income', active: true, icon: '💰' },
      ];
    }

    setAccounts(updatedAccs);
    setCategories(updatedCats);
    setTransactions(txs);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.active), [accounts]);
  const activeCategories = useMemo(() => categories.filter((c) => c.active), [categories]);

  const transactionsWithDetails = useMemo<TransactionWithDetails[]>(() => {
    return transactions
      .map((tItem) => {
        const category = categories.find((c) => c.id === tItem.categoryId);
        const account = accounts.find((a) => a.id === tItem.accountId);
        return {
          ...tItem,
          categoryName: category?.isDefault ? t('categories.uncategorized') : (category?.name || t('categories.uncategorized')),
          categoryIcon: category?.icon || '🍔',
          categoryType: category?.type || 'expense',
          accountName: account?.name || '',
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, categories, accounts, t]);

  const addAccount = async (account: Account) => {
    await db.accounts.add(account);
    await loadData();
  };

  const updateAccount = async (account: Account) => {
    if (account.id) {
      await db.accounts.update(account.id, { balance: account.balance, active: account.active });
      await loadData();
    }
  };

  const addCategory = async (category: Category) => {
    await db.categories.add(category);
    await loadData();
  };

  const updateCategory = async (category: Category) => {
    if (category.id) {
      await db.categories.update(category.id, {
        name: category.name,
        type: category.type,
        active: category.active,
        icon: category.icon,
      });
      await loadData();
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const account = accounts.find((a) => a.id === transaction.accountId);
    const category = categories.find((c) => c.id === transaction.categoryId);
    if (!account || !category || !account.id) return;

    const newBalance =
      category.type === 'income'
        ? account.balance + transaction.amount
        : account.balance - transaction.amount;
    await db.accounts.update(account.id, { balance: newBalance });

    await db.transactions.add({
      date: transaction.date,
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
      amount: transaction.amount,
      notes: transaction.notes || '',
      invoiceNumber: transaction.invoiceNumber || '',
    });
    await loadData();
  };

  const deleteTransaction = async (transactionId: number) => {
    const txToDelete = await db.transactions.get(transactionId);
    if (!txToDelete) return;

    const account = await db.accounts.get(txToDelete.accountId);
    const category = await db.categories.get(txToDelete.categoryId ?? -1);
    if (account && category && account.id) {
      const restoredBalance =
        category.type === 'income'
          ? account.balance - txToDelete.amount
          : account.balance + txToDelete.amount;
      await db.accounts.update(account.id, { balance: restoredBalance });
    }

    await db.transactions.delete(transactionId);
    await loadData();
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    if (!updatedTx.id) return;
    const originalTx = await db.transactions.get(updatedTx.id);
    if (!originalTx) return;

    await db.transaction('rw', db.accounts, db.transactions, db.categories, async () => {
      const originalAccount = await db.accounts.get(originalTx.accountId);
      const originalCategory = await db.categories.get(originalTx.categoryId ?? -1);

      // Revert balance of original account
      if (originalAccount && originalCategory && originalAccount.id) {
        const isSameAccount = originalTx.accountId === updatedTx.accountId;
        const balanceToRevertFrom = isSameAccount
          ? originalAccount.balance
          : (await db.accounts.get(originalAccount.id))?.balance ?? originalAccount.balance;

        const revertedBalance =
          originalCategory.type === 'income'
            ? balanceToRevertFrom - originalTx.amount
            : balanceToRevertFrom + originalTx.amount;
        await db.accounts.update(originalAccount.id, { balance: revertedBalance });
      }

      // Apply new balance to new/current account
      const newAccount = await db.accounts.get(updatedTx.accountId);
      const newCategory = await db.categories.get(updatedTx.categoryId ?? -1);
      if (newAccount && newCategory && newAccount.id) {
        const currentBalance = (await db.accounts.get(newAccount.id))?.balance ?? newAccount.balance;
        const finalBalance =
          newCategory.type === 'income'
            ? currentBalance + updatedTx.amount
            : currentBalance - updatedTx.amount;
        await db.accounts.update(newAccount.id, { balance: finalBalance });
      }

      // Update transaction record
      await db.transactions.update(updatedTx.id!, {
        date: updatedTx.date,
        categoryId: updatedTx.categoryId,
        accountId: updatedTx.accountId,
        amount: updatedTx.amount,
        notes: updatedTx.notes || '',
        invoiceNumber: updatedTx.invoiceNumber || '',
      });
    });

    await loadData();
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('pixel-money-settings', JSON.stringify(newSettings));
  };

  const showConfirmationModal = (
    title: string,
    message: string,
    onConfirm?: () => void,
    type: 'confirm' | 'alert' | 'success' = 'confirm'
  ) => {
    setConfirmationModal({
      show: true,
      title,
      message,
      onConfirm,
      type,
    });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal((prev) => ({ ...prev, show: false }));
  };

  const confirmAction = () => {
    if (confirmationModal.onConfirm) {
      confirmationModal.onConfirm();
    }
    closeConfirmationModal();
  };

  const openEditTransactionModal = (tx: Transaction) => {
    setEditModalTransaction({
      ...tx,
      invoiceNumber: tx.invoiceNumber || '',
      notes: tx.notes || '',
    });
  };

  const closeEditTransactionModal = () => {
    setEditModalTransaction(null);
  };

  const saveEditedTransaction = async (tx: Transaction) => {
    await updateTransaction(tx);
    closeEditTransactionModal();
  };

  return (
    <AppContext.Provider
      value={{
        accounts,
        categories,
        transactions,
        activeAccounts,
        activeCategories,
        transactionsWithDetails,
        settings,
        saveSettings,
        currentPage,
        setCurrentPage,
        statsDetailsContext,
        setStatsDetailsContext,
        confirmationModal,
        showConfirmationModal,
        closeConfirmationModal,
        confirmAction,
        editModalTransaction,
        openEditTransactionModal,
        closeEditTransactionModal,
        saveEditedTransaction,
        loadData,
        addAccount,
        updateAccount,
        addCategory,
        updateCategory,
        addTransaction,
        deleteTransaction,
        updateTransaction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
