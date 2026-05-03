# ⚡ SparkOs v3 — AI Brand Poster Generator

Multi-brand · Password protected · Asset caching · Webhook ready
**100% OpenAI** — one key for everything. Default model: **gpt-image-1**

---

## Folder Structure

```
SparkOs/
├── frontend/
│   ├── public/
│   │   ├── SparkOs_Logo_2.png   ← brand logo (shown in app + login)
│   │   └── sparkos_icon.png     ← favicon
│   ├── src/
│   │   ├── SparkOs.jsx          ← entire React app (~1800 lines)
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── backend/
│   ├── server.js                ← Express API + webhook + canvas overlay
│   ├── package.json
│   └── .env.example
├── render.yaml                  ← Render.com deploy config
├── .gitignore
└── README.md
```

---

## Local Setup

### 1. Install
```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Configure
```bash
cd backend
cp .env.example .env
# Edit .env — add OPENAI_API_KEY
```

### 3. Run
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```
Open: **http://localhost:5173**

Default password: `sparkos2024`

---

## What's in v3

| Feature | Details |
|---------|---------|
| **Password auth** | Login screen · Change password from Settings |
| **Multi-brand** | Create unlimited brands · Switch in sidebar |
| **Persistent API key** | Saved to localStorage — survives reloads |
| **Asset caching (IndexedDB)** | Upload once · cached in browser · no re-upload |
| **Reference images → AI** | Cached poster/images sent to GPT-4o vision for style matching |
| **Creative text in image** | AI generates artistic campaign text (New Year, Launch, etc.) |
| **Logo zone in image** | Bright empty space at chosen corner — you place logo after download |
| **Manual logo placement** | Preview screen: pick corner, click "Place Logo" |
| **Aspect ratios fixed** | gpt-image-1: 1024x1024, 1024x1536, 1536x1024 |
| **Webhook auto-URL** | Webhook tab shows live URL from window.location |
| **Classic dark theme** | Pure black · SparkOs red accent |

---

## Image Models

| Model | Status | Notes |
|-------|--------|-------|
| **gpt-image-1** | ✅ Default | Use this |
| gpt-image-2 | ⚠ Needs special access | Enable when available |
| dall-e-3 | ✅ Available | HD mode |
| dall-e-2 | ✅ Available | Faster |

Switch anytime in **Settings → Image Generation Model**

---

## Aspect Ratios per Model

| Ratio | gpt-image-1 | dall-e-3 | dall-e-2 |
|-------|-------------|----------|----------|
| 1:1   | 1024x1024   | 1024x1024 | 1024x1024 |
| 4:5   | 1024x1536   | 1024x1792 | 1024x1024 |
| 9:16  | 1024x1536   | 1024x1792 | 1024x1024 |
| 16:9  | 1536x1024   | 1792x1024 | 1024x1024 |

---

## Deploy to Render

1. Push folder to GitHub
2. render.com → New → Blueprint → connect repo
3. Set env vars in Render dashboard for **sparkos-backend**:
   - `OPENAI_API_KEY`
   - `BASE_URL` = https://sparkos-backend.onrender.com
   - `FRONTEND_URL` = https://sparkos-frontend.onrender.com
4. Deploy ✓

**After deploy:** Open app → Settings → enter OpenAI key → Save. That's it.
Webhook tab auto-shows your live endpoint — no manual configuration.

---

## Webhook

```
POST /webhook/generate         ← async, returns immediately
POST /webhook/generate/sync    ← waits, returns full result
```

```json
{
  "requestId": "req_001",
  "brandId": "brand_001",
  "campaignType": "new_year",
  "prompt": "Create a premium New Year post",
  "aspectRatio": "4:5",
  "mode": "ai"
}
```

---

## Environment Variables (backend/.env)

```env
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=sk-proj-your-key
DEFAULT_IMAGE_MODEL=gpt-image-1
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```
