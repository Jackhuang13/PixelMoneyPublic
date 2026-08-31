import Dexie, { type EntityTable } from 'dexie';
import type { Account, Category, Transaction } from '@/types';

/**
 * PixelMoney indexedDB database definition using Dexie.js.
 */
export class PixelMoneyDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;

  constructor() {
    super('PixelMoney');
    this.version(1).stores({
      accounts: '++id, name, balance, active',
      categories: '++id, name, type, active, isDefault, icon',
      transactions: '++id, date, categoryId, accountId, amount, notes, invoiceNumber'
    });
  }
}

export const db = new PixelMoneyDB();
