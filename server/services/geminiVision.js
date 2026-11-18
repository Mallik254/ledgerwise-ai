/**
 * Multimodal Vision OCR Service
 * Analyzes M-Pesa screenshots, receipts, paper slips, and SMS captures.
 */

async function parseReceiptImage({ base64Data, mimeType, apiKey }) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for Multimodal Vision OCR. You can set it in Settings or server .env');
  }

  const prompt = `You are an expert Kenyan financial auditor specializing in Safaricom M-Pesa and mobile money transaction receipts.
Analyze this image of an M-Pesa confirmation receipt, transaction screenshot, or statement slip.

Extract the following details with precision:
1. receipt: The 10-character alphanumeric transaction code (e.g., TAH89XJ4K2).
2. date: Date in YYYY-MM-DD format.
3. time: Time in 12-hour format with AM/PM (e.g. "3:42 PM").
4. amount: Principal amount in KES as a decimal number (e.g., 2500.00).
5. fee: Transaction fee/cost in KES (e.g., 23.00, or 0 if free).
6. balance: New M-Pesa balance in KES after transaction (e.g., 14820.50), or null if not shown.
7. direction: "in" (received money/deposit) or "out" (payment/transfer/airtime/withdrawal).
8. type: One of ["merchant_buygoods", "paybill", "send_money", "received_money", "cash_withdrawal", "airtime", "fuliza_overdraft", "mshwari_deposit", "mshwari_withdraw", "reversal"].
9. counterparty: The recipient/sender name, till number, or business name (e.g. "Naivas Supermarket Till 123456" or "John Doe").
10. suggestedCategory: Suggested expense/income category ("cat_groceries", "cat_eating", "cat_transport", "cat_bills", "cat_airtime", "cat_household", "cat_family", "cat_fees", "cat_income", "cat_savings", "cat_misc").
11. confidence: Confidence score between 0.0 and 1.0.
12. summary: A one-line natural language explanation (e.g. "Paid KES 2,500.00 to Naivas Supermarket via Buy Goods Till 123456").

Return ONLY a valid JSON object matching this schema, with no markdown code blocks or surrounding prose.`;

  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: cleanBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Vision API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini Vision did not return a valid candidate');
  }

  const parsed = JSON.parse(text.trim());

  // Attach double-entry suggestions
  const debitAccount = parsed.direction === 'out' ? parsed.suggestedCategory : 'acc_mpesa';
  const creditAccount = parsed.direction === 'out' ? 'acc_mpesa' : parsed.suggestedCategory;

  return {
    ...parsed,
    id: `vision_${parsed.receipt || Date.now()}`,
    debitAccount,
    creditAccount,
    source: 'gemini_vision'
  };
}

module.exports = {
  parseReceiptImage
};
