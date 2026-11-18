const express = require('express');
const router = express.Router();
const { parseSmsBatch } = require('../services/semanticParser');
const { parseReceiptImage } = require('../services/geminiVision');
const { auditChainBalances } = require('../services/chainAuditor');

// POST /api/ai/parse-sms
router.post('/parse-sms', async (req, res) => {
  try {
    const { text, apiKey } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    const parsed = await parseSmsBatch(text, key);

    return res.json({
      success: true,
      count: parsed.length,
      transactions: parsed
    });
  } catch (err) {
    console.error('Error in /parse-sms:', err);
    return res.status(500).json({ error: err.message || 'Failed to parse SMS messages' });
  }
});

// POST /api/ai/vision-receipt
router.post('/vision-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType, apiKey } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    const result = await parseReceiptImage({
      base64Data: imageBase64,
      mimeType: mimeType || 'image/jpeg',
      apiKey: key
    });

    return res.json({
      success: true,
      transaction: result
    });
  } catch (err) {
    console.error('Error in /vision-receipt:', err);
    return res.status(500).json({ error: err.message || 'Failed to process vision receipt' });
  }
});

// POST /api/ai/reconcile-chain
router.post('/reconcile-chain', (req, res) => {
  try {
    const { transactions, initialBalance } = req.body;
    const auditResult = auditChainBalances(transactions, initialBalance);
    return res.json({
      success: true,
      audit: auditResult
    });
  } catch (err) {
    console.error('Error in /reconcile-chain:', err);
    return res.status(500).json({ error: err.message || 'Reconciliation failed' });
  }
});

module.exports = router;
