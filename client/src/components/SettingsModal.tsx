import React, { useState } from 'react';
import { X, Key, Cloud, Download, Upload, ShieldCheck, Check, Info, Server } from 'lucide-react';
import { ThemeConfig } from '../lib/themes';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onExportJson: () => void;
  onResetSampleData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  apiKey,
  onSaveApiKey,
  onExportJson,
  onResetSampleData
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [savedMessage, setSavedMessage] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl ${theme.classes.bgCard} ${theme.classes.textMain} border ${theme.classes.borderLine}`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${theme.classes.borderLine}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
              <Server className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold">Ledgerwise Configuration</h2>
              <p className={`text-xs ${theme.classes.textMuted}`}>AI models, Cloud sync & data backups</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs">
          {/* Gemini AI Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-500" />
                <span>Google Gemini API Key (Multimodal Vision & SMS)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 hover:underline"
              >
                Get free key &rarr;
              </a>
            </div>

            <p className={theme.classes.textMuted}>
              Gemini 1.5/2.0 Flash is 100% free with generous rate limits. If not set, Ledgerwise automatically uses the built-in deterministic local parser (no internet or key needed).
            </p>

            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className={`flex-1 p-2.5 font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
              />
              <button
                onClick={handleSave}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all ${theme.classes.accentForest}`}
              >
                Save
              </button>
            </div>

            {savedMessage && (
              <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>API Key saved securely in browser session</span>
              </div>
            )}
          </div>

          {/* Cloud Sync Supabase Info */}
          <div className={`p-4 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft} space-y-2`}>
            <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              <Cloud className="w-4 h-4" />
              <span>Supabase Cloud Sync</span>
            </div>
            <p className={theme.classes.textMuted}>
              Connected to your private Supabase database endpoint:
            </p>
            <div className="p-2 rounded bg-black/5 dark:bg-white/5 font-mono text-[11px] truncate">
              https://nipsnpttesinenogregd.supabase.co
            </div>
          </div>

          {/* Render Deployment Ready Info */}
          <div className={`p-4 rounded-xl border ${theme.classes.borderLine} ${theme.classes.bgCardSoft} space-y-2`}>
            <div className="flex items-center gap-2 font-semibold">
              <Server className="w-4 h-4 text-emerald-500" />
              <span>Render 1-Click Deployment</span>
            </div>
            <p className={theme.classes.textMuted}>
              This app is ready to deploy on Render using the included <code>render.yaml</code>. The Express server serves both the AI API and the compiled frontend seamlessly.
            </p>
          </div>

          {/* Export & Reset */}
          <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
            <button
              onClick={onExportJson}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${theme.classes.borderLine} hover:bg-black/5 dark:hover:bg-white/5 font-medium`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger JSON</span>
            </button>

            <button
              onClick={onResetSampleData}
              className="text-red-500 hover:underline text-[11px]"
            >
              Reset to Sample Data
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
