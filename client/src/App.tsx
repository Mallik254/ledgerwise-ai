import React, { useState, useEffect } from 'react';
import { THEMES } from './lib/themes';
import { ThemeId, Transaction, Account } from './types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_TRANSACTIONS,
  calculateAccountBalances,
  calculateSafeToSpend
} from './lib/doubleEntryEngine';
import { Header } from './components/Header';
import { SafeToSpendCard } from './components/SafeToSpendCard';
import { TransactionList } from './components/TransactionList';
import { AccountsOverview } from './components/AccountsOverview';
import { ReconciliationAuditView } from './components/ReconciliationAuditView';
import { VisionCaptureModal } from './components/VisionCaptureModal';
import { SmsAiImporterModal } from './components/SmsAiImporterModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('ledgerwise_theme');
    return (saved as ThemeId) || 'forest_ivory';
  });

  // API Key state
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('ledgerwise_gemini_key') || '';
  });

  // Ledger state
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('ledgerwise_accounts');
    if (!saved) return INITIAL_ACCOUNTS;\n    const stored: Account[] = JSON.parse(saved);\n    // Add newly supported asset accounts without disturbing existing user accounts or balances.\n    return INITIAL_ACCOUNTS.filter(account => account.id === 'acc_ziidi' && !stored.some(existing => existing.id === account.id)).concat(stored);
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('ledgerwise_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [currentTab, setCurrentTab] = useState('overview');

  // Modal states
  const [isVisionOpen, setIsVisionOpen] = useState(false);
  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('ledgerwise_theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    localStorage.setItem('ledgerwise_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('ledgerwise_transactions', JSON.stringify(transactions));
  }, [transactions]);

  const activeTheme = THEMES[currentTheme];

  // Dynamic balance calculations
  const dynamicAccounts = calculateAccountBalances(accounts, transactions);
  const { safeToSpendCents, totalLiquidCents, fulizaDebtCents, reserveCents } = calculateSafeToSpend(dynamicAccounts);

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
  };

  const handleImportBatch = (newTxs: Transaction[]) => {
    setTransactions(prev => [...newTxs, ...prev]);
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm('Delete this transaction? Double-entry balances will adjust automatically.')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('ledgerwise_gemini_key', key);
  };

  const handleAutoReconcileGap = (gapAmount: number, date: string) => {
    const absGap = Math.abs(gapAmount);
    const isCredit = gapAmount > 0;

    const newTx: Transaction = {
      id: `reconcile_gap_${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      time: '12:00 PM',
      receipt: 'AUDIT-GAP',
      description: isCredit ? 'Chain Reconciliation: Unrecorded Deposit' : 'Chain Reconciliation: Unrecorded Cash/Expense',
      counterparty: 'Auditor Balancing Adjustment',
      amountCents: absGap,
      feeCents: 0,
      verified: true,
      source: 'import',
      entries: isCredit
        ? [
            { accountId: 'acc_mpesa', debitCents: absGap, creditCents: 0 },
            { accountId: 'cat_income', debitCents: 0, creditCents: absGap }
          ]
        : [
            { accountId: 'cat_misc', debitCents: absGap, creditCents: 0 },
            { accountId: 'acc_mpesa', debitCents: 0, creditCents: absGap }
          ]
    };

    setTransactions(prev => [newTx, ...prev]);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      accounts,
      transactions,
      exportedAt: new Date().toISOString()
    }, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `ledgerwise_backup_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const handleResetSampleData = () => {
    if (window.confirm('Reset ledger to sample transactions and accounts?')) {
      setAccounts(INITIAL_ACCOUNTS);
      setTransactions(INITIAL_TRANSACTIONS);
    }
  };

  return (
    <div className={`min-h-screen ${activeTheme.classes.bgApp} ${activeTheme.classes.textMain} transition-colors duration-200`}>
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentTheme={currentTheme}
        setCurrentTheme={setCurrentTheme}
        theme={activeTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenVision={() => setIsVisionOpen(true)}
        onOpenSms={() => setIsSmsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Safe-To-Spend CFO Intelligence Bar (Always visible on Overview & Transactions) */}
        {(currentTab === 'overview' || currentTab === 'transactions') && (
          <SafeToSpendCard
            safeToSpendCents={safeToSpendCents}
            totalLiquidCents={totalLiquidCents}
            fulizaDebtCents={fulizaDebtCents}
            reserveCents={reserveCents}
            theme={activeTheme}
            onOpenVision={() => setIsVisionOpen(true)}
            onOpenSms={() => setIsSmsOpen(true)}
          />
        )}

        {/* Tab 1: Overview */}
        {currentTab === 'overview' && (
          <div className="space-y-6">
            <AccountsOverview accounts={dynamicAccounts} theme={activeTheme} />
            <ReconciliationAuditView
              transactions={transactions}
              theme={activeTheme}
              onAutoReconcileGap={handleAutoReconcileGap}
            />
            <TransactionList
              transactions={transactions}
              accounts={dynamicAccounts}
              theme={activeTheme}
              onOpenVision={() => setIsVisionOpen(true)}
              onOpenSms={() => setIsSmsOpen(true)}
              onOpenManual={() => setIsManualOpen(true)}
              onDeleteTransaction={handleDeleteTransaction}
            />
          </div>
        )}

        {/* Tab 2: Journal & Entries */}
        {currentTab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            accounts={dynamicAccounts}
            theme={activeTheme}
            onOpenVision={() => setIsVisionOpen(true)}
            onOpenSms={() => setIsSmsOpen(true)}
            onOpenManual={() => setIsManualOpen(true)}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {/* Tab 3: Chain Auditor */}
        {currentTab === 'reconciliation' && (
          <div className="space-y-6">
            <ReconciliationAuditView
              transactions={transactions}
              theme={activeTheme}
              onAutoReconcileGap={handleAutoReconcileGap}
            />
          </div>
        )}

        {/* Tab 4: Accounts & Liabilities */}
        {currentTab === 'accounts' && (
          <AccountsOverview accounts={dynamicAccounts} theme={activeTheme} />
        )}

      </main>

      {/* Modals */}
      <VisionCaptureModal
        isOpen={isVisionOpen}
        onClose={() => setIsVisionOpen(false)}
        onAddTransaction={handleAddTransaction}
        theme={activeTheme}
        apiKey={apiKey}
      />

      <SmsAiImporterModal
        isOpen={isSmsOpen}
        onClose={() => setIsSmsOpen(false)}
        onImportTransactions={handleImportBatch}
        theme={activeTheme}
        apiKey={apiKey}
      />

      <ManualEntryModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        accounts={dynamicAccounts}
        onAddTransaction={handleAddTransaction}
        theme={activeTheme}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={activeTheme}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        onExportJson={handleExportJson}
        onResetSampleData={handleResetSampleData}
      />
    </div>
  );
};
export default App;
