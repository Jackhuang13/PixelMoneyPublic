/**
 * Account interface representing a financial account (e.g. Cash, Bank, Credit Card).
 */
export interface Account {
  id?: number;
  name: string;
  balance: number;
  active: boolean;
}

/**
 * Category interface for transaction classification.
 */
export interface Category {
  id?: number;
  name: string;
  type: 'expense' | 'income';
  active: boolean;
  isDefault?: boolean;
  icon?: string;
}

/**
 * Transaction record stored in Dexie database.
 */
export interface Transaction {
  id?: number;
  date: string;
  categoryId: number | null;
  accountId: number;
  amount: number;
  notes: string;
  invoiceNumber?: string;
}

/**
 * Transaction combined with category and account details for presentation.
 */
export interface TransactionWithDetails extends Transaction {
  categoryName: string;
  categoryIcon: string;
  categoryType?: 'expense' | 'income';
  accountName?: string;
}

export type FontChoice = 'iansui' | 'zen-maru';

/**
 * Application preference settings.
 */
export interface AppSettings {
  showCalculator: boolean;
  fontFamily?: FontChoice;
}

/**
 * Confirmation & Alert modal state.
 */
export interface ConfirmationModalState {
  show: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  type?: 'confirm' | 'alert' | 'success';
}

/**
 * Context data passed to the Category Details drilldown view.
 */
export interface StatsDetailsContext {
  categoryId: number;
  startDate: string;
  endDate: string;
  type: 'expense' | 'income';
}

/**
 * Filter and view state preserved across statistics drilldowns.
 */
export interface StatsFilterState {
  timeRange: 'weekly' | 'monthly';
  displayType: 'expense' | 'income';
  currentDateIso: string;
  selectedDateStr: string | null;
}

/**
 * Available application page navigation routes.
 */
export type PageType =
  | 'home'
  | 'accounts'
  | 'categories'
  | 'stats'
  | 'settings'
  | 'scanInvoice'
  | 'search'
  | 'categoryDetails';

/**
 * Supported internationalization languages.
 */
export type Language = 'zh-TW' | 'en';
