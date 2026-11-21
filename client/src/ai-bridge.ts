/**
 * Ledgerwise AI Suite
 * Integrates 5 Gemini AI capabilities directly into the original Ledgerwise UI:
 *  1. Chat Assistant (grounded in live ledger balances & history)
 *  2. Natural-Language Transaction Entry
 *  3. Multimodal Receipt / Screenshot Scanner
 *  4. Smart Auto-Categorization (for uncategorized / imported transactions)
 *  5. Monthly AI Financial Review & Anomaly Alerts
 *  6. AI Budget Coach & Debt Payoff Advisor (with 1-click Apply Suggested Budgets)
 */

export {};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ParsedTx {
  type: 'expense' | 'income' | 'transfer';
  date: string;
  amountMajor: number;
  payee: string;
  description: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  notes: string;
  explanation: string;
}

interface CatAssignment {
  id: string;
  categoryId: string;
  categoryName: string;
  reason: string;
}

interface MonthlyReviewResult {
  headline: string;
  healthScore: number;
  summary: string;
  anomalies: Array<{ title: string; severity: string; detail: string }>;
  wins: string[];
  actionItems: string[];
}

interface CoachResult {
  summary: string;
  safeToSpendAdvice: string;
  debtStrategyAdvice: string;
  suggestedBudgets: Array<{
    categoryId: string;
    categoryName: string;
    suggestedLimitMajor: number;
    reason: string;
  }>;
  nextSteps: string[];
}

interface LwHooks {
  getState: () => any;
  getMonth: () => string;
  todayISO: () => string;
  addMonthsKey: (k: string, d: number) => string;
  accountBalance: (id: string) => number;
  accountTotals: () => { assets: number; liabilities: number; net: number };
  accountNature: (acc: any) => 'asset' | 'liability';
  activeAccounts: () => any[];
  categoriesOf: (type: 'expense' | 'income') => any[];
  categoryById: (id: string) => any;
  monthTotals: (month: string) => { income: number; expense: number; net: number; byCategory: Map<string, number> };
  budgetTotals: (month: string) => any;
  safeToSpend: () => any;
  recurringMonthlyLoad: () => number;
  recurringMonthlyIncome: () => number;
  activeGoals: () => any[];
  goalSaved: (g: any) => number;
  simulateDebt: (extraCents: number, strategy: string) => any;
  postTransaction: (draft: any) => any;
  setBudget: (month: string, categoryId: string, limitCents: number) => void;
  persist: (action: string, text: string) => void;
  refresh: (msg?: string, tone?: string) => void;
  toast: (msg: string, tone?: string) => void;
  formatMoney: (cents: number, opts?: any) => string;
  revealTransaction?: (txId: string) => void;
}

declare global {
  interface Window {
    __lw?: LwHooks;
    LedgerwiseAI?: {
      openDrawer: (tab?: string) => void;
      closeDrawer: () => void;
      recoverSms: (blocks: string[]) => Promise<Array<{
        receipt: string;
        date: string;
        time: string;
        dir: 'in' | 'out';
        amountMajor: number;
        feeMajor: number;
        balanceMajor: number;
        description: string;
        failed: boolean;
        categoryId: string;
      }>>;
      categorizeImportRows: (rows: any[]) => Promise<number>;
    };
  }
}

function lw(): LwHooks | null {
  return window.__lw || null;
}

function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLiveSnapshot() {
  const h = lw();
  const state = h?.getState();
  if (!h || !state) return null;
  const month = h.getMonth();
  const totals = h.accountTotals();
  const safe = h.safeToSpend();
  const mTotals = h.monthTotals(month);
  const bTotals = h.budgetTotals(month);

  return {
    month,
    currency: state.profile?.currency || 'KES',
    profile: {
      name: state.profile?.name,
      savingsTargetPct: state.profile?.savingsTargetPct,
      safeWindowDays: state.profile?.safeWindowDays,
      bufferMajor: (state.profile?.bufferCents || 0) / 100,
    },
    netWorthMajor: totals.net / 100,
    assetsMajor: totals.assets / 100,
    liabilitiesMajor: totals.liabilities / 100,
    safeToSpendMajor: safe.safe / 100,
    spendableCashMajor: safe.liquid / 100,
    monthIncomeMajor: mTotals.income / 100,
    monthExpenseMajor: mTotals.expense / 100,
    monthNetMajor: mTotals.net / 100,
    budgetLimitMajor: bTotals.limit / 100,
    budgetSpentMajor: bTotals.spent / 100,
    accounts: h.activeAccounts().map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balanceMajor: h.accountBalance(a.id) / 100,
    })),
    recentTransactions: [...(state.transactions || [])]
      .filter((t: any) => t.type !== 'reversal' && !t.reversedBy)
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 25)
      .map((t: any) => ({
        date: t.date,
        type: t.type,
        payee: t.payee,
        description: t.description,
        category: t.categoryId ? h.categoryById(t.categoryId)?.name : '',
        amountMajor: (t.amountCents || 0) / 100,
      })),
  };
}


/**
 * Deterministic finance answers. Reads the live ledger through window.__lw.
 * Returns null when a question needs interpretation beyond known ledger facts.
 */
function answerFromLedger(prompt: string): string | null {
  const h = lw();
  const state = h?.getState();
  if (!h || !state) return null;
  const q = prompt.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const month = h.getMonth();
  const currency = state.profile?.currency || 'KES';
  const money = (cents: number) => {
    const amount = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return currency + ' ' + amount.toFixed(2);
    }
  };
  const totals = h.monthTotals(month);
  const budget = h.budgetTotals(month);
  const safe = h.safeToSpend();
  const accountTotals = h.accountTotals();
  const accounts = h.activeAccounts();
  const categories = [...h.categoriesOf('expense'), ...h.categoriesOf('income')];
  const monthLabel = (key: string) => {
    const parts = key.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  // Keep current-only facts separate from questions about a historical period.
  const unsupportedPeriod = /\b(this year|last year|year to date|past \d+ months?|last \d+ months?|past week|last week|today|yesterday|in (january|february|march|april|may|june|july|august|september|october|november|december)|20\d{2})\b/.test(q);
  const safeSpendQuestion = /\b(safe to spend|spendable|available to spend|how much can i spend)\b/.test(q);
  if (unsupportedPeriod && !safeSpendQuestion) return null;


  if (/\bnet worth\b/.test(q)) {
    return 'Your current net worth is ' + money(accountTotals.net) + ' (assets ' + money(accountTotals.assets) + ' less liabilities ' + money(accountTotals.liabilities) + ').';
  }
  if (/\bassets?\b/.test(q) && !/\bliabilit/.test(q)) return 'Your recorded assets total ' + money(accountTotals.assets) + '.';
  if (/\bliabilit|owe\b/.test(q)) return 'Your recorded liabilities total ' + money(accountTotals.liabilities) + '.';
  if (/\b(balance|balances)\b/.test(q)) {
    const named = accounts.find((a: any) => q.includes(String(a.name || '').toLocaleLowerCase()));
    if (named) return named.name + ' currently has a balance of ' + money(h.accountBalance(named.id)) + '.';
    return 'Across your accounts, assets are ' + money(accountTotals.assets) + ', liabilities are ' + money(accountTotals.liabilities) + ', and net worth is ' + money(accountTotals.net) + '.';
  }


  // Search recent ledger entries locally; exclude reversals and reversed originals.
  if (/\b(transactions?|entries|payments?|purchases?|receipts?)\b/.test(q)) {
    const all = (state.transactions || [])
      .filter((t: any) => t.type !== 'reversal' && !t.reversedBy)
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
    const namedCategory = categories.find((c: any) => q.includes(String(c.name || '').toLocaleLowerCase()));
    const searchTerms = q
      .replace(/\b(show|list|find|search|my|recent|latest|last|transactions?|entries|payments?|purchases?|receipts?|for|from|in|the|a|an|of|what|were|was|did|i|spend|spent|pay|paid)\b/g, ' ')
      .split(/\s+/).filter((term) => term.length >= 3);
    const matches = all.filter((t: any) => {
      const categoryName = t.categoryId ? h.categoryById(t.categoryId)?.name : '';
      const haystack = [t.payee, t.description, t.notes, categoryName].join(' ').toLocaleLowerCase();
      return (!namedCategory || t.categoryId === namedCategory.id) &&
        (!searchTerms.length || searchTerms.some((term) => haystack.includes(term)));
    });
    const requested = q.match(/\b(?:last|latest)\s+(\d{1,2})\b/);
    const limit = Math.min(20, Math.max(1, requested ? Number(requested[1]) : 5));
    if (!matches.length) return 'I could not find matching transactions in your recorded ledger.';
    return 'Matching ledger entries:\\n' + matches.slice(0, limit).map((t: any) => {
      const categoryName = t.categoryId ? h.categoryById(t.categoryId)?.name : 'Uncategorised';
      const amount = money(t.amountCents || 0);
      return String(t.date || 'Date not recorded') + ' — ' + (t.payee || t.description || 'Entry') + ' — ' + categoryName + ' — ' + amount + ' (' + t.type + ')';
    }).join('\\n');
  }

  if (/\b(safe to spend|spendable|available to spend|how much can i spend)\b/.test(q)) {
    return 'Your safe-to-spend amount is ' + money(safe.safe) + '. This starts with liquid funds of ' + money(safe.liquid) + ', then subtracts upcoming bills (' + money(safe.bills) + '), goal reserves (' + money(safe.reserved) + '), and your buffer (' + money(safe.buffer) + ') over the next ' + safe.window + ' days.';
  }

  const previous = /\b(last month|previous month)\b/.test(q);
  const monthKey = previous ? h.addMonthsKey(month, -1) : month;
  const selectedTotals = previous ? h.monthTotals(monthKey) : totals;
  const selectedBudget = previous ? h.budgetTotals(monthKey) : budget;
  const label = monthLabel(monthKey);
  const asksIncome = /\b(income|earned|earnings|received)\b/.test(q);
  const asksExpense = /\b(spend|spends|spent|spending|expenses?|expense total)\b/.test(q);
  const asksNet = /\b(net|surplus|deficit|cash ?flow)\b/.test(q);

  if (/\b(top|highest|most|biggest)\b/.test(q) && /\b(category|categories|spend|spending|spent)\b/.test(q)) {
    const ranked = [...selectedTotals.byCategory.entries()]
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return 'There is no recorded category spending for ' + label + '.';
    const [categoryId, amount] = ranked[0];
    const category = h.categoryById(categoryId);
    return 'Your highest spending category for ' + label + ' is ' + (category?.name || 'Uncategorized') + ' at ' + money(amount) + '.';
  }

  if (asksIncome && asksExpense && !asksNet) {
    const net = selectedTotals.income - selectedTotals.expense;
    return 'For ' + label + ', recorded income was ' + money(selectedTotals.income) + ', expenses were ' + money(selectedTotals.expense) + ', and the net result was ' + money(Math.abs(net)) + (net >= 0 ? ' surplus.' : ' deficit.');
  }
  if (asksIncome && !asksExpense && !asksNet) return 'Your recorded income for ' + label + ' is ' + money(selectedTotals.income) + '.';
  if (asksExpense && !asksIncome && !asksNet) {
    const category = categories.find((c: any) => c.type === 'expense' && q.includes(String(c.name || '').toLocaleLowerCase()));
    if (category) {
      const amount = selectedTotals.byCategory.get(category.id) || 0;
      return 'You spent ' + money(amount) + ' in ' + category.name + ' during ' + label + '.';
    }
    return 'Your recorded expenses for ' + label + ' total ' + money(selectedTotals.expense) + '.';
  }
  if (asksNet) {
    const net = selectedTotals.income - selectedTotals.expense;
    return 'For ' + label + ', income was ' + money(selectedTotals.income) + ' and expenses were ' + money(selectedTotals.expense) + ', leaving a net ' + (net >= 0 ? 'surplus' : 'deficit') + ' of ' + money(Math.abs(net)) + '.';
  }

  if (/\b(budget|budgets|overspent|over budget)\b/.test(q)) {
    if (!selectedBudget.rows?.length) return 'There are no budget limits recorded for ' + label + '.';
    const rows = selectedBudget.rows as any[];
    const over = rows.filter((r) => r.spentCents > r.limitCents);
    const remaining = selectedBudget.limit - selectedBudget.spent;
    const summary = 'For ' + label + ', you have used ' + money(selectedBudget.spent) + ' of ' + money(selectedBudget.limit) + ' in recorded budgets; ' + (remaining >= 0 ? money(remaining) + ' remains' : money(Math.abs(remaining)) + ' over budget') + '.';
    if (/overspent|over budget/.test(q)) {
      return over.length
        ? summary + ' Over-budget categories: ' + over.map((r) => (r.category?.name || 'Unnamed') + ' (' + money(r.spentCents - r.limitCents) + ' over)').join(', ') + '.'
        : summary + ' No budget category is currently over its limit.';
    }
    return summary;
  }

  if (/\b(account|accounts|wallets)\b/.test(q) && /\b(list|show|which|my|balances?)\b/.test(q)) {
    if (!accounts.length) return 'There are no active accounts in your ledger.';
    return 'Your active account balances: ' + accounts.map((a: any) => a.name + ': ' + money(h.accountBalance(a.id))).join('; ') + '.';
  }
  return null;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI request failed.');
  return data as T;
}

function injectStyles() {
  if (document.getElementById('lw-ai-styles')) return;
  const style = document.createElement('style');
  style.id = 'lw-ai-styles';
  style.textContent = `
    .lw-ai-fab {
      position: fixed; right: 22px; bottom: 22px; z-index: 950;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 999px;
      border: 1px solid var(--line-strong, #d3c6b2);
      background: var(--forest, #173f2e); color: #f6f1e6;
      font-family: var(--font-body, Inter, system-ui, sans-serif);
      font-size: 13px; font-weight: 600; cursor: pointer;
      box-shadow: var(--shadow-lg, 0 18px 40px rgba(14,43,31,.22));
      transition: transform .16s ease, opacity .16s ease;
    }
    .lw-ai-fab:hover { transform: translateY(-1px); opacity: .96; }
    @media (max-width: 860px) { .lw-ai-fab { bottom: 76px; right: 14px; padding: 9px 14px; } }
    .lw-ai-backdrop {
      position: fixed; inset: 0; z-index: 960;
      background: rgba(14, 24, 19, 0.45); backdrop-filter: blur(2px); display: none;
    }
    .lw-ai-backdrop.open { display: block; }
    .lw-ai-drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 970;
      width: min(490px, 100vw);
      background: var(--card, #fffcf6); color: var(--ink, #1a2b22);
      border-left: 1px solid var(--line, #e3dac9);
      box-shadow: var(--shadow-lg, 0 24px 70px rgba(14,43,31,.18));
      display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform .22s cubic-bezier(.2,.7,.2,1);
      font-family: var(--font-body, Inter, system-ui, sans-serif);
    }
    .lw-ai-drawer.open { transform: translateX(0); }
    .lw-ai-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 15px 18px; border-bottom: 1px solid var(--line, #e3dac9);
      background: var(--card-soft, #f9f4e9);
    }
    .lw-ai-title {
      font-family: var(--font-display, Georgia, serif);
      font-size: 18px; font-weight: 500; margin: 0; color: var(--ink, #1a2b22);
    }
    .lw-ai-sub { font-size: 11.5px; color: var(--muted, #6d796f); margin: 2px 0 0; }
    .lw-ai-close {
      background: transparent; border: 1px solid var(--line, #e3dac9);
      color: var(--ink-soft, #34453a); width: 30px; height: 30px;
      border-radius: 8px; cursor: pointer; font-size: 16px; line-height: 1;
    }
    .lw-ai-tabs {
      display: flex; gap: 4px; padding: 8px 12px;
      border-bottom: 1px solid var(--line, #e3dac9);
      background: var(--card-soft, #f9f4e9);
      overflow-x: auto;
    }
    .lw-ai-tab {
      border: 1px solid transparent; background: transparent;
      color: var(--muted, #6d796f); font-family: inherit;
      font-size: 12px; font-weight: 600; padding: 6px 10px;
      border-radius: 8px; cursor: pointer; white-space: nowrap;
    }
    .lw-ai-tab.active {
      background: var(--card, #fffcf6); color: var(--ink, #1a2b22);
      border-color: var(--line, #e3dac9);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.05));
    }
    .lw-ai-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; font-weight: 600; padding: 2px 7px;
      border-radius: 999px; background: var(--sage-pale, #eef4ea);
      color: var(--forest, #173f2e); border: 1px solid var(--mint, #bfe5cd);
    }
    .lw-ai-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #10b981; display: inline-block;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }
    .lw-ai-search-toggle {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 8px; font-size: 11px;
      font-weight: 600; border: 1px solid var(--line, #e3dac9);
      background: var(--card, #fffcf6); color: var(--muted, #6d796f);
      cursor: pointer;
    }
    .lw-ai-search-toggle strong { color: var(--forest, #173f2e); }
    .lw-ai-pill-group { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
    .lw-ai-pill-btn {
      font-size: 11px; font-weight: 600; padding: 4px 9px;
      border-radius: 999px; border: 1px solid var(--line, #e3dac9);
      background: var(--card, #fffcf6); color: var(--muted, #6d796f);
      cursor: pointer; white-space: nowrap;
    }
    .lw-ai-pill-btn:hover { color: var(--ink, #1a2b22); border-color: var(--line-strong, #d3c6b2); }
    .lw-ai-pill-btn.active {
      background: var(--forest-soft, #e4eddf); color: var(--forest, #173f2e);
      border-color: var(--forest, #173f2e);
    }
    .lw-ai-body { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
    .lw-ai-panel { display: none; flex-direction: column; gap: 13px; flex: 1; }
    .lw-ai-panel.active { display: flex; }
    .lw-ai-card {
      background: var(--card-soft, #f9f4e9); border: 1px solid var(--line, #e3dac9);
      border-radius: 14px; padding: 13px 14px;
    }
    .lw-ai-card h3 {
      margin: 0 0 6px; font-family: var(--font-display, Georgia, serif);
      font-size: 15px; font-weight: 500; color: var(--ink, #1a2b22);
    }
    .lw-ai-muted { font-size: 12.5px; color: var(--muted, #6d796f); margin: 0; line-height: 1.45; }
    .lw-ai-label { display: block; font-size: 11.5px; font-weight: 600; color: var(--ink-soft, #34453a); margin-bottom: 4px; }
    .lw-ai-input, .lw-ai-textarea, .lw-ai-select {
      width: 100%; box-sizing: border-box;
      padding: 8px 11px; border-radius: 10px;
      border: 1px solid var(--line-strong, #d3c6b2);
      background: var(--card, #fffcf6); color: var(--ink, #1a2b22);
      font-family: inherit; font-size: 13px;
    }
    .lw-ai-textarea { resize: vertical; min-height: 68px; }
    .lw-ai-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .lw-ai-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 14px; border-radius: 10px; border: none;
      background: var(--forest, #173f2e); color: #f6f1e6;
      font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
    }
    .lw-ai-btn:disabled { opacity: .5; cursor: not-allowed; }
    .lw-ai-btn-sec {
      background: var(--card, #fffcf6); color: var(--ink, #1a2b22);
      border: 1px solid var(--line-strong, #d3c6b2);
    }
    .lw-ai-drop {
      border: 1.5px dashed var(--line-strong, #d3c6b2); border-radius: 12px;
      padding: 14px; text-align: center; cursor: pointer;
      background: var(--card, #fffcf6); font-size: 12.5px; color: var(--muted, #6d796f);
    }
    .lw-ai-drop:hover { border-color: var(--forest, #173f2e); color: var(--ink, #1a2b22); }
    .lw-ai-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; min-height: 220px; }
    .lw-ai-msg {
      max-width: 92%; padding: 9px 12px; border-radius: 12px;
      font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
    }
    .lw-ai-msg.user { align-self: flex-end; background: var(--forest, #173f2e); color: #f6f1e6; }
    .lw-ai-msg.model { align-self: flex-start; background: var(--card-soft, #f9f4e9); border: 1px solid var(--line, #e3dac9); color: var(--ink, #1a2b22); }
    .lw-ai-err {
      padding: 9px 12px; border-radius: 10px; font-size: 12.5px;
      background: var(--negative-soft, #f7e6e1); color: var(--negative, #a34b3f);
      border: 1px solid var(--line, #e3dac9);
    }
    .lw-ai-score {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 48px; height: 48px; border-radius: 12px;
      background: var(--forest-soft, #e4eddf); color: var(--forest, #173f2e);
      font-family: var(--font-mono, monospace); font-size: 18px; font-weight: 600;
    }
    .lw-ai-list { margin: 6px 0 0; padding-left: 18px; font-size: 12.5px; line-height: 1.55; color: var(--ink-soft, #34453a); }
    .lw-ai-item-row {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
      padding: 9px 0; border-bottom: 1px solid var(--line-soft, #ece4d6); font-size: 12.5px;
    }
    .lw-ai-item-row:last-child { border-bottom: none; }
    .lw-ai-mono { font-family: var(--font-mono, monospace); }
    .lw-ai-sev-high { color: var(--negative, #a34b3f); font-weight: 700; font-size: 11px; text-transform: uppercase; }
    .lw-ai-sev-medium { color: var(--warning, #9a6b25); font-weight: 700; font-size: 11px; text-transform: uppercase; }
    .lw-ai-sev-low { color: var(--positive, #2b6a4b); font-weight: 700; font-size: 11px; text-transform: uppercase; }
    @media print { .lw-ai-fab, .lw-ai-backdrop, .lw-ai-drawer { display: none !important; } }
  `;
  document.head.appendChild(style);
}

function mountAiSuite() {
  injectStyles();

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'lw-ai-fab no-print';
  fab.setAttribute('aria-label', 'Open Ledgerwise AI');
  fab.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg><span>Ledgerwise AI</span>`;

  const backdrop = document.createElement('div');
  backdrop.className = 'lw-ai-backdrop no-print';

  const drawer = document.createElement('aside');
  drawer.className = 'lw-ai-drawer no-print';
  drawer.setAttribute('aria-label', 'Ledgerwise AI Suite');
  drawer.innerHTML = `
    <div class="lw-ai-head">
      <div>
        <div style="display:flex;align-items:center;gap:7px">
          <h2 class="lw-ai-title">Ledgerwise AI Desk</h2>
          <span class="lw-ai-badge" id="lw-ai-status-badge"><span class="lw-ai-dot"></span> Local Grounded</span>
        </div>
        <p class="lw-ai-sub" id="lw-ai-status">Live Workspace Connected · Zero Web Search</p>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button type="button" class="lw-ai-search-toggle" id="lw-search-toggle" title="Toggle web search (Off gives instant responses with zero rate limits)">
          <span>Web search: <strong id="lw-search-label">Off</strong></span>
        </button>
        <button type="button" class="lw-ai-close" id="lw-ai-close" aria-label="Close AI panel">&times;</button>
      </div>
    </div>

    <div class="lw-ai-tabs" role="tablist">
      <button type="button" class="lw-ai-tab active" data-ai-tab="entry">Quick Entry &amp; Scan</button>
      <button type="button" class="lw-ai-tab" data-ai-tab="categorize">Auto-Cat</button>
      <button type="button" class="lw-ai-tab" data-ai-tab="review">Monthly Review</button>
      <button type="button" class="lw-ai-tab" data-ai-tab="coach">Coach</button>
      <button type="button" class="lw-ai-tab" data-ai-tab="chat">Chat</button>
    </div>

    <div class="lw-ai-body">
      <!-- TAB 1: NATURAL LANGUAGE ENTRY + RECEIPT SCANNER -->
      <section class="lw-ai-panel active" data-ai-panel="entry">
        <div class="lw-ai-card">
          <h3>Natural-Language Entry</h3>
          <p class="lw-ai-muted">Describe a transaction in plain words and post it directly as a balanced double-entry record.</p>
          <textarea id="lw-nl-input" class="lw-ai-textarea" style="margin-top:8px" placeholder="e.g. Spent 1,850 at Naivas on groceries from M-Pesa yesterday"></textarea>
          <div style="margin-top:8px;display:flex;gap:8px">
            <button type="button" id="lw-nl-btn" class="lw-ai-btn">Parse Entry</button>
          </div>
        </div>

        <div class="lw-ai-card">
          <h3>Receipt &amp; Screenshot Scanner</h3>
          <p class="lw-ai-muted">Upload a receipt photo or M-Pesa / bank screenshot to extract vendor, date, total, and category.</p>
          <label class="lw-ai-drop" style="display:block;margin-top:8px" for="lw-scan-file">
            <span id="lw-scan-label">Click to select receipt or screenshot (JPG, PNG, WebP)</span>
            <input type="file" id="lw-scan-file" accept="image/*" style="display:none" />
          </label>
        </div>

        <div id="lw-entry-result"></div>
      </section>

      <!-- TAB 2: SMART AUTO-CATEGORIZATION -->
      <section class="lw-ai-panel" data-ai-panel="categorize">
        <div class="lw-ai-card">
          <h3>Smart Auto-Categorization</h3>
          <p class="lw-ai-muted">Scans uncategorised or recent transactions and suggests accurate categories from your Ledgerwise chart of categories.</p>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" id="lw-cat-uncat-btn" class="lw-ai-btn">Categorize Uncategorised</button>
            <button type="button" id="lw-cat-recent-btn" class="lw-ai-btn lw-ai-btn-sec">Review Last 15 Entries</button>
          </div>
        </div>
        <div id="lw-cat-result"></div>
      </section>

      <!-- TAB 3: MONTHLY AI REVIEW & ANOMALY ALERTS -->
      <section class="lw-ai-panel" data-ai-panel="review">
        <div class="lw-ai-card">
          <h3>Monthly Financial Review &amp; Anomalies</h3>
          <p class="lw-ai-muted">Analyses your active month's income, spending, budget variances, and unusual spikes compared to last month.</p>
          <button type="button" id="lw-review-btn" class="lw-ai-btn" style="margin-top:10px">Run Monthly Review</button>
        </div>
        <div id="lw-review-result"></div>
      </section>

      <!-- TAB 4: AI BUDGET COACH & DEBT PAYOFF ADVISOR -->
      <section class="lw-ai-panel" data-ai-panel="coach">
        <div class="lw-ai-card">
          <h3>Budget Coach &amp; Debt Payoff Advisor</h3>
          <p class="lw-ai-muted">Tailors budget limits and debt payoff strategy to your live Safe-to-Spend, recurring obligations, goals, and APRs.</p>
          <button type="button" id="lw-coach-btn" class="lw-ai-btn" style="margin-top:10px">Generate Coaching Plan</button>
        </div>
        <div id="lw-coach-result"></div>
      </section>

      <!-- TAB 5: CHAT ASSISTANT -->
      <section class="lw-ai-panel" data-ai-panel="chat">
        <div class="lw-ai-pill-group" style="margin-bottom:6px">
          <button type="button" class="lw-ai-pill-btn active" data-chat-persona="cfo">Finance CFO</button>
          <button type="button" class="lw-ai-pill-btn" data-chat-persona="coach">Budget Coach</button>
          <button type="button" class="lw-ai-pill-btn" data-chat-persona="auditor">Ledger Auditor</button>
          <button type="button" class="lw-ai-pill-btn" data-chat-persona="analyst">Cashflow Analyst</button>
        </div>
        <div class="lw-ai-pill-group" style="margin-bottom:8px">
          <button type="button" class="lw-ai-pill-btn" data-quick-prompt="Summarize my current month spending and top expense categories">📊 Month Summary</button>
          <button type="button" class="lw-ai-pill-btn" data-quick-prompt="What is my true Safe-to-Spend liquidity right now?">💰 Safe-to-Spend</button>
          <button type="button" class="lw-ai-pill-btn" data-quick-prompt="Which budget categories are at risk of overrun this month?">⚠️ Budget Check</button>
        </div>
        <div class="lw-ai-messages" id="lw-chat-messages">
          <div class="lw-ai-msg model">Ledgerwise AI Desk is active. Web search is off for zero rate limits and instant continuous conversation. Ask about your balances, spending trends, budgets, or bills.</div>
        </div>
        <form id="lw-chat-form" style="display:flex;gap:8px;margin-top:auto;padding-top:8px;border-top:1px solid var(--line,#e3dac9)">
          <input type="text" id="lw-chat-input" class="lw-ai-input" placeholder="Ask about your ledger…" autocomplete="off" />
          <button type="submit" id="lw-chat-send" class="lw-ai-btn">Send</button>
        </form>
      </section>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const statusEl = drawer.querySelector('#lw-ai-status') as HTMLElement;
  const closeEl = drawer.querySelector('#lw-ai-close') as HTMLButtonElement;

  const setTab = (tabName: string) => {
    drawer.querySelectorAll('.lw-ai-tab').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.aiTab === tabName);
    });
    drawer.querySelectorAll('.lw-ai-panel').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.aiPanel === tabName);
    });
  };

  drawer.querySelectorAll('.lw-ai-tab').forEach((btn) => {
    btn.addEventListener('click', () => setTab((btn as HTMLElement).dataset.aiTab || 'entry'));
  });

  const openDrawer = (tab?: string) => {
    if (tab) setTab(tab);
    backdrop.classList.add('open');
    drawer.classList.add('open');
  };
  const closeDrawer = () => {
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
  };

  fab.addEventListener('click', () => openDrawer());
  backdrop.addEventListener('click', closeDrawer);
  closeEl.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  // Check backend status
  let webSearchEnabled = false;
  const searchToggle = drawer.querySelector('#lw-search-toggle') as HTMLElement;
  const searchLabel = drawer.querySelector('#lw-search-label') as HTMLElement;
  const statusBadge = drawer.querySelector('#lw-ai-status-badge') as HTMLElement;

  if (searchToggle && searchLabel) {
    searchToggle.addEventListener('click', () => {
      webSearchEnabled = !webSearchEnabled;
      searchLabel.textContent = webSearchEnabled ? 'On' : 'Off';
      searchToggle.style.borderColor = webSearchEnabled ? 'var(--brass, #b3874a)' : 'var(--line, #e3dac9)';
      const h = lw();
      if (h) h.toast(webSearchEnabled ? 'Web search enabled' : 'Web search OFF: zero rate limits active', 'success');
    });
  }

  fetch('/api/ai/status')
    .then((r) => r.json())
    .then(() => {
      statusEl.textContent = 'Live Workspace Connected · Zero Web Search';
      if (statusBadge) {
        statusBadge.innerHTML = '<span class="lw-ai-dot"></span> Local Grounded';
      }
    })
    .catch(() => {
      statusEl.textContent = 'Local Ledger Mode (Offline)';
    });

  /* ---------------------------------------------------------------
     Persona pills: toggle active + set currentPersona for chat system prompt
     --------------------------------------------------------------- */
  let currentPersona = 'cfo';
  const PERSONA_PROMPTS: Record<string, string> = {
    cfo:     'You are a Chief Financial Officer reviewing this personal ledger. Speak with precision, focus on P&L, net worth trajectory, and risk.',
    coach:   'You are a friendly budget coach. Keep advice motivational and actionable. Focus on spending habits and savings goals.',
    auditor: 'You are a meticulous ledger auditor. Surface any discrepancies, missing categories, unbalanced entries, or duplicates.',
    analyst: 'You are a cashflow analyst. Focus on cash timing, liquidity gaps, recurring obligations, and safe-to-spend calculations.',
  };

  drawer.querySelectorAll<HTMLButtonElement>('[data-chat-persona]').forEach((pill) => {
    pill.addEventListener('click', () => {
      drawer.querySelectorAll('[data-chat-persona]').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentPersona = pill.dataset.chatPersona || 'cfo';
      const h = lw();
      const label = pill.textContent?.trim() || currentPersona;
      if (h) h.toast(`Persona: ${label}`, 'success');
    });
  });

  /* ---------------------------------------------------------------
     Quick prompt chips: fill input and auto-submit
     --------------------------------------------------------------- */
  drawer.querySelectorAll<HTMLButtonElement>('[data-quick-prompt]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const chatInput = drawer.querySelector<HTMLInputElement>('#lw-chat-input');
      const chatForm  = drawer.querySelector<HTMLFormElement>('#lw-chat-form');
      if (!chatInput || !chatForm) return;
      chatInput.value = chip.dataset.quickPrompt || '';
      chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  });

  /* ---------------------------------------------------------------
     Feature 1 & 2: Natural-Language Entry + Receipt Scanner Preview & Post
     --------------------------------------------------------------- */
  const entryResultEl = drawer.querySelector('#lw-entry-result') as HTMLElement;

  function renderParsedDraft(parsed: ParsedTx) {
    const h = lw();
    const state = h?.getState();
    if (!h || !state) {
      entryResultEl.innerHTML = `<div class="lw-ai-err">Open or load a Ledgerwise workspace first before posting transactions.</div>`;
      return;
    }
    const accounts = h.activeAccounts();
    const expCats = h.categoriesOf('expense');
    const incCats = h.categoriesOf('income');
    const cur = state.profile?.currency || 'KES';

    const resolvedType: 'expense' | 'income' | 'transfer' =
      parsed.type === 'income' || parsed.type === 'transfer' ? parsed.type : 'expense';
    const validAccountId = accounts.some((a: any) => a.id === parsed.accountId)
      ? parsed.accountId
      : accounts[0]?.id || '';
    const validToId = accounts.some((a: any) => a.id === parsed.toAccountId)
      ? parsed.toAccountId
      : accounts[1]?.id || accounts[0]?.id || '';
    const catList = resolvedType === 'income' ? incCats : expCats;
    const validCatId = catList.some((c: any) => c.id === parsed.categoryId)
      ? parsed.categoryId
      : catList[0]?.id || '';

    const normalizeIsoDate = (raw: string | undefined, fallback: string) => {
      const s = String(raw || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
      if (m) {
        const y = Number(m[3]) < 100 ? Number(m[3]) + 2000 : Number(m[3]);
        return `${y}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
      }
      return fallback;
    };

    const resolvedDate = normalizeIsoDate(parsed.date, h.todayISO());

    const renderTargetField = (t: 'expense' | 'income' | 'transfer') => {
      if (t === 'transfer') {
        return `<label class="lw-ai-label">To Account</label>
          <select id="lw-draft-to" class="lw-ai-select">${accounts.map((a: any) => `<option value="${esc(a.id)}" ${a.id === validToId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`;
      }
      const list = t === 'income' ? incCats : expCats;
      const chosen = list.some((c: any) => c.id === parsed.categoryId) ? parsed.categoryId : list[0]?.id || '';
      return `<label class="lw-ai-label">Category</label>
        <select id="lw-draft-cat" class="lw-ai-select">${list.map((c: any) => `<option value="${esc(c.id)}" ${c.id === chosen ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
    };

    entryResultEl.innerHTML = `
      <div class="lw-ai-card">
        <h3>Parsed Transaction Draft</h3>
        <p class="lw-ai-muted" style="margin-bottom:10px">${esc(parsed.explanation || 'Review and post to your double-entry ledger.')}</p>
        <div class="lw-ai-row">
          <div>
            <label class="lw-ai-label">Type</label>
            <select id="lw-draft-type" class="lw-ai-select">
              <option value="expense" ${resolvedType === 'expense' ? 'selected' : ''}>Expense</option>
              <option value="income" ${resolvedType === 'income' ? 'selected' : ''}>Income</option>
              <option value="transfer" ${resolvedType === 'transfer' ? 'selected' : ''}>Transfer</option>
            </select>
          </div>
          <div>
            <label class="lw-ai-label">Date</label>
            <input id="lw-draft-date" type="date" class="lw-ai-input lw-ai-mono" value="${esc(resolvedDate)}" />
          </div>
        </div>
        <div class="lw-ai-row" style="margin-top:8px">
          <div>
            <label class="lw-ai-label">Amount (${esc(cur)})</label>
            <input id="lw-draft-amount" type="number" step="0.01" class="lw-ai-input lw-ai-mono" value="${esc(parsed.amountMajor || '')}" />
          </div>
          <div>
            <label class="lw-ai-label">Payee</label>
            <input id="lw-draft-payee" type="text" class="lw-ai-input" value="${esc(parsed.payee || '')}" />
          </div>
        </div>
        <div style="margin-top:8px">
          <label class="lw-ai-label">Description</label>
          <input id="lw-draft-desc" type="text" class="lw-ai-input" value="${esc(parsed.description || '')}" />
        </div>
        <div class="lw-ai-row" style="margin-top:8px">
          <div>
            <label class="lw-ai-label">Account</label>
            <select id="lw-draft-account" class="lw-ai-select">
              ${accounts.map((a: any) => `<option value="${esc(a.id)}" ${a.id === validAccountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select>
          </div>
          <div id="lw-draft-target-wrap">
            ${renderTargetField(resolvedType)}
          </div>
        </div>
        <div style="margin-top:8px">
          <label class="lw-ai-label">Notes</label>
          <input id="lw-draft-notes" type="text" class="lw-ai-input" value="${esc(parsed.notes || '')}" />
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button type="button" id="lw-draft-post" class="lw-ai-btn">Post to Ledger</button>
          <button type="button" id="lw-draft-clear" class="lw-ai-btn lw-ai-btn-sec">Discard</button>
        </div>
      </div>
    `;

    entryResultEl.querySelector('#lw-draft-type')?.addEventListener('change', (ev) => {
      const nextType = (ev.target as HTMLSelectElement).value as 'expense' | 'income' | 'transfer';
      const wrap = entryResultEl.querySelector('#lw-draft-target-wrap');
      if (wrap) wrap.innerHTML = renderTargetField(nextType);
    });

    entryResultEl.querySelector('#lw-draft-clear')?.addEventListener('click', () => {
      entryResultEl.innerHTML = '';
    });

    entryResultEl.querySelector('#lw-draft-post')?.addEventListener('click', () => {
      try {
        const type = (entryResultEl.querySelector('#lw-draft-type') as HTMLSelectElement).value as 'expense' | 'income' | 'transfer';
        const date = (entryResultEl.querySelector('#lw-draft-date') as HTMLInputElement).value || h.todayISO();
        const amountMajor = Number((entryResultEl.querySelector('#lw-draft-amount') as HTMLInputElement).value);
        const amountCents = Math.round(amountMajor * 100);
        const payee = (entryResultEl.querySelector('#lw-draft-payee') as HTMLInputElement).value.trim();
        const description = (entryResultEl.querySelector('#lw-draft-desc') as HTMLInputElement).value.trim() || payee || 'AI entry';
        const accountId = (entryResultEl.querySelector('#lw-draft-account') as HTMLSelectElement).value;
        const toEl = entryResultEl.querySelector('#lw-draft-to') as HTMLSelectElement | null;
        const catEl = entryResultEl.querySelector('#lw-draft-cat') as HTMLSelectElement | null;
        const notes = (entryResultEl.querySelector('#lw-draft-notes') as HTMLInputElement).value.trim();

        if (!Number.isFinite(amountCents) || amountCents <= 0) {
          throw new Error('Enter a valid amount greater than zero.');
        }

        const tx = h.postTransaction({
          type,
          date,
          amountCents,
          payee,
          description,
          accountId,
          toAccountId: type === 'transfer' ? toEl?.value || null : null,
          categoryId: type === 'transfer' ? null : catEl?.value || null,
          notes,
          source: 'ai',
        });
        h.persist('ai-entry', `AI posted ${tx.ref}: ${tx.description}`);
        if (typeof h.revealTransaction === 'function') {
          h.revealTransaction(tx.id);
          h.toast(`Posted ${tx.ref} (${tx.date}) to ledger`, 'success');
        } else {
          h.refresh(`Posted ${tx.ref} to ledger`, 'success');
        }
        entryResultEl.innerHTML = `
          <div class="lw-ai-card">
            <p class="lw-ai-muted" style="color:var(--positive,#2b6a4b);font-weight:600">Posted ${esc(tx.ref)} (${esc(tx.description)}) dated ${esc(tx.date)}.</p>
            <button type="button" id="lw-draft-view" class="lw-ai-btn lw-ai-btn-sec" style="margin-top:8px">Show in Transactions</button>
          </div>
        `;
        entryResultEl.querySelector('#lw-draft-view')?.addEventListener('click', () => {
          h.revealTransaction?.(tx.id);
          closeDrawer();
        });
      } catch (err) {
        h.toast(err instanceof Error ? err.message : 'Unable to post entry', 'error');
      }
    });
  }

  // Natural-language parse button
  const nlBtn = drawer.querySelector('#lw-nl-btn') as HTMLButtonElement;
  const nlInput = drawer.querySelector('#lw-nl-input') as HTMLTextAreaElement;
  nlBtn.addEventListener('click', async () => {
    const h = lw();
    const state = h?.getState();
    const text = nlInput.value.trim();
    if (!text) return;
    if (!h || !state) {
      entryResultEl.innerHTML = `<div class="lw-ai-err">Load or sign into your Ledgerwise workspace first.</div>`;
      return;
    }
    nlBtn.disabled = true;
    nlBtn.textContent = 'Parsing…';
    entryResultEl.innerHTML = '';
    try {
      const { parsed } = await postJson<{ parsed: ParsedTx }>('/api/ai/parse-transaction', {
        text,
        today: h.todayISO(),
        currency: state.profile?.currency || 'KES',
        accounts: h.activeAccounts().map((a: any) => ({ id: a.id, name: a.name, type: a.type })),
        categories: [...h.categoriesOf('expense'), ...h.categoriesOf('income')].map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        })),
      });
      renderParsedDraft(parsed);
    } catch (err) {
      entryResultEl.innerHTML = `<div class="lw-ai-err">${esc(err instanceof Error ? err.message : 'Parse failed')}</div>`;
    } finally {
      nlBtn.disabled = false;
      nlBtn.textContent = 'Parse Entry';
    }
  });

  // Receipt / Screenshot Scanner
  const scanFileEl = drawer.querySelector('#lw-scan-file') as HTMLInputElement;
  const scanLabelEl = drawer.querySelector('#lw-scan-label') as HTMLElement;
  scanFileEl.addEventListener('change', async () => {
    const file = scanFileEl.files?.[0];
    scanFileEl.value = '';
    if (!file) return;
    const h = lw();
    const state = h?.getState();
    if (!h || !state) {
      entryResultEl.innerHTML = `<div class="lw-ai-err">Load or sign into your Ledgerwise workspace first.</div>`;
      return;
    }

    scanLabelEl.textContent = `Scanning ${file.name}…`;
    entryResultEl.innerHTML = '';
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || '');
          const idx = res.indexOf(',');
          resolve(idx >= 0 ? res.slice(idx + 1) : res);
        };
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
      });

      const { parsed } = await postJson<{ parsed: ParsedTx }>('/api/ai/scan-receipt', {
        imageBase64: base64,
        mimeType: file.type || 'image/jpeg',
        today: h.todayISO(),
        currency: state.profile?.currency || 'KES',
        accounts: h.activeAccounts().map((a: any) => ({ id: a.id, name: a.name, type: a.type })),
        categories: [...h.categoriesOf('expense'), ...h.categoriesOf('income')].map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        })),
      });
      renderParsedDraft(parsed);
    } catch (err) {
      entryResultEl.innerHTML = `<div class="lw-ai-err">${esc(err instanceof Error ? err.message : 'Scan failed')}</div>`;
    } finally {
      scanLabelEl.textContent = 'Click to select receipt or screenshot (JPG, PNG, WebP)';
    }
  });

  /* ---------------------------------------------------------------
     Feature 3: Smart Auto-Categorization
     --------------------------------------------------------------- */
  const catResultEl = drawer.querySelector('#lw-cat-result') as HTMLElement;

  async function runAutoCategorize(mode: 'uncategorized' | 'recent') {
    const h = lw();
    const state = h?.getState();
    if (!h || !state) {
      catResultEl.innerHTML = `<div class="lw-ai-err">Load your Ledgerwise workspace first.</div>`;
      return;
    }

    const candidates = [...(state.transactions || [])]
      .filter((tx: any) => (tx.type === 'expense' || tx.type === 'income') && !tx.reversedBy)
      .filter((tx: any) =>
        mode === 'uncategorized'
          ? !tx.categoryId || tx.categoryId === 'cat_other' || tx.categoryId === 'cat_other_income'
          : true
      )
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 15);

    if (!candidates.length) {
      catResultEl.innerHTML = `<div class="lw-ai-card"><p class="lw-ai-muted">No uncategorised transactions found. Try "Review Last 15 Entries" to audit recent classifications.</p></div>`;
      return;
    }

    catResultEl.innerHTML = `<div class="lw-ai-card"><p class="lw-ai-muted">Analysing ${candidates.length} transactions…</p></div>`;
    try {
      const categories = [...h.categoriesOf('expense'), ...h.categoriesOf('income')].map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));
      const { assignments } = await postJson<{ assignments: CatAssignment[] }>('/api/ai/categorize', {
        items: candidates.map((tx: any) => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          payee: tx.payee,
          amountMajor: (tx.amountCents || 0) / 100,
          type: tx.type,
        })),
        categories,
      });

      const changed = assignments.filter((a) => {
        const tx = state.transactions.find((t: any) => t.id === a.id);
        return tx && a.categoryId && tx.categoryId !== a.categoryId;
      });

      if (!changed.length) {
        catResultEl.innerHTML = `<div class="lw-ai-card"><p class="lw-ai-muted">All ${candidates.length} checked transactions already match their best category.</p></div>`;
        return;
      }

      catResultEl.innerHTML = `
        <div class="lw-ai-card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
            <h3 style="margin:0">${changed.length} Suggested Updates</h3>
            <button type="button" id="lw-cat-apply-all" class="lw-ai-btn">Apply All</button>
          </div>
          ${changed
            .map((a) => {
              const tx = state.transactions.find((t: any) => t.id === a.id);
              const oldCat = tx?.categoryId ? h.categoryById(tx.categoryId)?.name : 'None';
              return `
                <div class="lw-ai-item-row">
                  <div>
                    <div style="font-weight:600">${esc(tx?.payee || tx?.description || a.id)}</div>
                    <div class="lw-ai-muted">${esc(oldCat)} &rarr; <strong style="color:var(--forest,#173f2e)">${esc(a.categoryName)}</strong></div>
                    <div class="lw-ai-muted" style="font-size:11.5px">${esc(a.reason)}</div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;

      catResultEl.querySelector('#lw-cat-apply-all')?.addEventListener('click', () => {
        let applied = 0;
        for (const a of changed) {
          const tx = state.transactions.find((t: any) => t.id === a.id);
          const cat = h.categoryById(a.categoryId);
          if (!tx || !cat || cat.type !== tx.type) continue;
          tx.categoryId = cat.id;
          for (const entry of tx.entries || []) {
            if (entry.categoryId) {
              entry.categoryId = cat.id;
              entry.memo = cat.name;
            }
          }
          applied += 1;
        }
        h.persist('ai-categorize', `AI auto-categorised ${applied} transactions.`);
        h.refresh(`Updated ${applied} categories`, 'success');
        catResultEl.innerHTML = `<div class="lw-ai-card"><p class="lw-ai-muted" style="color:var(--positive,#2b6a4b);font-weight:600">Applied ${applied} category updates to your ledger.</p></div>`;
      });
    } catch (err) {
      catResultEl.innerHTML = `<div class="lw-ai-err">${esc(err instanceof Error ? err.message : 'Categorization failed')}</div>`;
    }
  }

  drawer.querySelector('#lw-cat-uncat-btn')?.addEventListener('click', () => runAutoCategorize('uncategorized'));
  drawer.querySelector('#lw-cat-recent-btn')?.addEventListener('click', () => runAutoCategorize('recent'));

  /* ---------------------------------------------------------------
     Feature 4: Monthly AI Financial Review & Anomaly Alerts
     --------------------------------------------------------------- */
  const reviewBtn = drawer.querySelector('#lw-review-btn') as HTMLButtonElement;
  const reviewResultEl = drawer.querySelector('#lw-review-result') as HTMLElement;

  reviewBtn.addEventListener('click', async () => {
    const h = lw();
    const state = h?.getState();
    if (!h || !state) {
      reviewResultEl.innerHTML = `<div class="lw-ai-err">Load your Ledgerwise workspace first.</div>`;
      return;
    }

    const month = h.getMonth();
    const prevMonth = h.addMonthsKey(month, -1);
    const curTotals = h.monthTotals(month);
    const prevTotals = h.monthTotals(prevMonth);
    const bTotals = h.budgetTotals(month);
    const nw = h.accountTotals();

    const categoryComparison = [...curTotals.byCategory.entries()]
      .map(([catId, amt]) => ({
        category: h.categoryById(catId)?.name || catId,
        type: h.categoryById(catId)?.type || 'expense',
        currentMajor: amt / 100,
        previousMajor: (prevTotals.byCategory.get(catId) || 0) / 100,
      }))
      .sort((a, b) => b.currentMajor - a.currentMajor);

    reviewBtn.disabled = true;
    reviewBtn.textContent = 'Analysing…';
    reviewResultEl.innerHTML = '';

    try {
      const { review } = await postJson<{ review: MonthlyReviewResult }>('/api/ai/monthly-review', {
        reviewData: {
          month,
          currency: state.profile?.currency || 'KES',
          netWorthMajor: nw.net / 100,
          currentMonth: {
            incomeMajor: curTotals.income / 100,
            expenseMajor: curTotals.expense / 100,
            netMajor: curTotals.net / 100,
          },
          previousMonth: {
            incomeMajor: prevTotals.income / 100,
            expenseMajor: prevTotals.expense / 100,
            netMajor: prevTotals.net / 100,
          },
          budgets: bTotals.rows.map((r: any) => ({
            category: r.category.name,
            limitMajor: r.limitCents / 100,
            spentMajor: r.spentCents / 100,
            remainingMajor: r.remainingCents / 100,
          })),
          categoryComparison,
        },
      });

      reviewResultEl.innerHTML = `
        <div class="lw-ai-card">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="lw-ai-score">${esc(review.healthScore)}</div>
            <div>
              <h3 style="margin:0">${esc(review.headline)}</h3>
              <p class="lw-ai-muted" style="margin-top:3px">${esc(review.summary)}</p>
            </div>
          </div>
        </div>
        ${
          review.anomalies?.length
            ? `<div class="lw-ai-card">
                <h3>Anomaly Alerts (${review.anomalies.length})</h3>
                ${review.anomalies
                  .map(
                    (a) => `
                  <div class="lw-ai-item-row">
                    <div>
                      <div style="font-weight:600">${esc(a.title)} <span class="lw-ai-sev-${esc(a.severity.toLowerCase())}">· ${esc(a.severity)}</span></div>
                      <div class="lw-ai-muted">${esc(a.detail)}</div>
                    </div>
                  </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${
          review.wins?.length
            ? `<div class="lw-ai-card">
                <h3>What Went Well</h3>
                <ul class="lw-ai-list">${review.wins.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
              </div>`
            : ''
        }
        ${
          review.actionItems?.length
            ? `<div class="lw-ai-card">
                <h3>Recommended Actions</h3>
                <ul class="lw-ai-list">${review.actionItems.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
              </div>`
            : ''
        }
      `;
    } catch (err) {
      reviewResultEl.innerHTML = `<div class="lw-ai-err">${esc(err instanceof Error ? err.message : 'Review failed')}</div>`;
    } finally {
      reviewBtn.disabled = false;
      reviewBtn.textContent = 'Run Monthly Review';
    }
  });

  /* ---------------------------------------------------------------
     Feature 5: AI Budget Coach & Debt Payoff Advisor
     --------------------------------------------------------------- */
  const coachBtn = drawer.querySelector('#lw-coach-btn') as HTMLButtonElement;
  const coachResultEl = drawer.querySelector('#lw-coach-result') as HTMLElement;

  coachBtn.addEventListener('click', async () => {
    const h = lw();
    const state = h?.getState();
    if (!h || !state) {
      coachResultEl.innerHTML = `<div class="lw-ai-err">Load your Ledgerwise workspace first.</div>`;
      return;
    }

    const month = h.getMonth();
    const cur = state.profile?.currency || 'KES';
    const safe = h.safeToSpend();
    const mTotals = h.monthTotals(month);
    const bTotals = h.budgetTotals(month);
    const debts = h
      .activeAccounts()
      .filter((a: any) => h.accountNature(a) === 'liability')
      .map((a: any) => ({
        name: a.name,
        balanceMajor: h.accountBalance(a.id) / 100,
        apr: a.apr || 0,
        minPaymentMajor: (a.minPaymentCents || 0) / 100,
      }));

    coachBtn.disabled = true;
    coachBtn.textContent = 'Building plan…';
    coachResultEl.innerHTML = '';

    try {
      const { coach } = await postJson<{ coach: CoachResult }>('/api/ai/coach', {
        coachData: {
          month,
          currency: cur,
          safeToSpendMajor: safe.safe / 100,
          spendableCashMajor: safe.liquid / 100,
          upcomingBillsMajor: safe.bills / 100,
          reservedForGoalsMajor: safe.reserved / 100,
          bufferMajor: safe.buffer / 100,
          recurringMonthlyIncomeMajor: h.recurringMonthlyIncome() / 100,
          recurringMonthlyLoadMajor: h.recurringMonthlyLoad() / 100,
          monthIncomeMajor: mTotals.income / 100,
          monthExpenseMajor: mTotals.expense / 100,
          debts,
          goals: h.activeGoals().map((g: any) => ({
            name: g.name,
            savedMajor: h.goalSaved(g) / 100,
            targetMajor: g.targetCents / 100,
            targetDate: g.targetDate,
          })),
          expenseCategories: h.categoriesOf('expense').map((c: any) => ({
            id: c.id,
            name: c.name,
            spentMajor: (mTotals.byCategory.get(c.id) || 0) / 100,
            currentLimitMajor:
              (bTotals.rows.find((r: any) => r.category.id === c.id)?.limitCents || 0) / 100,
          })),
        },
      });

      coachResultEl.innerHTML = `
        <div class="lw-ai-card">
          <h3>Coaching Summary</h3>
          <p class="lw-ai-muted">${esc(coach.summary)}</p>
        </div>
        <div class="lw-ai-card">
          <h3>Safe-to-Spend Guidance</h3>
          <p class="lw-ai-muted">${esc(coach.safeToSpendAdvice)}</p>
        </div>
        <div class="lw-ai-card">
          <h3>Debt Payoff Strategy</h3>
          <p class="lw-ai-muted">${esc(coach.debtStrategyAdvice)}</p>
        </div>
        ${
          coach.suggestedBudgets?.length
            ? `<div class="lw-ai-card">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
                  <h3 style="margin:0">Suggested Monthly Budgets</h3>
                  <button type="button" id="lw-coach-apply-budgets" class="lw-ai-btn">Apply Limits</button>
                </div>
                ${coach.suggestedBudgets
                  .map(
                    (b) => `
                  <div class="lw-ai-item-row">
                    <div>
                      <div style="font-weight:600">${esc(b.categoryName)}</div>
                      <div class="lw-ai-muted">${esc(b.reason)}</div>
                    </div>
                    <div class="lw-ai-mono" style="font-weight:600;white-space:nowrap">${esc(cur)} ${esc(Math.round(b.suggestedLimitMajor).toLocaleString())}</div>
                  </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${
          coach.nextSteps?.length
            ? `<div class="lw-ai-card">
                <h3>Next Steps</h3>
                <ul class="lw-ai-list">${coach.nextSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
              </div>`
            : ''
        }
      `;

      coachResultEl.querySelector('#lw-coach-apply-budgets')?.addEventListener('click', () => {
        let count = 0;
        for (const b of coach.suggestedBudgets || []) {
          const cents = Math.round(Number(b.suggestedLimitMajor) * 100);
          if (b.categoryId && cents > 0) {
            h.setBudget(month, b.categoryId, cents);
            count += 1;
          }
        }
        h.persist('ai-coach', `Applied ${count} AI-recommended budget limits for ${month}.`);
        h.refresh(`Applied ${count} budget limits`, 'success');
      });
    } catch (err) {
      coachResultEl.innerHTML = `<div class="lw-ai-err">${esc(err instanceof Error ? err.message : 'Coach failed')}</div>`;
    } finally {
      coachBtn.disabled = false;
      coachBtn.textContent = 'Generate Coaching Plan';
    }
  });

  /* ---------------------------------------------------------------
     Feature 6: Conversational Chat
     --------------------------------------------------------------- */
  const chatHistory: ChatMessage[] = [];
  const chatMessagesEl = drawer.querySelector('#lw-chat-messages') as HTMLElement;
  const chatFormEl = drawer.querySelector('#lw-chat-form') as HTMLFormElement;
  const chatInputEl = drawer.querySelector('#lw-chat-input') as HTMLInputElement;
  const chatSendEl = drawer.querySelector('#lw-chat-send') as HTMLButtonElement;

  const appendChat = (cls: string, text: string) => {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return div;
  };

  chatFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = chatInputEl.value.trim();
    if (!prompt) return;
    chatInputEl.value = '';
    chatSendEl.disabled = true;
    appendChat('lw-ai-msg user', prompt);
    const pending = appendChat('lw-ai-msg model', 'Thinking…');

    try {
      const localAnswer = answerFromLedger(prompt);
      if (localAnswer) {
        pending.textContent = localAnswer + '\n\nAnswered directly from your live ledger. No AI request was sent.';
        chatHistory.push({ role: 'user', text: prompt });
        chatHistory.push({ role: 'model', text: localAnswer });
      } else {
        const res = await postJson<{ text: string }>('/api/ai/ask', {
          prompt,
          history: chatHistory,
          ledgerContext: getLiveSnapshot(),
          personaInstruction: PERSONA_PROMPTS[currentPersona] || PERSONA_PROMPTS['cfo'],
        });
        pending.textContent = res.text || 'No response returned.';
        chatHistory.push({ role: 'user', text: prompt });
        chatHistory.push({ role: 'model', text: res.text });
      }
    } catch (err) {
      pending.remove();
      appendChat('lw-ai-err', err instanceof Error ? err.message : 'Unable to reach AI.');
    } finally {
      chatSendEl.disabled = false;
      chatInputEl.focus();
    }
  });

  async function recoverSms(blocks: string[]) {
    const h = lw();
    if (!h || !blocks.length) return [];
    const categories = [...h.categoriesOf('expense'), ...h.categoriesOf('income')].map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));
    const allRecovered: any[] = [];
    for (let i = 0; i < blocks.length; i += 25) {
      const chunk = blocks.slice(i, i + 25);
      const { messages } = await postJson<{ messages: any[] }>('/api/ai/parse-sms-batch', {
        blocks: chunk,
        categories,
        today: h.todayISO(),
      });
      if (Array.isArray(messages)) allRecovered.push(...messages);
    }
    return allRecovered;
  }

  async function categorizeImportRows(rows: any[]): Promise<number> {
    const h = lw();
    if (!h || !Array.isArray(rows) || !rows.length) return 0;
    const eligible = rows.filter((r) => r && !r.dup && r.kind !== 'transfer');
    if (!eligible.length) return 0;

    const categories = [...h.categoriesOf('expense'), ...h.categoriesOf('income')].map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));

    let updated = 0;
    for (let i = 0; i < eligible.length; i += 35) {
      const chunk = eligible.slice(i, i + 35);
      const { assignments } = await postJson<{ assignments: CatAssignment[] }>('/api/ai/categorize', {
        items: chunk.map((r) => ({
          id: String(r.index),
          date: r.date,
          description: r.description,
          payee: '',
          amountMajor: (r.cents || 0) / 100,
          type: r.dir === 'in' ? 'income' : 'expense',
        })),
        categories,
      });

      for (const a of assignments || []) {
        const row = chunk.find((r) => String(r.index) === String(a.id));
        if (!row || !a.categoryId) continue;
        const cat = h.categoryById(a.categoryId);
        const expectedType = row.dir === 'in' ? 'income' : 'expense';
        if (!cat || cat.archived || cat.type !== expectedType) continue;
        if (row.categoryId !== cat.id) {
          row.categoryId = cat.id;
          row.autoCategory = true;
          updated += 1;
        }
      }
    }
    return updated;
  }

  window.LedgerwiseAI = { openDrawer, closeDrawer, recoverSms, categorizeImportRows };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAiSuite, { once: true });
} else {
  mountAiSuite();
}
