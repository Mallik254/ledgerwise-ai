import React, { useState } from 'react';
import { Search, Filter, ShieldCheck, Sparkles, Camera, PlusCircle, Download, Trash2 } from 'lucide-react';
import { Transaction, Account } from '../types';
import { formatKes } from '../lib/doubleEntryEngine';
import { ThemeConfig } from '../lib/themes';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  theme: ThemeConfig;
  onOpenVision: () => void;
  onOpenSms: () => void;
  onOpenManual?: () => void;
  onDeleteTransaction?: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  accounts,
  theme,
  onOpenVision,
  onOpenSms,
  onOpenManual,
  onDeleteTransaction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');

  const filtered = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.counterparty && tx.counterparty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.receipt && tx.receipt.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterAccount === 'all') return true;
    return tx.entries.some(e => e.accountId === filterAccount);
  });

  const exportToCsv = () => {
    const rows = [
      ['Date', 'Time', 'Receipt', 'Description', 'Counterparty', 'Amount (KES)', 'Fee (KES)', 'Running Balance (KES)', 'Source', 'Double Entry Legs']
    ];

    filtered.forEach(tx => {
      const legs = tx.entries.map(e => `${e.debitCents > 0 ? 'Dr' : 'Cr'} ${e.accountId} (${(e.debitCents || e.creditCents)/100})`).join(' | ');
      rows.push([
        tx.date,
        tx.time || '',
        tx.receipt || '',
        `"${tx.description.replace(/"/g, '""')}"`,
        `"${(tx.counterparty || '').replace(/"/g, '""')}"`,
        (tx.amountCents / 100).toFixed(2),
        ((tx.feeCents || 0) / 100).toFixed(2),
        tx.balanceCents !== undefined && tx.balanceCents !== null ? (tx.balanceCents / 100).toFixed(2) : '',
        tx.source || 'manual',
        `"${legs}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledgerwise_statement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`p-6 rounded-2xl border shadow-sm ${theme.classes.bgCard} ${theme.classes.textMain} ${theme.classes.borderLine} space-y-4`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-serif font-semibold">Double-Entry General Journal</h3>
          <p className={`text-xs ${theme.classes.textMuted}`}>Every record is mathematically balanced: Debits = Credits</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search receipt, merchant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
            />
          </div>

          {/* Account Filter */}
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
          >
            <option value="all">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>

          {/* CSV Export */}
          <button
            onClick={exportToCsv}
            className={`p-2 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft} hover:opacity-80 text-xs font-medium flex items-center gap-1`}
            title="Export Journal to CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Manual Entry */}
          {onOpenManual && (
            <button
              onClick={onOpenManual}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${theme.classes.borderLine} hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Manual Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className={`overflow-x-auto rounded-xl border ${theme.classes.borderLine}`}>
        <table className="w-full text-left text-xs">
          <thead className={`border-b ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}>
            <tr>
              <th className="p-3">Date & Time</th>
              <th className="p-3">Receipt / Source</th>
              <th className="p-3">Description & Counterparty</th>
              <th className="p-3">Double-Entry Legs</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-right">Running Balance</th>
              <th className="p-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {filtered.map(tx => {
              const mpesaEntry = tx.entries.find(e => e.accountId === 'acc_mpesa');
              const isOut = mpesaEntry ? mpesaEntry.creditCents > 0 : true;

              return (
                <tr key={tx.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-3 font-mono">
                    <div className="font-semibold">{tx.date}</div>
                    <div className={`text-[10px] ${theme.classes.textMuted}`}>{tx.time || '—'}</div>
                  </td>

                  <td className="p-3 font-mono">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">{tx.receipt || 'MANUAL'}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {tx.source === 'vision_ocr' && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          <Camera className="w-2.5 h-2.5" /> Vision
                        </span>
                      )}
                      {tx.source === 'sms_ai' && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="w-2.5 h-2.5" /> AI SMS
                        </span>
                      )}
                      {tx.verified && (
                        <span title="Balanced & Verified">
                          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="font-medium">{tx.description}</div>
                    {tx.counterparty && (
                      <div className={`text-[11px] ${theme.classes.textMuted}`}>{tx.counterparty}</div>
                    )}
                  </td>

                  <td className="p-3 text-[11px]">
                    <div className="space-y-0.5">
                      {tx.entries.map((entry, idx) => {
                        const acc = accounts.find(a => a.id === entry.accountId);
                        return (
                          <div key={idx} className="flex items-center gap-2 font-mono">
                            <span className={entry.debitCents > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {entry.debitCents > 0 ? 'Dr.' : 'Cr.'} {acc?.name || entry.accountId}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatKes(entry.debitCents || entry.creditCents)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  <td className="p-3 text-right font-bold">
                    <span className={!isOut ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                      {!isOut ? '+' : '-'}{formatKes(tx.amountCents)}
                    </span>
                    {tx.feeCents ? (
                      <div className={`text-[10px] font-normal ${theme.classes.textMuted}`}>
                        Fee: {formatKes(tx.feeCents)}
                      </div>
                    ) : null}
                  </td>

                  <td className="p-3 text-right font-mono text-xs">
                    {tx.balanceCents !== undefined && tx.balanceCents !== null ? (
                      <span className="font-semibold">{formatKes(tx.balanceCents)}</span>
                    ) : (
                      <span className={theme.classes.textMuted}>—</span>
                    )}
                  </td>

                  <td className="p-3 text-right">
                    {onDeleteTransaction && (
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
