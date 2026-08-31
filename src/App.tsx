import React from 'react';
import { I18nProvider } from '@/i18n';
import { AppProvider, useApp } from '@/context/AppContext';
import { Navbar } from '@/components/Navbar';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { ReloadPrompt } from '@/components/ReloadPrompt';

import { HomePage } from '@/components/HomePage';
import { AccountsPage } from '@/components/AccountsPage';
import { CategoriesPage } from '@/components/CategoriesPage';
import { StatsPage } from '@/components/StatsPage';
import { SettingsPage } from '@/components/SettingsPage';
import { ScanInvoicePage } from '@/components/ScanInvoicePage';
import { SearchPage } from '@/components/SearchPage';
import { CategoryDetailsPage } from '@/components/CategoryDetailsPage';

const AppContent: React.FC = () => {
  const { currentPage } = useApp();

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'accounts':
        return <AccountsPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'stats':
        return <StatsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'scanInvoice':
        return <ScanInvoicePage />;
      case 'search':
        return <SearchPage />;
      case 'categoryDetails':
        return <CategoryDetailsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div
      id="app-root-container"
      className="w-full h-full flex justify-center bg-gray-900 overflow-hidden font-sans select-none"
    >
      <div className="w-full max-w-md h-full flex flex-col justify-between bg-gray-800 text-white shadow-2xl relative">
        <main
          id="main-content"
          className="flex-1 p-4 overflow-y-auto overflow-x-hidden space-y-4"
        >
          {renderPage()}
        </main>
        <Navbar />
        <ConfirmationModal />
        <EditTransactionModal />
        <ReloadPrompt />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </I18nProvider>
  );
};

export default App;
