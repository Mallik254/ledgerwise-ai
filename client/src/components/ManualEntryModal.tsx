import React, { useState } from 'react';
import { PlusCircle, X, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { Transaction, Account, LedgerEntry } from '../types';
import { formatKes, validateLedgerEntries } from '../lib/doubleEntryEngine';
import { ThemeConfig } from '../lib/themes';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onAddTransaction: (tx: Transaction) => void;
  theme: ThemeConfig;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddTransaction,
  theme
}) => {
  const [description, setDescription] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [receipt, setReceipt] = useState('');
  const [amount, setAmount] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('cat_groceries');
  const [creditAccountId, setCreditAccountId] = useState('acc_cash');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('12:00 PM');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description.');
      return;
    }

    if (debitAccountId === creditAccountId) {
      setError('Debit and Credit accounts must be different.');
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);

    const entries: LedgerEntry[] = [
      { accountId: debitAccountId, debitCents: amountCents, creditCents: 0 },
      { accountId: creditAccountId, debitCents: 0, creditCents: amountCents }
    ];

    if (!validateLedgerEntries(entries)) {
      setError('Double-entry validation failed: Debits must strictly equal Credits.');
      return;
    }

    const newTx: Transaction = {
      id: `manual_${Date.now()}`,
      date,
      time,
      description: description.trim(),
      counterparty: counterparty.trim() || undefined,
      receipt: receipt.trim().toUpperCase() || undefined,
      amountCents,
      feeCents: 0,
      verified: true,
      source: 'manual',
      entries
    };

    onAddTransaction(newTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl ${theme.classes.bgCard} ${theme.classes.textMain} border ${theme.classes.borderLine}`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${theme.classes.borderLine}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold">Post Manual Journal Entry</h2>
              <p className={`text-xs ${theme.classes.textMuted}`}>Balanced double-entry posting for cash, banks or adjustments</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
                required
              />
            </div>
            <div>
              <label className="font-medium block mb-1">Time</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 2:30 PM"
                className={`w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
              />
            </div>
          </div>

          <div>
            <label className="font-medium block mb-1">Amount (KES)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full p-2.5 font-mono text-sm font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
              required
            />
          </div>

          <div>
            <label className="font-medium block mb-1">Description / Memo</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fresh vegetables from local market"
              className={`w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium block mb-1">Counterparty (Optional)</label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g. City Market Stall 4"
                className={`w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
              />
            </div>
            <div>
              <label className="font-medium block mb-1">Receipt / Ref # (Optional)</label>
              <input
                type="text"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                placeholder="e.g. REC-1029"
                className={`w-full p-2.5 font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
              />
            </div>
          </div>

          {/* Double-Entry Legs Selection */}
          <div className={`p-4 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft} space-y-3`}>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Double-Entry Account Mapping</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-amber-600 dark:text-amber-400 mb-1">
                  Debit Account (Receives Value)
                </label>
                <select
                  value={debitAccountId}
                  onChange={(e) => setDebitAccountId(e.target.value)}
                  className={`w-full p-2 rounded-lg border font-mono text-xs ${theme.classes.borderLine} bg-white dark:bg-black/20`}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.nature.toUpperCase()}] {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mb-1">
                  Credit Account (Gives Value)
                </label>
                <select
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                  className={`w-full p-2 rounded-lg border font-mono text-xs ${theme.classes.borderLine} bg-white dark:bg-black/20`}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.nature.toUpperCase()}] {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-medium ${theme.classes.textMuted}`}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium shadow transition-all ${theme.classes.accentForest}`}
            >
              <span>Post Transaction</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
