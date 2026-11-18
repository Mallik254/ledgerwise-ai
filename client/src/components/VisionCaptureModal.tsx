import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle2, AlertCircle, X, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { ParsedAiTransaction, Transaction } from '../types';
import { formatKes } from '../lib/doubleEntryEngine';
import { ThemeConfig } from '../lib/themes';

interface VisionCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction) => void;
  theme: ThemeConfig;
  apiKey: string;
}

export const VisionCaptureModal: React.FC<VisionCaptureModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  theme,
  apiKey
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ParsedAiTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste image from clipboard support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileSelect(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    setError(null);
    setExtractedData(null);
    setImageMime(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      analyzeImage(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64: string, mime: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/vision-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: mime,
          apiKey: apiKey || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze receipt image');
      }

      setExtractedData(data.transaction);
    } catch (err: any) {
      console.error('Vision analysis error:', err);
      setError(err.message || 'Vision analysis failed. Make sure your Gemini API key is configured or server is active.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCommit = () => {
    if (!extractedData) return;

    const amountCents = Math.round(extractedData.amount * 100);
    const feeCents = Math.round(extractedData.fee * 100);
    const balanceCents = extractedData.balance ? Math.round(extractedData.balance * 100) : undefined;

    // Generate balanced double-entry
    const entries = [];
    if (extractedData.direction === 'out') {
      entries.push({ accountId: extractedData.suggestedCategory || 'cat_groceries', debitCents: amountCents, creditCents: 0 });
      if (feeCents > 0) {
        entries.push({ accountId: 'cat_fees', debitCents: feeCents, creditCents: 0 });
      }
      entries.push({ accountId: 'acc_mpesa', debitCents: 0, creditCents: amountCents + feeCents });
    } else {
      entries.push({ accountId: 'acc_mpesa', debitCents: amountCents, creditCents: 0 });
      entries.push({ accountId: extractedData.suggestedCategory || 'cat_income', debitCents: 0, creditCents: amountCents });
    }

    const newTx: Transaction = {
      id: `tx_vis_${Date.now()}`,
      date: extractedData.date || new Date().toISOString().split('T')[0],
      time: extractedData.time || '',
      receipt: extractedData.receipt,
      description: `${extractedData.type.replace('_', ' ').toUpperCase()}: ${extractedData.counterparty}`,
      counterparty: extractedData.counterparty,
      amountCents,
      feeCents,
      balanceCents,
      verified: true,
      source: 'vision_ocr',
      entries
    };

    onAddTransaction(newTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${theme.classes.bgCard} ${theme.classes.textMain} border ${theme.classes.borderLine}`}>
        
        {/* Modal Header */}
        <div className={`flex items-center justify-between p-6 border-b ${theme.classes.borderLine}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-semibold">Vision OCR Receipt Intake</h2>
              <p className={`text-xs ${theme.classes.textMuted}`}>Drop screenshots, paste with Ctrl+V, or snap M-Pesa receipts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Dropzone */}
          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
              }}
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-emerald-500 ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}
            >
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
                <Upload className="w-8 h-8" />
              </div>
              <span className="text-sm font-medium">Click to upload or drag & drop</span>
              <span className={`text-xs mt-1 ${theme.classes.textMuted}`}>PNG, JPG, WebP up to 15MB • Clipboard (Ctrl+V) enabled</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Image Preview */}
              <div className="relative rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-h-80 bg-black/5 flex items-center justify-center">
                <img src={imagePreview} alt="Receipt preview" className="max-h-80 w-auto object-contain" />
                <button
                  onClick={() => { setImagePreview(null); setExtractedData(null); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black text-xs"
                >
                  Change image
                </button>
              </div>

              {/* Extraction State */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between ${theme.classes.borderLine} ${theme.classes.bgCardSoft}`}>
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <span className="text-sm font-medium">Multimodal AI inspecting receipt...</span>
                    <span className={`text-xs ${theme.classes.textMuted}`}>Reading receipt code, amount, counterparty & balances</span>
                  </div>
                ) : extractedData ? (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> AI Extracted
                      </span>
                      <span className="font-mono bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-[11px]">
                        {extractedData.receipt}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                      <div className="flex justify-between">
                        <span className={theme.classes.textMuted}>Counterparty:</span>
                        <span className="font-medium">{extractedData.counterparty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={theme.classes.textMuted}>Amount:</span>
                        <span className="font-bold text-sm">{formatKes(Math.round(extractedData.amount * 100))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={theme.classes.textMuted}>Fee:</span>
                        <span>{formatKes(Math.round(extractedData.fee * 100))}</span>
                      </div>
                      {extractedData.balance !== null && (
                        <div className="flex justify-between">
                          <span className={theme.classes.textMuted}>New Balance:</span>
                          <span className="font-mono">{formatKes(Math.round(extractedData.balance * 100))}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className={theme.classes.textMuted}>Date & Time:</span>
                        <span>{extractedData.date} {extractedData.time}</span>
                      </div>
                    </div>

                    {/* Double-entry preview */}
                    <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 space-y-1 text-[11px]">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">Double-Entry Journal Post:</div>
                      <div className="flex justify-between">
                        <span>Debit: {extractedData.suggestedCategory}</span>
                        <span>{formatKes(Math.round(extractedData.amount * 100))}</span>
                      </div>
                      {extractedData.fee > 0 && (
                        <div className="flex justify-between">
                          <span>Debit: cat_fees</span>
                          <span>{formatKes(Math.round(extractedData.fee * 100))}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span>Credit: acc_mpesa</span>
                        <span>{formatKes(Math.round((extractedData.amount + extractedData.fee) * 100))}</span>
                      </div>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full py-6 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{error}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`flex items-center justify-between p-6 border-t ${theme.classes.borderLine}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-xl text-xs font-medium ${theme.classes.textMuted} hover:text-inherit`}>
            Cancel
          </button>
          {extractedData && (
            <button
              onClick={handleCommit}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium shadow-md transition-all ${theme.classes.accentForest}`}
            >
              <span>Post to Double-Entry Ledger</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
