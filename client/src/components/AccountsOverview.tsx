import React from 'react';
import { Smartphone, Building2, Wallet, PiggyBank, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import { Account } from '../types';
import { formatKes } from '../lib/doubleEntryEngine';
import { ThemeConfig } from '../lib/themes';

interface AccountsOverviewProps {
  accounts: Account[];
  theme: ThemeConfig;
}

export const AccountsOverview: React.FC<AccountsOverviewProps> = ({ accounts, theme }) => {
  const assets = accounts.filter(a => a.nature === 'asset');
  const liabilities = accounts.filter(a => a.nature === 'liability');

  const totalAssetsCents = assets.reduce((sum, a) => sum + (a.balanceCents || 0), 0);
  const totalLiabilitiesCents = liabilities.reduce((sum, a) => sum + (a.balanceCents || 0), 0);
  const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-5 h-5 text-emerald-500" />;
      case 'bank': return <Building2 className="w-5 h-5 text-blue-500" />;
      case 'cash': return <Wallet className="w-5 h-5 text-amber-500" />;
      case 'savings': return <PiggyBank className="w-5 h-5 text-purple-500" />;
      case 'overdraft':
      case 'loan': return <CreditCard className="w-5 h-5 text-red-500" />;
      default: return <TrendingUp className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Net Worth Summary */}
      <div className={`p-6 rounded-2xl border shadow-sm ${theme.classes.bgCard} ${theme.classes.textMain} ${theme.classes.borderLine}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${theme.classes.badgeBg} px-2.5 py-0.5 rounded-full`}>
              Consolidated Net Worth
            </span>
            <div className="text-3xl font-serif font-bold mt-2">
              {formatKes(netWorthCents)}
            </div>
            <p className={`text-xs ${theme.classes.textMuted} mt-1`}>
              Assets: {formatKes(totalAssetsCents)} • Total Liabilities: {formatKes(totalLiabilitiesCents)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft} text-right`}>
              <div className={`text-[10px] uppercase font-medium ${theme.classes.textMuted}`}>Total Assets</div>
              <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{formatKes(totalAssetsCents)}</div>
            </div>

            <div className={`p-3 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft} text-right`}>
              <div className={`text-[10px] uppercase font-medium ${theme.classes.textMuted}`}>Overdraft / Debt</div>
              <div className="font-bold text-sm text-red-500">{formatKes(totalLiabilitiesCents)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Accounts Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-serif font-semibold tracking-wide">Assets & Liquidity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {assets.map(acc => (
            <div
              key={acc.id}
              className={`p-4 rounded-xl border transition-all hover:shadow-md ${theme.classes.bgCard} ${theme.classes.borderLine}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                  {getAccountIcon(acc.type)}
                </div>
                {acc.spendable ? (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Spendable
                  </span>
                ) : (
                  <span className={`text-[10px] font-medium ${theme.classes.textMuted} bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full`}>
                    Reserved
                  </span>
                )}
              </div>

              <div className="font-semibold text-sm">{acc.name}</div>
              <div className={`text-[11px] ${theme.classes.textMuted}`}>{acc.institution || acc.type}</div>
              <div className="text-lg font-mono font-bold mt-2">{formatKes(acc.balanceCents)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Liabilities Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-serif font-semibold tracking-wide">Liabilities & Overdrafts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {liabilities.map(acc => (
            <div
              key={acc.id}
              className={`p-4 rounded-xl border transition-all hover:shadow-md ${theme.classes.bgCard} ${theme.classes.borderLine}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  {getAccountIcon(acc.type)}
                </div>
                <span className="text-[10px] font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                  Liability
                </span>
              </div>

              <div className="font-semibold text-sm">{acc.name}</div>
              <div className={`text-[11px] ${theme.classes.textMuted}`}>{acc.institution || 'Credit'}</div>
              <div className="text-lg font-mono font-bold text-red-500 mt-2">{formatKes(acc.balanceCents)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
