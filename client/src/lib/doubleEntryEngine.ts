import { Account, Transaction, LedgerEntry } from '../types';

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'acc_mpesa', name: 'M-Pesa', type: 'mobile', nature: 'asset', balanceCents: 2450000, institution: 'Safaricom', spendable: true, color: '#10b981' },
  { id: 'acc_bank', name: 'KCB Bank Current', type: 'bank', nature: 'asset', balanceCents: 6500000, institution: 'KCB Bank', spendable: true, color: '#3b82f6' },
  { id: 'acc_cash', name: 'Cash Wallet', type: 'cash', nature: 'asset', balanceCents: 350000, spendable: true, color: '#f59e0b' },
  { id: 'acc_mshwari', name: 'M-Shwari Lock Savings', type: 'savings', nature: 'asset', balanceCents: 4500000, institution: 'NCBA', spendable: false, color: '#8b5cf6' },
  { id: 'acc_ziidi', name: 'Ziidi Money Market Fund', type: 'savings', nature: 'asset', balanceCents: 0, institution: 'Safaricom Ziidi', spendable: false, color: '#0d9488' },
  { id: 'acc_fuliza', name: 'Fuliza Overdraft', type: 'overdraft', nature: 'liability', balanceCents: 0, institution: 'Safaricom', spendable: false, color: '#ef4444' },

  // Expenses
  { id: 'cat_groceries', name: 'Groceries & Market', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_eating', name: 'Dining & Cafes', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_transport', name: 'Transport & Fuel', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_bills', name: 'Utilities & Rent', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_airtime', name: 'Airtime & Internet', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_household', name: 'Household Supplies', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_fees', name: 'M-Pesa & Bank Fees', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_family', name: 'Family Support', type: 'expense', nature: 'expense', balanceCents: 0 },
  { id: 'cat_misc', name: 'General Expenses', type: 'expense', nature: 'expense', balanceCents: 0 },

  // Income & Equity
  { id: 'cat_income', name: 'Professional Income', type: 'income', nature: 'income', balanceCents: 0 },
  { id: 'eq_opening', name: 'Opening Net Worth', type: 'equity', nature: 'equity', balanceCents: 0 }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_demo_1',
    date: '2026-11-17',
    time: '10:15 AM',
    receipt: 'TA1289XC44',
    description: 'Weekly Groceries at Naivas',
    counterparty: 'Naivas Supermarket',
    amountCents: 345000,
    feeCents: 2300,
    balanceCents: 2450000,
    verified: true,
    source: 'sms_ai',
    entries: [
      { accountId: 'cat_groceries', debitCents: 345000, creditCents: 0 },
      { accountId: 'cat_fees', debitCents: 2300, creditCents: 0 },
      { accountId: 'acc_mpesa', debitCents: 0, creditCents: 347300 }
    ]
  },
  {
    id: 'tx_demo_2',
    date: '2026-11-16',
    time: '04:30 PM',
    receipt: 'TA12879BB1',
    description: 'Home Fibre Internet Bill',
    counterparty: 'Safaricom Home Fibre',
    amountCents: 300000,
    feeCents: 0,
    balanceCents: 2797300,
    verified: true,
    source: 'vision_ocr',
    entries: [
      { accountId: 'cat_bills', debitCents: 300000, creditCents: 0 },
      { accountId: 'acc_mpesa', debitCents: 0, creditCents: 300000 }
    ]
  },
  {
    id: 'tx_demo_3',
    date: '2026-11-15',
    time: '01:20 PM',
    receipt: 'TA12760KL9',
    description: 'Consulting Milestone Payment',
    counterparty: 'Fintech Solutions Ltd',
    amountCents: 1500000,
    feeCents: 0,
    balanceCents: 3097300,
    verified: true,
    source: 'sms_ai',
    entries: [
      { accountId: 'acc_mpesa', debitCents: 1500000, creditCents: 0 },
      { accountId: 'cat_income', debitCents: 0, creditCents: 1500000 }
    ]
  }
];

export function validateLedgerEntries(entries: LedgerEntry[]): boolean {
  if (!entries || entries.length < 2) return false;
  const totalDebits = entries.reduce((s, e) => s + (e.debitCents || 0), 0);
  const totalCredits = entries.reduce((s, e) => s + (e.creditCents || 0), 0);
  return totalDebits === totalCredits && totalDebits > 0;
}

export function formatKes(cents: number): string {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value).replace('KES', 'Ksh');
}

export function calculateAccountBalances(accounts: Account[], transactions: Transaction[]): Account[] {
  const balanceMap = new Map<string, number>();
  
  accounts.forEach(acc => {
    balanceMap.set(acc.id, acc.balanceCents);
  });

  // Replay transactions
  transactions.forEach(tx => {
    tx.entries.forEach(entry => {
      const current = balanceMap.get(entry.accountId) || 0;
      const account = accounts.find(a => a.id === entry.accountId);
      if (!account) return;

      if (account.nature === 'asset' || account.nature === 'expense') {
        balanceMap.set(entry.accountId, current + entry.debitCents - entry.creditCents);
      } else {
        balanceMap.set(entry.accountId, current + entry.creditCents - entry.debitCents);
      }
    });
  });

  return accounts.map(acc => ({
    ...acc,
    balanceCents: balanceMap.get(acc.id) || 0
  }));
}

export function calculateSafeToSpend(accounts: Account[], upcomingBillsCents = 1200000): {
  safeToSpendCents: number;
  totalLiquidCents: number;
  fulizaDebtCents: number;
  reserveCents: number;
} {
  const liquidAccounts = accounts.filter(a => a.spendable && a.nature === 'asset');
  const totalLiquidCents = liquidAccounts.reduce((sum, a) => sum + Math.max(0, a.balanceCents), 0);
  
  const fuliza = accounts.find(a => a.id === 'acc_fuliza');
  const fulizaDebtCents = fuliza ? Math.max(0, fuliza.balanceCents) : 0;

  const reserveCents = upcomingBillsCents;
  const safeToSpendCents = Math.max(0, totalLiquidCents - fulizaDebtCents - reserveCents);

  return {
    safeToSpendCents,
    totalLiquidCents,
    fulizaDebtCents,
    reserveCents
  };
}
