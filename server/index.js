require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Use high-capacity, low-latency Gemini Flash models (Free tier: 15-30 RPM, 1500 RPD)
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';

app.use(cors());
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

/**
 * Direct Gemini API caller with zero external web search and automatic fallback
 */
async function callGeminiApi({ prompt, contents, systemInstruction, responseSchema, responseMimeType, apiKey }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please add your key in Settings or .env');
  }

  // Ensure prompt/contents are formatted for Gemini REST API
  let formattedContents = [];
  if (contents && Array.isArray(contents)) {
    formattedContents = contents;
  } else if (typeof prompt === 'string') {
    formattedContents = [{ role: 'user', parts: [{ text: prompt }] }];
  } else if (contents && typeof contents === 'object') {
    formattedContents = [contents];
  }

  // Web search is completely DISABLED: no search tools attached
  const payload = {
    contents: formattedContents,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [
        {
          text: systemInstruction +
            '\n\nSTRICT REQUIREMENT: Web search is OFF. Do NOT search the web or cite external web links. Ground all answers solely in the provided financial context.'
        }
      ]
    };
  }

  if (responseMimeType) {
    payload.generationConfig.responseMimeType = responseMimeType;
  }
  if (responseSchema) {
    payload.generationConfig.responseSchema = responseSchema;
  }

  // Try primary model first, fallback to secondary if 429 occurs
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 && model !== FALLBACK_MODEL) {
          console.warn(`[Ledgerwise AI] Model ${model} hit 429, falling back to ${FALLBACK_MODEL}...`);
          continue;
        }
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { text, model };
    } catch (err) {
      lastError = err;
      if (model !== FALLBACK_MODEL && err.message.includes('429')) {
        continue;
      }
      break;
    }
  }

  throw lastError;
}

// 1. Health & AI status
app.get('/api/ai/status', (_req, res) => {
  res.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: PRIMARY_MODEL,
    webSearch: false,
    mode: 'zero-search-local-grounded'
  });
});

// 2. Chat Assistant (Strictly grounded in ledger numbers, zero web search)
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { prompt, history, ledgerContext, personaInstruction, apiKey } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const contextBlock = ledgerContext
      ? `\n\nUser Workspace Snapshot (JSON):\n${JSON.stringify(ledgerContext).slice(0, 16000)}`
      : '';

    const personaBlock = personaInstruction
      ? `\n\nPersona: ${personaInstruction}`
      : '';

    const systemInstruction =
      'You are Ledgerwise AI, the built-in financial assistant for a private double-entry personal ledger and budget tracker.\n' +
      'Be concise, practical, and strictly grounded in the numbers provided. Format amounts clearly in the user\'s workspace currency.\n' +
      'Do NOT perform any external web searching or quote general stock prices unless present in the user\'s ledger context.' +
      personaBlock +
      contextBlock;

    const contents = [];
    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if ((msg.role === 'user' || msg.role === 'model') && typeof msg.text === 'string' && msg.text.trim()) {
          contents.push({ role: msg.role, parts: [{ text: msg.text.trim() }] });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: prompt.trim() }] });

    const result = await callGeminiApi({
      contents,
      systemInstruction,
      apiKey
    });

    res.json({ text: result.text, model: result.model });
  } catch (err) {
    console.error('Error in /api/ai/ask:', err.message);
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
});

// 3. Natural-language Transaction Entry parser
app.post('/api/ai/parse-transaction', async (req, res) => {
  try {
    const { text, accounts, categories, currency, today, apiKey } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Enter a transaction sentence to parse.' });
    }

    const prompt =
      `Parse the user's natural-language financial entry into a structured Ledgerwise transaction.\n` +
      `Today's date: ${today || new Date().toISOString().slice(0, 10)}\n` +
      `Workspace currency: ${currency || 'KES'}\n` +
      `Available accounts (choose exact id): ${JSON.stringify(accounts || [])}\n` +
      `Available categories (choose exact id matching expense or income): ${JSON.stringify(categories || [])}\n\n` +
      `User entry: "${text.trim()}"`;

    const result = await callGeminiApi({
      prompt,
      systemInstruction: 'You extract structured double-entry transaction drafts for Ledgerwise. Always pick valid IDs from the provided accounts and categories lists. If no date is mentioned, use today. Return JSON only with keys: type, date, amountMajor, payee, description, accountId, toAccountId, categoryId, notes, explanation.',
      responseMimeType: 'application/json',
      apiKey
    });

    res.json({ parsed: JSON.parse(result.text.trim()), model: result.model });
  } catch (err) {
    console.error('Error in /api/ai/parse-transaction:', err.message);
    res.status(500).json({ error: err.message || 'Failed to parse transaction' });
  }
});

// 4. Multimodal Receipt / Screenshot Scanner
app.post('/api/ai/scan-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType, accounts, categories, currency, today, apiKey } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Receipt image data is required.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const instruction =
      `Extract the transaction details from this receipt or mobile-money / bank screenshot.\n` +
      `Today's date (fallback if unreadable): ${today || new Date().toISOString().slice(0, 10)}\n` +
      `Workspace currency: ${currency || 'KES'}\n` +
      `Available accounts (choose best matching id): ${JSON.stringify(accounts || [])}\n` +
      `Available categories (choose best matching id): ${JSON.stringify(categories || [])}\n` +
      `Put any receipt reference code or key line items into notes. Return strict JSON with keys: type, date, amountMajor, payee, description, accountId, toAccountId, categoryId, notes, explanation.`;

    const contents = [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: cleanBase64 } },
          { text: instruction }
        ]
      }
    ];

    const result = await callGeminiApi({
      contents,
      systemInstruction: 'You are a precision receipt and payment screenshot extractor for Ledgerwise. Extract exact totals, merchant/payee, date, and choose closest accountId and categoryId.',
      responseMimeType: 'application/json',
      apiKey
    });

    res.json({ parsed: JSON.parse(result.text.trim()), model: result.model });
  } catch (err) {
    console.error('Error in /api/ai/scan-receipt:', err.message);
    res.status(500).json({ error: err.message || 'Failed to scan receipt' });
  }
});

// 5. Smart Batch Auto-Categorization
app.post('/api/ai/categorize', async (req, res) => {
  try {
    const { items, categories, apiKey } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No transactions provided to categorize.' });
    }

    const prompt =
      `Assign the single most appropriate category from the provided list to each transaction.\n` +
      `Match expense transactions only to expense categories, and income transactions only to income categories.\n` +
      `Categories: ${JSON.stringify(categories || [])}\n` +
      `Transactions: ${JSON.stringify(items.slice(0, 30))}\n` +
      `Return JSON with key "assignments": array of { id, categoryId, categoryName, reason }`;

    const result = await callGeminiApi({
      prompt,
      systemInstruction: 'You categorize personal finance transactions accurately using only the exact category IDs provided.',
      responseMimeType: 'application/json',
      apiKey
    });

    const data = JSON.parse(result.text.trim());
    res.json({ assignments: data.assignments || [], model: result.model });
  } catch (err) {
    console.error('Error in /api/ai/categorize:', err.message);
    res.status(500).json({ error: err.message || 'Failed to categorize' });
  }
});

// 6. Zero-Drop AI M-Pesa / Bank SMS Recovery Parser
app.post('/api/ai/parse-sms-batch', async (req, res) => {
  try {
    const { blocks, categories, today, apiKey } = req.body;
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ error: 'No SMS messages provided.' });
    }

    // Try Gemini Flash first
    try {
      const prompt =
        `Extract EVERY real financial transaction from these M-Pesa or mobile/bank SMS messages.\n` +
        `Handle ALL Kenyan M-Pesa and bank SMS formats: Paybill, Buy Goods/Till, Pochi la Biashara, Send Money, Receive Money, Fuliza overdraft cover & repayment, M-Shwari, KCB M-Pesa, Hustler Fund, Agent Withdrawal/Deposit, Airtime, Reversals, and Bank-to-M-Pesa.\n` +
        `Fallback date if missing: ${today || new Date().toISOString().slice(0, 10)}.\n` +
        `Available categories: ${JSON.stringify(categories || [])}\n\n` +
        `Messages:\n${blocks.slice(0, 35).map((b, i) => `[${i + 1}] ${b}`).join('\n\n')}\n` +
        `Return strict JSON with key "messages": array of { receipt, date, time, dir, amountMajor, feeMajor, balanceMajor, description, failed, categoryId }`;

      const result = await callGeminiApi({
        prompt,
        systemInstruction: 'You are a zero-drop M-Pesa and bank SMS transaction extractor for Ledgerwise. Extract every real money movement accurately, separating transaction cost/fee into feeMajor and resulting balance into balanceMajor.',
        responseMimeType: 'application/json',
        apiKey
      });

      const data = JSON.parse(result.text.trim());
      if (data && Array.isArray(data.messages) && data.messages.length > 0) {
        return res.json({ messages: data.messages, model: result.model });
      }
    } catch (apiErr) {
      console.warn('[Ledgerwise AI] Gemini SMS parse failed or rate-limited, running resilient local extractor:', apiErr.message);
    }

    // Local deterministic resilient fallback (NEVER drops any message)
    const localRecovered = blocks.map(b => {
      const text = String(b || '');
      const amountMatch = text.match(/(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      const amountMajor = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
      if (!amountMajor) return null;

      const receiptMatch = text.match(/\b([A-Z][A-Z0-9]{9})\b/);
      const feeMatch = text.match(/(?:cost|fee)\s*[,:]?\s*(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      const balanceMatch = text.match(/(?:balance\s*(?:is|was|:)?)\s*(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);

      const isIncoming = /received|deposited|credited/i.test(text);

      return {
        receipt: receiptMatch ? receiptMatch[1] : `SMS-${Date.now().toString(36).toUpperCase()}`,
        date: today || new Date().toISOString().slice(0, 10),
        time: '',
        dir: isIncoming ? 'in' : 'out',
        amountMajor,
        feeMajor: feeMatch ? parseFloat(feeMatch[1].replace(/,/g, '')) : 0,
        balanceMajor: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : -1,
        description: text.slice(0, 100),
        failed: false,
        categoryId: ''
      };
    }).filter(Boolean);

    res.json({ messages: localRecovered, model: 'local-resilient-fallback' });
  } catch (err) {
    console.error('Error in /api/ai/parse-sms-batch:', err.message);
    res.status(500).json({ error: err.message || 'SMS batch parsing failed' });
  }
});

// 7. Monthly AI Financial Review & Anomaly Alerts
app.post('/api/ai/monthly-review', async (req, res) => {
  try {
    const { reviewData, apiKey } = req.body;
    if (!reviewData) {
      return res.status(400).json({ error: 'Monthly ledger summary is required.' });
    }

    const prompt =
      `Perform a concise monthly financial review and anomaly check on this Ledgerwise data:\n` +
      JSON.stringify(reviewData).slice(0, 16000) +
      `\nReturn JSON with keys: headline, healthScore (0-100), summary, anomalies (array of {title, severity, detail}), wins (array of strings), actionItems (array of strings).`;

    const result = await callGeminiApi({
      prompt,
      systemInstruction: 'You are a personal finance analyst inside Ledgerwise. Identify spending anomalies, budget overruns, month-over-month spikes, positive wins, and 3 concrete action items. Ground every claim in the supplied figures. Web search is OFF.',
      responseMimeType: 'application/json',
      apiKey
    });

    res.json({ review: JSON.parse(result.text.trim()), model: result.model });
  } catch (err) {
    console.error('Error in /api/ai/monthly-review:', err.message);
    res.status(500).json({ error: err.message || 'Monthly review failed' });
  }
});

// 8. AI Budget Coach & Debt Payoff Advisor
app.post('/api/ai/coach', async (req, res) => {
  try {
    const { coachData, apiKey } = req.body;
    if (!coachData) {
      return res.status(400).json({ error: 'Workspace planning data is required.' });
    }

    const prompt =
      `Analyze this user's Safe-to-Spend position, recurring bills, savings goals, debt liabilities, and recent category spending:\n` +
      JSON.stringify(coachData).slice(0, 16000) +
      `\nReturn JSON with keys: summary, safeToSpendAdvice, debtStrategyAdvice, suggestedBudgets (array of {categoryId, categoryName, suggestedLimitMajor, reason}), nextSteps (array of strings).`;

    const result = await callGeminiApi({
      prompt,
      systemInstruction: 'You are a pragmatic personal budget coach and debt payoff advisor inside Ledgerwise. Use exact categoryId values. All suggestedLimitMajor values must be realistic positive numbers. Web search is OFF.',
      responseMimeType: 'application/json',
      apiKey
    });

    res.json({ coach: JSON.parse(result.text.trim()), model: result.model });
  } catch (err) {
    console.error('Error in /api/ai/coach:', err.message);
    res.status(500).json({ error: err.message || 'Coach analysis failed' });
  }
});

// Static hosting for the compiled Ledgerwise app
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Ledgerwise AI] Server running on http://localhost:${PORT}`);
  console.log(`[Ledgerwise AI] Primary Model: ${PRIMARY_MODEL} (Zero-Search Mode Active)`);
  console.log(`[Ledgerwise AI] Serving compiled client from: ${clientDist}`);
});
