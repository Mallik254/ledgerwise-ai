import React from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2, History } from 'lucide-react';
import { Transaction, ChainAuditReport } from '../types';
import { formatKes } from '../lib/doubleEntryEngine';
import { ThemeConfig } from '../lib/themes';

interface ReconciliationAuditViewProps {
  transactions: Transaction[];
  theme: ThemeConfig;
  onAutoReconcileGap?: (gapAmount: number, date: string) => void;
}

export const ReconciliationAuditView: React.FC<ReconciliationAuditViewProps> = ({
  transactions,
  theme,
  onAutoReconcileGap
}) => {
  // Sort chronologically
  const sorted = [...transactions]
    .filter(t => t.balanceCents !== undefined && t.balanceCents !== null)
    .sort((a, b) => new Date(`${a.date} ${a.time || '00:00'}`).getTime() - new Date(`${b.date} ${b.time || '00:00'}`).getTime());

  // Perform local chain math audit
  const issues = [];
  let previousBalance: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const tx = sorted[i];
    const reported = tx.balanceCents || 0;
    const amount = tx.amountCents || 0;
    const fee = tx.feeCents || 0;
    
    // Determine if money moved in or out of acc_mpesa
    const mpesaEntry = tx.entries.find(e => e.accountId === 'acc_mpesa');
    const isOut = mpesaEntry ? mpesaEntry.creditCents > 0 : false;

    if (previousBalance !== null) {
      const expected = isOut ? previousBalance - amount - fee : previousBalance + amount;
      const diff = reported - expected;

      if (Math.abs(diff) > 100) { // More than 1 KES gap
        issues.push({
          txId: tx.id,
          receipt: tx.receipt || 'TX',
          date: tx.date,
          counterparty: tx.counterparty || tx.description,
          previousBalance,
          expected,
          reported,
          gapAmount: diff
        });
      }
    }
    previousBalance = reported;
  }

  const integrityScore = sorted.length > 0
    ? Math.max(0, Math.round(((sorted.length - issues.length) / sorted.length) * 100))
    : 100;

  return (
    <div className={`p-6 rounded-2xl border shadow-sm ${theme.classes.bgCard} ${theme.classes.textMain} ${theme.classes.borderLine} space-y-6`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${issues.length === 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
            {issues.length === 0 ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-serif font-semibold">M-Pesa Chain-Balance Reconciliation</h3>
            <p className={`text-xs ${theme.classes.textMuted}`}>Audits mathematical consistency of running balances across all recorded transactions</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Ledger Integrity</div>
            <div className={`text-2xl font-serif font-bold ${integrityScore === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
              {integrityScore}%
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono ${theme.classes.bgCardSoft} ${theme.classes.borderLine}`}>
            {sorted.length} chain points
          </div>
        </div>
      </div>

      {/* Discrepancies Alert */}
      {issues.length > 0 ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{issues.length} Unaccounted Gap(s) Detected in Ledger Sequence</span>
          </div>

          <div className="space-y-2">
            {issues.map((issue, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold">{issue.counterparty} ({issue.receipt}) on {issue.date}</div>
                  <div className={`${theme.classes.textMuted} mt-0.5`}>
                    Expected M-Pesa balance: <span className="font-mono">{formatKes(issue.expected)}</span> • Provider reported: <span className="font-mono font-bold">{formatKes(issue.reported)}</span>
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 font-medium">
                    {issue.gapAmount > 0
                      ? `+${formatKes(issue.gapAmount)} unaccounted credit (possible unrecorded cash deposit or incoming M-Pesa)`
                      : `-${formatKes(Math.abs(issue.gapAmount))} unaccounted expense (possible cash withdrawal or untracked merchant payment)`}
                  </div>
                </div>

                {onAutoReconcileGap && (
                  <button
                    onClick={() => onAutoReconcileGap(issue.gapAmount, issue.date)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1.5"
                  >
                    <span>Auto-Balance Gap</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Every transaction matches provider running balances. Zero missing gaps or unaccounted funds detected.</span>
        </div>
      )}

      {/* Chain Timeline Preview */}
      <div className="pt-2">
        <div className="text-xs font-semibold mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" />
          <span>Recent Running Balance Audit Trail</span>
        </div>
        <div className="space-y-2">
          {sorted.slice(-5).reverse().map((tx, idx) => (
            <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}>
              <div>
                <span className="font-semibold">{tx.counterparty || tx.description}</span>
                <span className={`ml-2 text-[11px] ${theme.classes.textMuted}`}>{tx.date}</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold">{formatKes(tx.balanceCents || 0)}</span>
                <span className={`block text-[10px] ${theme.classes.textMuted}`}>Provider Balance</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
