import React from 'react';
import { Palette, Settings, Sparkles, ShieldCheck } from 'lucide-react';
import { ThemeId } from '../types';
import { THEMES, ThemeConfig } from '../lib/themes';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentTheme: ThemeId;
  setCurrentTheme: (theme: ThemeId) => void;
  theme: ThemeConfig;
  onOpenSettings: () => void;
  onOpenVision: () => void;
  onOpenSms: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  currentTheme,
  setCurrentTheme,
  theme,
  onOpenSettings,
  onOpenVision,
  onOpenSms
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'transactions', label: 'Journal & Entries' },
    { id: 'reconciliation', label: 'Chain Auditor' },
    { id: 'accounts', label: 'Accounts & Liabilities' }
  ];

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md px-6 py-4 ${theme.classes.headerBg}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#173f2e] flex items-center justify-center text-[#f6f1e6] shadow-sm font-serif font-bold text-lg">
            LW
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-serif font-bold tracking-tight">Ledgerwise</h1>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${theme.classes.badgeBg}`}>
                AI 2.0
              </span>
            </div>
            <p className={`text-[11px] ${theme.classes.textMuted}`}>Double-Entry Intelligence</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${currentTab === tab.id ? 'bg-white dark:bg-white/10 shadow-sm font-semibold' : theme.classes.textMuted + ' hover:text-inherit'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick AI buttons */}
          <button
            onClick={onOpenVision}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${theme.classes.accentForest}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vision OCR</span>
          </button>

          {/* Theme Selector */}
          <div className="relative group">
            <button className={`p-2 rounded-lg border border-black/10 dark:border-white/10 ${theme.classes.bgCardSoft} hover:opacity-80 transition-opacity`}>
              <Palette className="w-4 h-4" />
            </button>
            <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl p-2 border ${theme.classes.bgCard} ${theme.classes.borderLine} hidden group-hover:block z-50 animate-fade-in`}>
              <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 text-muted-foreground">Select Luxury Theme</div>
              {Object.values(THEMES).map(t => (
                <button
                  key={t.id}
                  onClick={() => setCurrentTheme(t.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${currentTheme === t.id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <span>{t.name}</span>
                  {currentTheme === t.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className={`p-2 rounded-lg border border-black/10 dark:border-white/10 ${theme.classes.bgCardSoft} hover:opacity-80 transition-opacity`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
