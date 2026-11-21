/**
 * Deterministic Safaricom M-Pesa SMS parser.
 * Financial safety rules:
 * - Never turn an unrecognised person-to-person transfer into an expense.
 * - Ziidi movements are asset-to-asset investment transfers.
 * - Fees are kept separate from principal.
 * - Reversals and ambiguous Fuliza/loan cases remain review-only.
 */
function moneyValue(value) {
  return Number(String(value || '').replace(/,/g, ''));
}

function extractMoney(text, pattern) {
  const match = text.match(pattern);
  return match ? moneyValue(match[1]) : null;
}

function parseLocalSms(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;
  const receiptMatch = text.match(/\b([A-Z][A-Z0-9]{9})\b/);
  const receipt = receiptMatch ? receiptMatch[1] : '';
  const lower = text.toLowerCase();

  const balance = extractMoney(text, /(?:new\s+)?(?:m-?pesa|account)\s+balance\s*(?:is|was|:)?\s*(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  const fee = extractMoney(text, /(?:transaction\s+cost|transaction\s+fee|cost|fee)\s*[,:]?\s*(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) || 0;
  const amountMatches = [...text.matchAll(/(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi)];
  let amount = 0;
  for (const match of amountMatches) {
    const before = text.slice(Math.max(0, match.index - 45), match.index).toLowerCase();
    if (/balance\s*(?:is|was|:)?\s*$/.test(before) || /(transaction\s+cost|transaction\s+fee|fee|cost)\s*[,:]?\s*$/.test(before)) continue;
    amount = moneyValue(match[1]);
    break;
  }

  let date = '';
  const dateMatch = text.match(/\bon\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})\b/i);
  if (dateMatch) {
    const [day, month, rawYear] = dateMatch[1].split('/');
    const year = rawYear.length === 2 ? '20' + rawYear : rawYear;
    date = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');
  }
  const timeMatch = text.match(/\bat\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)/i);
  const time = timeMatch ? timeMatch[1].trim().toUpperCase() : '';

  const result = {
    id: '',
    receipt,
    rawText: text,
    date,
    time,
    amount,
    fee,
    balance,
    direction: 'out',
    type: 'review_transfer',
    counterparty: 'Unidentified transaction',
    suggestedCategory: 'cat_misc',
    debitAccount: 'cat_misc',
    creditAccount: 'acc_mpesa',
    confidence: 0.45,
    needsReview: true,
    reviewReason: 'Transaction type could not be safely identified',
    source: 'local_heuristic'
  };

  const set = (values) => Object.assign(result, values);
  const nameAfter = (regex, fallback) => {
    const m = text.match(regex);
    return m ? m[1].trim().replace(/\s+/g, ' ').slice(0, 80) : fallback;
  };

  if (/reversal|reversed|transaction reversed/i.test(text)) {
    return set({ type: 'reversal', counterparty: 'M-Pesa reversal', confidence: 0.99, reviewReason: 'Reversal requires matching against the original transaction' });
  }

  if (/ziidi|unit trust/i.test(lower)) {
    const isWithdrawal = /withdraw(?:al)?\s+from|unit\s+trust\s+withdraw/i.test(lower);
    const isInvestment = /invest(?:ment)?\s+to|unit\s+trust\s+invest/i.test(lower);
    if (isWithdrawal || isInvestment) {
      return set({
        direction: isInvestment ? 'out' : 'in',
        type: isInvestment ? 'ziidi_investment' : 'ziidi_withdrawal',
        counterparty: 'Ziidi Money Market Fund',
        suggestedCategory: 'acc_ziidi',
        debitAccount: isInvestment ? 'acc_ziidi' : 'acc_mpesa',
        creditAccount: isInvestment ? 'acc_mpesa' : 'acc_ziidi',
        confidence: receipt && amount > 0 ? 0.98 : 0.75,
        needsReview: !(receipt && amount > 0),
        reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount'
      });
    }
  }

  if (/you have received|received ksh|deposited ksh|money received/i.test(lower)) {
    const counterparty = nameAfter(/(?:from|by)\s+(.+?)(?:\s+\d{9,}| on \d{1,2}\/|\.\s|$)/i, 'Incoming sender');
    const bankTransfer = /equity|kcb|co-operative|coop|stanbic|ncba|m-shwari|mshwari/i.test(counterparty + ' ' + text);
    return set({
      direction: 'in',
      type: bankTransfer ? 'account_transfer' : 'income',
      counterparty,
      suggestedCategory: bankTransfer ? 'acc_bank' : 'cat_income',
      debitAccount: 'acc_mpesa',
      creditAccount: bankTransfer ? 'acc_bank' : 'cat_income',
      confidence: receipt && amount > 0 ? 0.94 : 0.72,
      needsReview: !(receipt && amount > 0),
      reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount'
    });
  }

  if (/m-shwari|mshwari/i.test(lower)) {
    const deposit = /to\s+m-?shwari|deposit(?:ed)?\s+to\s+m-?shwari/i.test(lower);
    return set({
      direction: deposit ? 'out' : 'in',
      type: deposit ? 'mshwari_deposit' : 'mshwari_withdrawal',
      counterparty: 'M-Shwari Savings',
      suggestedCategory: 'acc_mshwari',
      debitAccount: deposit ? 'acc_mshwari' : 'acc_mpesa',
      creditAccount: deposit ? 'acc_mpesa' : 'acc_mshwari',
      confidence: receipt && amount > 0 ? 0.96 : 0.72,
      needsReview: !(receipt && amount > 0),
      reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount'
    });
  }

  const standaloneCharge = /customer transfer of funds charge|pay bill charge|withdrawal charge|transaction charge/i.test(lower)
    && !/paid to|sent to|buy goods|paybill/i.test(lower);
  if (standaloneCharge) {
    const charge = amount || fee || 0;
    return set({
      amount: charge,
      fee: 0,
      type: 'transaction_fee',
      direction: 'out',
      counterparty: 'M-Pesa Transaction Charge',
      suggestedCategory: 'cat_fees',
      confidence: receipt && charge > 0 ? 0.97 : 0.7,
      needsReview: !(receipt && charge > 0),
      reviewReason: receipt && charge > 0 ? '' : 'Missing receipt or charge amount'
    });
  }

  if (/fuliza|overdraft|od loan/i.test(lower)) {
    return set({ type: 'fuliza_review', counterparty: 'Fuliza', suggestedCategory: 'acc_fuliza', confidence: 0.95, reviewReason: 'Fuliza funding or repayment must be matched to the loan liability before posting' });
  }

  if (/withdraw(?:al)?\s+from\s+agent|at\s+agent|cash\s+withdraw/i.test(lower)) {
    return set({
      type: 'cash_withdrawal',
      counterparty: nameAfter(/(?:from|at)\s+agent\s+(.+?)(?:\s+on\s+\d|\.\s|$)/i, 'M-Pesa Agent'),
      suggestedCategory: 'acc_cash',
      debitAccount: 'acc_cash',
      creditAccount: 'acc_mpesa',
      confidence: receipt && amount > 0 ? 0.96 : 0.7,
      needsReview: !(receipt && amount > 0),
      reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount'
    });
  }

  if (/airtime|bundle|data bundle|postpaid/i.test(lower)) {
    return set({ type: 'airtime', counterparty: 'Safaricom Airtime / Bundles', suggestedCategory: 'cat_airtime', confidence: receipt && amount > 0 ? 0.95 : 0.7, needsReview: !(receipt && amount > 0), reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount' });
  }

  if (/pay\s*bill|paybill|business number/i.test(lower)) {
    const counterparty = nameAfter(/(?:to|for)\s+(?:business\s+)?(.+?)(?:\s+for\s+account|\s+on\s+\d|\.\s|$)/i, 'PayBill merchant');
    return set({ type: 'paybill', counterparty, suggestedCategory: 'cat_bills', confidence: receipt && amount > 0 ? 0.9 : 0.68, needsReview: !(receipt && amount > 0), reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount' });
  }

  if (/paid\s+to|buy\s+goods|merchant payment|till number/i.test(lower)) {
    const counterparty = nameAfter(/(?:paid\s+to|buy\s+goods\s+at|merchant payment to)\s+(.+?)(?:\s+on\s+\d|\s+new\s+m-?pesa|\.\s|$)/i, 'Merchant');
    let category = 'cat_misc';
    const merchant = counterparty.toLowerCase();
    if (/market|supermarket|naivas|quickmart|carrefour|grocery|butchery/i.test(merchant)) category = 'cat_groceries';
    else if (/cafe|restaurant|hotel|kitchen|food/i.test(merchant)) category = 'cat_eating';
    else if (/petrol|fuel|shell|rubis|totalenergies/i.test(merchant)) category = 'cat_transport';
    else if (/pharmacy|chemist|hospital|clinic/i.test(merchant)) category = 'cat_household';
    return set({ type: 'merchant_payment', counterparty, suggestedCategory: category, confidence: receipt && amount > 0 ? 0.88 : 0.65, needsReview: !(receipt && amount > 0), reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount' });
  }

  if (/sent\s+to|transfer(?:red)?\s+to|customer transfer/i.test(lower) && /equity|kcb|co-operative|cooperative|coop|stanbic|ncba/i.test(lower)) {
    const bank = /equity/i.test(lower) ? 'Equity Bank' : /kcb/i.test(lower) ? 'KCB Bank' : /co-?operative|coop/i.test(lower) ? 'Co-operative Bank' : /stanbic/i.test(lower) ? 'Stanbic Bank' : 'NCBA Bank';
    return set({
      type: 'account_transfer',
      direction: 'out',
      counterparty: bank,
      suggestedCategory: 'acc_bank',
      debitAccount: 'acc_bank',
      creditAccount: 'acc_mpesa',
      confidence: receipt && amount > 0 ? 0.94 : 0.7,
      needsReview: !(receipt && amount > 0),
      reviewReason: receipt && amount > 0 ? '' : 'Missing receipt or principal amount'
    });
  }

  if (/sent\s+to|send\s+money|customer transfer|transfer of funds|transferred to/i.test(lower)) {
    return set({
      type: 'review_transfer',
      counterparty: nameAfter(/(?:sent\s+to|transfer(?:red)?\s+to)\s+(.+?)(?:\s+\d{9,}|\s+on\s+\d|\.\s|$)/i, 'Unknown recipient'),
      suggestedCategory: 'review',
      confidence: 0.9,
      needsReview: true,
      reviewReason: 'Outgoing person-to-person transfer: classify as expense or own-account transfer before importing'
    });
  }

  return result;
}

function splitSmsMessages(raw) {
  const clean = String(raw || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  const matches = [...clean.matchAll(/\b[A-Z][A-Z0-9]{9}\b/g)];
  if (matches.length > 1) {
    return matches.map((m, i) => clean.slice(m.index, matches[i + 1]?.index ?? clean.length).trim()).filter(Boolean);
  }
  const paragraphs = clean.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  return paragraphs.length > 1 ? paragraphs : [clean];
}

async function parseWithGemini(messages, apiKey) {
  if (!apiKey) return null;
  const prompt = \`Parse these Safaricom M-Pesa SMS messages into JSON. Return one object per message with receipt, rawText, date (YYYY-MM-DD), time, amount (principal only), fee, balance, direction (in/out), type, counterparty, suggestedCategory, confidence, needsReview. Never classify an unknown person-to-person transfer as an expense. Use type "review_transfer" and needsReview true for ambiguous outgoing transfers. Ziidi investment/withdrawal must be identified as ziidi_investment/ziidi_withdrawal. Transaction charges are separate fees. Messages:\\n\${messages.map((m, i) => \`[Message \${i + 1}] \${m}\`).join('\\n')}\`;
  try {
    const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || 'null');
    return Array.isArray(parsed) && parsed.length === messages.length ? parsed : null;
  } catch (_) { return null; }
}

async function parseSmsBatch(rawText, apiKey) {
  const messages = splitSmsMessages(rawText);
  const aiRows = await parseWithGemini(messages, apiKey);
  // Deterministic rules are authoritative for transaction class and posting safety.
  return messages.map((message, index) => {
    const local = parseLocalSms(message);
    const ai = aiRows && aiRows[index];
    if (!local) return null;
    if (!ai) return local;
    const safe = { ...local };
    if (local.type === 'review_transfer' || local.type === 'ziidi_investment' || local.type === 'ziidi_withdrawal' || local.type === 'fuliza_review' || local.type === 'reversal') return safe;
    safe.counterparty = local.counterparty || ai.counterparty || 'Unknown';
    safe.confidence = Math.min(local.confidence, Number(ai.confidence) || local.confidence);
    safe.needsReview = local.needsReview || Boolean(ai.needsReview);
    return safe;
  }).filter(Boolean);
}

module.exports = { parseSmsBatch, splitSmsMessages, parseLocalSms };
