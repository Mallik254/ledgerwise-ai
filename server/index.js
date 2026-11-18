require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    service: 'Ledgerwise AI Core',
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

// AI Routes
app.use('/api/ai', aiRoutes);

// Static hosting for production builds (Render or local single-server)
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// SPA Catch-all route
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Ledgerwise AI API</title></head>
          <body style="font-family: sans-serif; padding: 40px; background: #0f1512; color: #e9f0ea;">
            <h1>Ledgerwise AI Backend Active</h1>
            <p>Port: ${PORT}</p>
            <p>Client build not yet generated. Run <code>npm run build</code> in the root or start Vite dev server.</p>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, () => {
  console.log(`[Ledgerwise AI] Server running on port ${PORT}`);
  console.log(`[Ledgerwise AI] Gemini Vision OCR: ${process.env.GEMINI_API_KEY ? 'Active (API Key loaded)' : 'Local Heuristic Mode (Set GEMINI_API_KEY for cloud AI)'}`);
});
