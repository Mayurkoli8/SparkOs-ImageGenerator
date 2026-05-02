# ⚡ SparkOs v2 — AI Brand Poster Generator

AI-powered marketing poster generation for real estate.
**100% OpenAI** — one key for everything. No Anthropic needed.

---

## Folder Structure

```
SparkOs/
├── frontend/
│   ├── src/
│   │   ├── SparkOs.jsx      ← entire React app
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── render.yaml
├── .gitignore
└── README.md
```

---

## Local Setup (3 steps)

### 1. Install dependencies
```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Configure environment
```bash
cd backend
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY
```

### 3. Run both servers
```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open: http://localhost:5173

---

## Deploy to Render.com

1. Push this folder to a GitHub repo
2. Go to render.com → New → Blueprint
3. Connect your GitHub repo (it reads render.yaml automatically)
4. In Render dashboard, set these env vars for **sparkos-backend**:
   - `OPENAI_API_KEY` = your key
   - `BASE_URL` = https://sparkos-backend.onrender.com
   - `FRONTEND_URL` = https://sparkos-frontend.onrender.com
5. Deploy — done ✓

After deploy, open the Webhook tab in the app —
the endpoint URL is **auto-shown** based on your live domain.

---

## API Keys Needed

| Service | Key | Used For |
|---------|-----|----------|
| OpenAI  | `OPENAI_API_KEY` | Prompt enhancement (GPT-4o) + Image generation (gpt-image-1.5) |

That's it. One key. No Anthropic.

---

## Models Available

### Image Generation
- `gpt-image-1.5` ← **Default, recommended**
- `gpt-image-1`
- `dall-e-3`
- `dall-e-2`

### Prompt Enhancement
- `gpt-4o` ← Default
- `gpt-4o-mini`
- `gpt-4-turbo`

All changeable from **API Settings** inside the app.

---

## Webhook

### Async (recommended for n8n)
```
POST /webhook/generate
```

### Sync (returns result directly)
```
POST /webhook/generate/sync
```

The Webhook tab in the app shows your **live URLs automatically** —
no manual configuration needed after deployment.

### Payload
```json
{
  "requestId": "req_001",
  "brandId": "brand_001",
  "campaignType": "new_year",
  "prompt": "Create a premium New Year post",
  "aspectRatio": "1:1",
  "mode": "overlay",
  "callbackUrl": "https://your-n8n.com/webhook/cb"
}
```

### Response
```json
{
  "success": true,
  "generationId": "gen_k8f2m",
  "imageUrl": "https://your-backend.onrender.com/public/generated/gen_k8f2m.png",
  "thumbnailUrl": "https://your-backend.onrender.com/public/thumbnails/gen_k8f2m_thumb.png",
  "brandId": "brand_001",
  "campaignType": "new_year",
  "createdAt": "2025-01-01T10:00:00.000Z"
}
```
