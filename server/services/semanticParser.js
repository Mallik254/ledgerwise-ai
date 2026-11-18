/**
 * Resilient M-Pesa & Mobile Money Semantic Parser
 * Features:
 * - Dual Engine: Cloud AI (Gemini 1.5/2.0 Flash) + Zero-Cost Local Heuristic Engine
 * - Zero Dropped Transactions: Ambiguous messages are flagged for review rather than dropped
 * - Strict M-Pesa receipt extraction (10-character alphanumeric, e.g. TAH89XJ4K2)
 * - Explicit Fee & Balance extraction
 * - Fuliza overdraft detection
 */

// Local Deterministic Resilient Parser
function parseLocalSms(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  // Extract Receipt: M-Pesa receipts always begin with a letter (e.g. S, T, R) followed by 9 alphanumeric chars
  const receiptMatch = text.match(/\b([A-Z][A-Z0-9]{9})\b/);
  const receipt = receiptMatch ? receiptMatch[1] : `TEMP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  // Extract Amount (e.g., Ksh1,500.00, Ksh 500, KES 250.00)
  const amountMatch = text.match(/(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  let amount = 0;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Extract Balance (e.g. "New M-PESA balance is Ksh4,520.50", "balance is Ksh 120.00")
  const balanceMatch = text.match(/(?:new\s+)?(?:m-?pesa|account)\s+balance\s*(?:is|was|:)?\s*(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  let balance = null;
  if (balanceMatch) {
    balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
  }

  // Extract Transaction Cost / Fee (e.g., "Transaction cost, Ksh15.00", "Transaction cost: Ksh 0.00")
  const feeMatch = text.match(/(?:Transaction\s+cost|cost|fee)\s*[,:]?\s*(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  let fee = 0;
  if (feeMatch) {
    fee = parseFloat(feeMatch[1].replace(/,/g, ''));
  }

  // Extract Date & Time (e.g., "on 18/11/26 at 2:45 PM", "on 18/11/2026 at 14:30")
  let date = new Date().toISOString().split('T')[0];
  const dateMatch = text.match(/\bon\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})\b/i);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      date = `${year}-${month}-${day}`;
    }
  }

  let time = '';
  const timeMatch = text.match(/\bat\s+([0-9]{1,2}:[0-9]{2}(?:\s*(?:AM|PM))?)/i);
  if (timeMatch) {
    time = timeMatch[1].toUpperCase();
  }

  // Determine Direction & Type
  let type = 'expense';
  let direction = 'out';
  let counterparty = 'Unknown Merchant/Person';
  let suggestedCategory = 'cat_misc';

  const lower = text.toLowerCase();

  if (lower.includes('received ksh') || lower.includes('you have received') || lower.includes('deposited ksh')) {
    direction = 'in';
    type = 'income';
    suggestedCategory = 'cat_income';
    const fromMatch = text.match(/from\s+([A-Za-z\s]+?)(?:\s+[0-9]{10}|\s+on|\s+new\b|\.)/i);
    if (fromMatch) counterparty = fromMatch[1].trim();
  } else if (lower.includes('sent to') || lower.includes('transferred to')) {
    direction = 'out';
    type = 'transfer_out';
    suggestedCategory = 'cat_personal';
    const toMatch = text.match(/sent\s+to\s+([A-Za-z\s]+?)(?:\s+[0-9]{10}|\s+on|\s+for\b|\.)/i);
    if (toMatch) counterparty = toMatch[1].trim();
  } else if (lower.includes('paid to') || lower.includes('buy goods') || lower.includes('till')) {
    direction = 'out';
    type = 'merchant_buygoods';
    suggestedCategory = 'cat_groceries';
    const paidMatch = text.match(/paid\s+to\s+([^.]+?)(?:\s+on|\s+new\b|\.)/i);
    if (paidMatch) counterparty = paidMatch[1].trim();
  } else if (lower.includes('pay bill') || lower.includes('paybill') || lower.includes('to business')) {
    direction = 'out';
    type = 'paybill';
    suggestedCategory = 'cat_bills';
    const bizMatch = text.match(/(?:to\s+)(?:business\s+)?([^.]+?)(?:\s+for\s+account|\s+on|\s+new\b|\.)/i);
    if (bizMatch) counterparty = bizMatch[1].trim();
  } else if (lower.includes('withdraw') || lower.includes('agent')) {
    direction = 'out';
    type = 'cash_withdrawal';
    suggestedCategory = 'cat_cash_transfer';
    const agentMatch = text.match(/(?:from\s+agent|at\s+agent)\s+([^.]+?)(?:\s+on|\s+new\b|\.)/i);
    if (agentMatch) counterparty = `Agent ${agentMatch[1].trim()}`;
  } else if (lower.includes('airtime')) {
    direction = 'out';
    type = 'airtime';
    suggestedCategory = 'cat_airtime';
    counterparty = 'Safaricom Airtime';
  } else if (lower.includes('m-shwari') || lower.includes('mshwari')) {
    type = lower.includes('to m-shwari') ? 'mshwari_deposit' : 'mshwari_withdraw';
    direction = lower.includes('to m-shwari') ? 'out' : 'in';
    suggestedCategory = 'cat_savings';
    counterparty = 'M-Shwari Savings';
  } else if (lower.includes('fuliza')) {
    type = 'fuliza_overdraft';
    suggestedCategory = 'cat_fees';
    counterparty = 'Safaricom Fuliza';
  }

  // Double-entry account suggestions
  const debitAccount = direction === 'out' ? suggestedCategory : 'acc_mpesa';
  const creditAccount = direction === 'out' ? 'acc_mpesa' : suggestedCategory;

  const confidence = (amount > 0 && balance !== null && receiptMatch) ? 0.95 : (amount > 0 ? 0.80 : 0.4);

  return {
    id: `tx_${receipt}_${Date.now()}`,
    receipt,
    rawText: text,
    date,
    time,
    amount,
    fee,
    balance,
    direction,
    type,
    counterparty: counterparty.slice(0, 60),
    suggestedCategory,
    debitAccount,
    creditAccount,
    confidence,
    needsReview: confidence < 0.85 || amount === 0,
    source: 'local_heuristic'
  };
}

/**
 * Split text into separate M-Pesa messages
 * Handles multiple delimiter styles: double line breaks, receipt codes, or line-by-line
 */
function splitSmsMessages(raw) {
  const clean = String(raw || '').replace(/\r/g, '').trim();
  if (!clean) return [];

  // M-Pesa receipt codes start with a capital letter followed by 9 alphanumeric chars
  const receiptRegex = /\b[A-Z][A-Z0-9]{9}\b(?:\s+Confirmed)?/g;
  const matches = [...clean.matchAll(receiptRegex)];

  if (matches.length > 1) {
    const pieces = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : clean.length;
      const part = clean.slice(start, end).trim();
      if (part) pieces.push(part);
    }
    return pieces;
  }

  // Split by double line break or single line if lines look like separate SMS
  const byParagraph = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (byParagraph.length > 1) return byParagraph;

  const byLine = clean.split('\n').map(l => l.trim()).filter(Boolean);
  if (byLine.length > 1 && byLine.some(l => /\b[A-Z][A-Z0-9]{9}\b/.test(l))) {
    return byLine;
  }

  return [clean];
}

/**
 * Cloud AI Semantic Parser via Gemini
 */
async function parseWithGemini(messages, apiKey) {
  if (!apiKey) return null;

  const prompt = `You are an expert financial auditor and M-Pesa SMS message parser for a double-entry personal ledger.
Analyze the following M-Pesa SMS confirmation messages. Return a JSON array with one object per message.

Fields required for each:
- receipt: 10-character M-Pesa alphanumeric code (e.g. TA12345678)
- rawText: the original message
- date: YYYY-MM-DD format
- time: 12-hour format with AM/PM (e.g. "2:45 PM")
- amount: float number in KES (principal transacted amount)
- fee: float number in KES (transaction cost, 0.0 if free)
- balance: float number in KES (the new M-Pesa balance after the transaction, null if not mentioned)
- direction: "in" (money entered M-Pesa) or "out" (money left M-Pesa)
- type: "expense" | "income" | "transfer_out" | "merchant_buygoods" | "paybill" | "cash_withdrawal" | "airtime" | "mshwari_deposit" | "mshwari_withdraw" | "fuliza_overdraft" | "reversal"
- counterparty: clean name of merchant, till, paybill business, or individual person
- suggestedCategory: "cat_groceries" | "cat_eating" | "cat_transport" | "cat_bills" | "cat_airtime" | "cat_household" | "cat_family" | "cat_fees" | "cat_income" | "cat_savings" | "cat_misc"
- confidence: number between 0.0 and 1.0
- needsReview: boolean (true if any detail is ambiguous or unusual)

MESSAGES TO PARSE:
${messages.map((m, idx) => `[Message ${idx + 1}]: ${m}`).join('\n\n')}

Return ONLY valid JSON array with NO markdown backticks or commentary.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      console.warn('Gemini API returned error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText.trim());
    if (Array.isArray(parsed)) {
      return parsed.map((item, i) => ({
        ...item,
        id: `tx_${item.receipt || 'AI'}_${Date.now()}_${i}`,
        debitAccount: item.direction === 'out' ? item.suggestedCategory : 'acc_mpesa',
        creditAccount: item.direction === 'out' ? 'acc_mpesa' : item.suggestedCategory,
        source: 'gemini_ai'
      }));
    }
  } catch (err) {
    console.error('Gemini parsing error, falling back to local engine:', err.message);
  }

  return null;
}

/**
 * Main parser entry point: Tries AI first if key exists, seamlessly falls back to resilient local engine
 */
async function parseSmsBatch(rawText, apiKey) {
  const pieces = splitSmsMessages(rawText);
  if (!pieces.length) return [];

  // Try Gemini if apiKey is provided
  if (apiKey) {
    const aiResult = await parseWithGemini(pieces, apiKey);
    if (aiResult && aiResult.length === pieces.length) {
      return aiResult;
    }
  }

  // Local fallback (deterministic & free)
  return pieces.map(piece => parseLocalSms(piece)).filter(Boolean);
}

module.exports = {
  parseSmsBatch,
  splitSmsMessages,
  parseLocalSms
};
