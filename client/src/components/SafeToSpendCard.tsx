import React from 'react';
import { Sparkles, Shield, Wallet, ArrowUpRight, AlertCircle } from 'lucide-react';
import { formatKes } from '../lib/doubleEntryEngine';
import { ThemeConfig } from '../lib/themes';

interface SafeToSpendCardProps {
  safeToSpendCents: number;
  totalLiquidCents: number;
  fulizaDebtCents: number;
  reserveCents: number;
  theme: ThemeConfig;
  onOpenVision: () => void;
  onOpenSms: () => void;
}

export const SafeToSpendCard: React.FC<SafeToSpendCardProps> = ({
  safeToSpendCents,
  totalLiquidCents,
  fulizaDebtCents,
  reserveCents,
  theme,
  onOpenVision,
  onOpenSms
}) => {
  return (
    <div className={`p-6 rounded-2xl border shadow-sm ${theme.classes.bgCard} ${theme.classes.textMain} ${theme.classes.borderLine}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Safe-To-Spend Metric */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${theme.classes.badgeBg}`}>
              Predictive Liquidity
            </span>
            <span className={`text-xs ${theme.classes.textMuted}`}>CFO Intelligence Engine</span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl lg:text-4xl font-serif font-bold tracking-tight">
              {formatKes(safeToSpendCents)}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Safe-to-Spend
            </span>
          </div>

          <p className={`text-xs ${theme.classes.textMuted} max-w-md`}>
            Calculated after deducting upcoming bills and zeroing out any Fuliza overdraft liabilities from your liquid mobile & bank balances.
          </p>
        </div>

        {/* Breakdown Pills */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}>
            <span className={`block text-[10px] font-medium uppercase ${theme.classes.textMuted}`}>Liquid Cash</span>
            <span className="font-semibold text-xs mt-0.5 block">{formatKes(totalLiquidCents)}</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}>
            <span className={`block text-[10px] font-medium uppercase ${theme.classes.textMuted}`}>Bill Reserves</span>
            <span className="font-semibold text-xs mt-0.5 block">{formatKes(reserveCents)}</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}>
            <span className={`block text-[10px] font-medium uppercase ${fulizaDebtCents > 0 ? 'text-red-500' : theme.classes.textMuted}`}>
              Fuliza Debt
            </span>
            <span className={`font-semibold text-xs mt-0.5 block ${fulizaDebtCents > 0 ? 'text-red-500' : ''}`}>
              {formatKes(fulizaDebtCents)}
            </span>
          </div>
        </div>

        {/* AI Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenVision}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow transition-all ${theme.classes.accentForest}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vision OCR</span>
          </button>

          <button
            onClick={onOpenSms}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow transition-all ${theme.classes.accentBrass}`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>AI SMS Batch</span>
          </button>
        </div>

      </div>
    </div>
  );
};
