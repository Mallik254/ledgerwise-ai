export type AccountNature = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface Account {
  id: string;
  name: string;
  type: 'mobile' | 'bank' | 'cash' | 'savings' | 'loan' | 'overdraft' | 'equity' | 'expense' | 'income';
  nature: AccountNature;
  balanceCents: number;
  institution?: string;
  spendable?: boolean;
  color?: string;
}

export interface LedgerEntry {
  accountId: string;
  debitCents: number;
  creditCents: number;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string;
  description: string;
  counterparty?: string;
  receipt?: string;
  amountCents: number;
  feeCents?: number;
  balanceCents?: number; // Snapshot of running balance from provider
  entries: LedgerEntry[];
  type?: string;
  verified?: boolean;
  source?: 'manual' | 'sms_ai' | 'vision_ocr' | 'import';
}

export interface ParsedAiTransaction {
  id: string;
  receipt: string;
  rawText?: string;
  date: string;
  time: string;
  amount: number;
  fee: number;
  balance: number | null;
  direction: 'in' | 'out';
  type: string;
  counterparty: string;
  suggestedCategory: string;
  debitAccount: string;
  creditAccount: string;
  confidence: number;
  needsReview: boolean;
  source: string;
  selected?: boolean;
}

export interface ChainAuditIssue {
  type: string;
  severity: 'warning' | 'error';
  txId: string;
  receipt?: string;
  date?: string;
  time?: string;
  counterparty?: string;
  previousBalance: number;
  expectedBalance: number;
  reportedBalance: number;
  gapAmount: number;
  message: string;
}

export interface ChainAuditReport {
  status: 'perfect' | 'discrepancies_found' | 'empty';
  totalTransactions: number;
  auditedWithBalance: number;
  issues: ChainAuditIssue[];
  integrityScore: number;
  summary: string;
}

export type ThemeId = 'forest_ivory' | 'obsidian_emerald' | 'midnight_gold' | 'daylight_linen';
