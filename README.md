# Ledgerwise AI 2.0
### AI-Powered Double-Entry Personal Financial Ledger

Ledgerwise AI 2.0 is an intelligent, privacy-first personal finance platform designed specifically for Kenyan mobile money (M-Pesa, Fuliza, M-Shwari, KCB/Equity banks) and modern multi-account double-entry bookkeeping.

It directly solves the fragile regex importer problem: **no transactions are ever dropped**, receipts are accurately captured via **Multimodal Vision OCR** or **Semantic AI Parsing**, and running balances are reconciled with continuous **Chain Integrity Auditing**.

---

## 🌟 Key Features

1. **Multimodal Vision OCR Intake**
   - Drag & drop or `Ctrl+V` paste screenshots of M-Pesa SMS, M-Pesa App transaction slips, or physical receipts.
   - Powered by **Google Gemini 1.5/2.0 Flash Vision** (free tier compatible) to extract receipt codes, counterparty names, amounts, transaction fees, timestamps, and new provider balances.
   - Automatically drafts balanced double-entry journals for 1-click ledger posting.

2. **Resilient AI SMS Importer (Zero Dropped Messages)**
   - Replaces old, brittle regex rules that silently refused or dropped unformatted texts.
   - **Dual Engine**: Google Gemini semantic analysis + built-in deterministic local heuristic engine.
   - Ambiguous or unusual texts are placed in a **"Needs Review"** queue with intelligent pre-fills, ensuring **100% ledger integrity**.

3. **M-Pesa Chain-Balance Reconciliation & Gap Auditor**
   - Mathematical verification across sequential transactions:
     $$\text{Balance}_t = \text{Balance}_{t-1} + \text{Inflow} - \text{Outflow} - \text{Fee}$$
   - Instantly detects untracked cash withdrawals, offline expenses, or missed deposits, offering a 1-click auto-balance adjustment.

4. **Predictive Safe-to-Spend (CFO Intelligence)**
   - Calculates true spendable liquidity by deducting bill reserves, goal allocations, and outstanding Fuliza overdraft debt from liquid mobile and bank balances.

5. **Four Luxury Design Themes**
   - **Forest Ivory**: Signature warm paper & deep forest green.
   - **Obsidian Emerald**: Dark obsidian glass with luminous emerald neon.
   - **Midnight Gold**: Regal navy & slate with warm brass accents.
   - **Daylight Linen**: High-contrast Scandinavian editorial light mode.

6. **Cloud Sync & Supabase Ready**
   - Retains your existing Supabase project connection (`nipsnpttesinenogregd.supabase.co`) with encrypted offline-first `localStorage` resilience.

---

## 🚀 Running Locally

### Prerequisites
- Node.js `v18+` or `v20+` or `v24+` (Installed on your system: `v24.22.1`)
- npm `v10+` or `v11+`

### Start Server & Application
```bash
# In directory: C:\Users\user\.gemini\antigravity\scratch\ledgerwise-ai
npm run start
```
The server will start on `http://localhost:3001` and serve both the AI API and compiled React client.

To run during active frontend development:
```bash
# Terminal 1: Run Express Server
npm run dev:server

# Terminal 2: Run Vite Client Dev Server with hot reload
npm run dev:client
```
Client dev URL: `http://localhost:5174/`

---

## ☁️ 1-Click Deployment to Render

This project is built and optimized for Render Web Service deployment using `render.yaml`.

### Steps to Deploy on Render:
1. Push this folder to a GitHub or GitLab repository (e.g. `ledgerwise-ai`).
2. Log into your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** &rarr; **Blueprint**.
4. Connect your `ledgerwise-ai` repository. Render automatically reads `render.yaml`:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Under Environment Variables in Render:
   - Add `GEMINI_API_KEY`: *(Optional: Get free key from [Google AI Studio](https://aistudio.google.com/app/apikey) for Vision OCR & Cloud AI)*
6. Click **Apply Blueprint**! Render will build and deploy your app with a free HTTPS live URL (e.g. `https://ledgerwise-ai.onrender.com`).
