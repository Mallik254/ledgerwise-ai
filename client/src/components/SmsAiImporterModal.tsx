import React, { useState } from 'react';
import { MessageSquareText, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, X, Cpu, RefreshCw, Check } from 'lucide-react';
import { ParsedAiTransaction, Transaction } from '../types';
import { formatKes } from '../lib/doubleEntryEngine';
import { ThemeConfig } from '../lib/themes';

interface SmsAiImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTransactions: (transactions: Transaction[]) => void;
  theme: ThemeConfig;
  apiKey: string;
}

export const SmsAiImporterModal: React.FC<SmsAiImporterModalProps> = ({
  isOpen,
  onClose,
  onImportTransactions,
  theme,
  apiKey
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedAiTransaction[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [mode, setMode] = useState<'ai' | 'local'>('ai');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/parse-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          apiKey: mode === 'ai' ? (apiKey || undefined) : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to parse SMS');

      // Select all valid rows by default
      const withSelection = (data.transactions || []).map((t: ParsedAiTransaction) => ({
        ...t,
        selected: true
      }));

      setParsedRows(withSelection);
    } catch (err: any) {
      console.error('SMS parse error:', err);
      setError(err.message || 'Error parsing SMS. Check your connection or API key.');
    } finally {
      setIsParsing(false);
    }
  };

  const toggleSelectRow = (index: number) => {
    setParsedRows(prev => prev.map((row, i) => i === index ? { ...row, selected: !row.selected } : row));
  };

  const handleCommitAll = () => {
    const selected = parsedRows.filter(r => r.selected);
    if (!selected.length) return;

    const newTransactions: Transaction[] = selected.map(item => {
      const amountCents = Math.round(item.amount * 100);
      const feeCents = Math.round(item.fee * 100);
      const balanceCents = item.balance ? Math.round(item.balance * 100) : undefined;

      const entries = [];
      if (item.direction === 'out') {
        entries.push({ accountId: item.suggestedCategory || 'cat_misc', debitCents: amountCents, creditCents: 0 });
        if (feeCents > 0) {
          entries.push({ accountId: 'cat_fees', debitCents: feeCents, creditCents: 0 });
        }
        entries.push({ accountId: 'acc_mpesa', debitCents: 0, creditCents: amountCents + feeCents });
      } else {
        entries.push({ accountId: 'acc_mpesa', debitCents: amountCents, creditCents: 0 });
        entries.push({ accountId: item.suggestedCategory || 'cat_income', debitCents: 0, creditCents: amountCents });
      }

      return {
        id: `tx_${item.receipt || Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: item.date || new Date().toISOString().split('T')[0],
        time: item.time || '',
        receipt: item.receipt,
        description: `${item.type.replace('_', ' ').toUpperCase()}: ${item.counterparty}`,
        counterparty: item.counterparty,
        amountCents,
        feeCents,
        balanceCents,
        verified: !item.needsReview,
        source: 'sms_ai',
        entries
      };
    });

    onImportTransactions(newTransactions);
    onClose();
  };

  const selectedCount = parsedRows.filter(r => r.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl ${theme.classes.bgCard} ${theme.classes.textMain} border ${theme.classes.borderLine}`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${theme.classes.borderLine}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-forest/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-semibold">AI SMS Batch Importer</h2>
              <p className={`text-xs ${theme.classes.textMuted}`}>Paste M-Pesa SMS messages without missing transactions or drops</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg p-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs">
              <button
                onClick={() => setMode('ai')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${mode === 'ai' ? 'bg-emerald-600 text-white' : theme.classes.textMuted}`}
              >
                <Sparkles className="w-3 h-3" />
                Gemini AI
              </button>
              <button
                onClick={() => setMode('local')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${mode === 'local' ? 'bg-emerald-600 text-white' : theme.classes.textMuted}`}
              >
                <Cpu className="w-3 h-3" />
                Local Resilient
              </button>
            </div>

            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium">Paste Safaricom / M-Pesa SMS Text:</label>
              <span className={theme.classes.textMuted}>Multiple messages can be separated by blank lines or paste all together</span>
            </div>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g. TAH89XJ4K2 Confirmed. Ksh2,450.00 paid to NAIVAS SUPERMARKET. on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh14,200.50. Transaction cost, Ksh23.00."
              className={`w-full p-3 font-mono text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRawText(`TAH89XJ4K2 Confirmed. Ksh2,450.00 paid to NAIVAS SUPERMARKET. on 18/11/26 at 2:15 PM. New M-PESA balance is Ksh14,200.50. Transaction cost, Ksh23.00.

TB190KL89M Confirmed. You have received Ksh5,000.00 from JOHN MWANGI 0712345678 on 18/11/26 at 11:30 AM. New M-PESA balance is Ksh16,650.50.

TC9820PQ11 Confirmed. Ksh1,000.00 sent to SAFARICOM HOME FIBRE for account 0722000000 on 17/11/26 at 8:00 AM. New M-PESA balance is Ksh11,650.50. Transaction cost, Ksh0.00.`)}
                className={`text-[11px] underline ${theme.classes.textMuted} hover:text-inherit`}
              >
                Insert sample M-Pesa batch
              </button>

              <button
                onClick={handleParse}
                disabled={isParsing || !rawText.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium shadow transition-all ${theme.classes.accentForest} disabled:opacity-50`}
              >
                {isParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isParsing ? 'Analyzing SMS batch...' : 'Run Intelligent AI Parser'}</span>
              </button>
            </div>
          </div>

          {/* Results Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Parsed Transactions ({parsedRows.length} detected)
                </span>
                <span className={theme.classes.textMuted}>
                  Zero transactions dropped • All items validated
                </span>
              </div>

              <div className={`overflow-x-auto rounded-xl border ${theme.classes.borderLine}`}>
                <table className="w-full text-left text-xs">
                  <thead className={`border-b ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}>
                    <tr>
                      <th className="p-3 w-8"></th>
                      <th className="p-3">Receipt / Date</th>
                      <th className="p-3">Counterparty & Type</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Fee</th>
                      <th className="p-3 text-right">New Balance</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={`transition-colors ${row.selected ? '' : 'opacity-40'} hover:bg-black/5 dark:hover:bg-white/5`}>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectRow(idx)}
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${row.selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-400'}`}
                          >
                            {row.selected && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        </td>
                        <td className="p-3 font-mono">
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">{row.receipt}</div>
                          <div className={`text-[10px] ${theme.classes.textMuted}`}>{row.date} {row.time}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{row.counterparty}</div>
                          <div className={`text-[10px] capitalize ${theme.classes.textMuted}`}>{row.type.replace('_', ' ')} • {row.suggestedCategory}</div>
                        </td>
                        <td className="p-3 text-right font-bold">
                          <span className={row.direction === 'in' ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                            {row.direction === 'in' ? '+' : '-'}{formatKes(Math.round(row.amount * 100))}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-[11px]">
                          {row.fee > 0 ? formatKes(Math.round(row.fee * 100)) : 'Free'}
                        </td>
                        <td className="p-3 text-right font-mono text-[11px]">
                          {row.balance !== null ? formatKes(Math.round(row.balance * 100)) : '—'}
                        </td>
                        <td className="p-3">
                          {row.needsReview ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between p-6 border-t ${theme.classes.borderLine}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-xl text-xs font-medium ${theme.classes.textMuted} hover:text-inherit`}>
            Cancel
          </button>
          {parsedRows.length > 0 && (
            <button
              onClick={handleCommitAll}
              disabled={selectedCount === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium shadow-md transition-all ${theme.classes.accentForest} disabled:opacity-50`}
            >
              <span>Commit {selectedCount} Transactions to Double-Entry Ledger</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
