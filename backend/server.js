/**
 * SparkOs Backend v3
 * Auth + Multi-brand + Asset storage + Image generation
 * 100% OpenAI — No Anthropic
 */

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const crypto   = require("crypto");
const OpenAI   = require("openai");
const { createCanvas, loadImage } = require("canvas");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Directories ──────────────────────────────────────────────
["public/generated","public/thumbnails","uploads/logos","uploads/images","uploads/posters","uploads/docs","data"]
  .forEach(d => fs.mkdirSync(path.join(__dirname, d), { recursive: true }));

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/public",  express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── JSON DB ───────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, "data/db.json");

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const init = {
      auth: { passwordHash: crypto.createHash("sha256").update("sparkos2024").digest("hex") },
      brands: {}, generations: [], webhookLogs: [], assets: {}
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
    return init;
  }
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
  catch { return { auth:{ passwordHash: crypto.createHash("sha256").update("sparkos2024").digest("hex") }, brands:{}, generations:[], webhookLogs:[], assets:{} }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ── Multer ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.query.type || "images";
    const dest = path.join(__dirname, `uploads/${type}`);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    cb(null, /jpeg|jpg|png|gif|webp|svg|pdf|doc|docx|txt/i.test(path.extname(file.originalname))),
});

// ── Helpers ───────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + crypto.randomBytes(3).toString("hex"); }
function getBaseUrl(req) { return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`; }
function getOpenAI(apiKey) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey: key });
}

// ── Correct size strings per model ────────────────────────────
// gpt-image-1/2 → 1024x1024, 1024x1536, 1536x1024
// dall-e-3      → 1024x1024, 1024x1792, 1792x1024
// dall-e-2      → 1024x1024 only
function getImageSize(ratio, model) {
  const isGpt = model === "gpt-image-1" || model === "gpt-image-2";
  const isDe3 = model === "dall-e-3";
  const map = {
    "1:1":  { gpt: "1024x1024", de3: "1024x1024", de2: "1024x1024" },
    "4:5":  { gpt: "1024x1536", de3: "1024x1792", de2: "1024x1024" },
    "9:16": { gpt: "1024x1536", de3: "1024x1792", de2: "1024x1024" },
    "16:9": { gpt: "1536x1024", de3: "1792x1024", de2: "1024x1024" },
  };
  const entry = map[ratio] || map["1:1"];
  if (isGpt) return entry.gpt;
  if (isDe3) return entry.de3;
  return entry.de2;
}

// ── Prompt Enhancement ────────────────────────────────────────
async function enhancePrompt(userPrompt, brand, campaignType, aspectRatio, apiKey, gptModel = "gpt-4o", refImages = []) {
  const openai = getOpenAI(apiKey);

  // Build vision message with reference images if available
  const refImageBlock = refImages.length > 0
    ? `\n\nReference images are attached. Analyze their visual style, color usage, layout, typography style, and mood. Replicate this aesthetic in the generated image.`
    : "";

  const system = `You are a world-class marketing creative director and AI image prompt engineer specializing in ${brand.brandType || "real estate"} marketing.

Brand: ${brand.companyName || "Brand"}
Type: ${brand.brandType || "Premium Real Estate"}
Colors: Primary ${brand.primaryColor || "#e53935"}, Secondary ${brand.secondaryColor || "#1a1a1a"}
Style: ${brand.designStyle || "luxury minimal"}
Tone: ${brand.tone || "premium, aspirational, professional"}
Tagline: ${brand.tagline || ""}
AI Instructions: ${brand.aiInstructions || "none"}
Restrictions: ${brand.restrictions || "none"}${refImageBlock}

Transform the user's prompt into a MASTERFUL image generation prompt.

CRITICAL RULES — NEVER BREAK THESE:
1. The image MUST contain CREATIVE, BEAUTIFUL campaign-specific TEXT rendered as part of the visual design
   - Headlines, subheadings, taglines that match the campaign (e.g. "Happy New Year 2025", "Grand Launch", "Eid Mubarak")
   - Typography should be artistic, large, prominent, and beautifully integrated into the composition
   - Text should look like a professional designer placed it — not generic
2. The image MUST have a CLEARLY VISIBLE EMPTY BRIGHT SPACE in the ${brand.logoPlacement || "top-right"} corner
   - This space must be: bright white or very light (high contrast), approximately 120x120px worth of space
   - NO design elements, NO text, NO patterns in this logo zone — it must be clean and empty
   - Describe this explicitly: "clean bright white empty rectangular space in the [position] corner for logo placement"
3. NO company logo, NO brand mark, NO watermark anywhere in the image
4. Describe cinematic lighting, atmosphere, depth, materials, textures
5. Composition must be Instagram-ready: visually stunning, high-contrast, professional
6. Colors should harmonize with: ${brand.primaryColor || "#e53935"} and ${brand.secondaryColor || "#1a1a1a"}

Return ONLY valid JSON (no markdown):
{
  "campaignType": "festival|new_year|property_launch|offer|site_visit|possession|milestone|brand_awareness|testimonial|project_highlight|construction_update",
  "enhancedPrompt": "full detailed image generation prompt — must mention creative text, empty logo zone, cinematic quality",
  "aspectRatio": "1:1 or 4:5 or 9:16 or 16:9",
  "reasoning": "brief"
}`;

  const userContent = refImages.length > 0 ? [
    { type: "text", text: `User prompt: "${userPrompt}". Campaign: ${campaignType}. Ratio: ${aspectRatio}.` },
    ...refImages.slice(0, 2).map(url => ({ type: "image_url", image_url: { url, detail: "low" } }))
  ] : `User prompt: "${userPrompt}". Campaign: ${campaignType}. Ratio: ${aspectRatio}.`;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  const res = await openai.chat.completions.create({ model: gptModel, max_tokens: 900, temperature: 0.75, messages });

  try {
    return JSON.parse(res.choices[0].message.content.replace(/```json|```/g, "").trim());
  } catch {
    return {
      enhancedPrompt: userPrompt,
      campaignType: campaignType === "auto" ? "brand_awareness" : campaignType,
      aspectRatio: aspectRatio || "1:1",
      reasoning: "Direct"
    };
  }
}

// ── Image Generation ──────────────────────────────────────────
async function generateImage(prompt, size, apiKey, model = "gpt-image-1") {
  const openai     = getOpenAI(apiKey);
  const isGptImage = model === "gpt-image-1" || model === "gpt-image-2";

  const params = isGptImage
    ? { model, prompt, n: 1, size }
    : { model, prompt, n: 1, size, quality: "hd", response_format: "b64_json" };

  const res = await openai.images.generate(params);
  const b64 = res.data[0].b64_json || res.data[0].b64;
  if (b64) return Buffer.from(b64, "base64");

  if (res.data[0].url) {
    const { default: fetch } = await import("node-fetch");
    const r = await fetch(res.data[0].url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("No image data returned");
}

// ── Canvas Logo Overlay ───────────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

async function applyLogoOverlay(imageBuffer, brand, logoPath) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext("2d");
  ctx.drawImage(await loadImage(imageBuffer), 0, 0, 1080, 1080);

  if (logoPath && fs.existsSync(logoPath) && brand.showLogo !== false) {
    try {
      const logo = await loadImage(logoPath);
      const pos = brand.logoPlacement || "top-right";
      let lx, ly;
      const lw = 110, lh = 110, pad = 16;
      if (pos.includes("top"))    ly = pad; else ly = 1080 - lh - pad;
      if (pos.includes("left"))   lx = pad; else if (pos.includes("center")) lx = (1080 - lw) / 2; else lx = 1080 - lw - pad;

      // White pill behind logo
      ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 20;
      ctx.fillStyle   = "rgba(255,255,255,0.97)";
      rrect(ctx, lx - 10, ly - 10, lw + 20, lh + 20, 14); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.drawImage(logo, lx, ly, lw, lh);
    } catch(e) { console.warn("Logo skip:", e.message); }
  }

  return canvas.toBuffer("image/png");
}

// ── Generation Pipeline ───────────────────────────────────────
async function runPipeline({ prompt, brand, campaignType="auto", aspectRatio="1:1", mode="ai",
  imageModel="gpt-image-1", enhanceModel="gpt-4o", apiKey, req, refImages=[] }) {

  const enhanced   = await enhancePrompt(prompt, brand, campaignType, aspectRatio, apiKey, enhanceModel, refImages);
  const finalRatio = enhanced.aspectRatio || aspectRatio;
  const size       = getImageSize(finalRatio, imageModel);

  let imageBuffer  = await generateImage(enhanced.enhancedPrompt, size, apiKey, imageModel);

  // Only apply logo overlay in overlay mode
  if (mode === "overlay") {
    const db        = readDB();
    const bAssets   = db.assets[brand.id] || {};
    const logoPath  = bAssets.logo ? path.join(__dirname, bAssets.logo) : null;
    imageBuffer     = await applyLogoOverlay(imageBuffer, brand, logoPath);
  }

  const genId    = `gen_${uid()}`;
  const filename = `${genId}.png`;
  fs.writeFileSync(path.join(__dirname, "public/generated",  filename), imageBuffer);
  fs.writeFileSync(path.join(__dirname, "public/thumbnails", `${genId}_thumb.png`), imageBuffer);

  const base         = getBaseUrl(req);
  const record = {
    id: genId, brandId: brand.id || "default", prompt,
    enhancedPrompt: enhanced.enhancedPrompt, campaignType: enhanced.campaignType,
    aspectRatio: finalRatio, mode, imageModel, enhanceModel,
    imageUrl:     `${base}/public/generated/${filename}`,
    thumbnailUrl: `${base}/public/thumbnails/${genId}_thumb.png`,
    reasoning: enhanced.reasoning, createdAt: new Date().toISOString(),
  };

  const db = readDB(); db.generations.unshift(record); writeDB(db);
  return record;
}

// ════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════

// ── Auth ─────────────────────────────────────────────────────
app.post("/api/auth/login", (req, res) => {
  const db   = readDB();
  const hash = req.body.hash;
  if (!db.auth) db.auth = { passwordHash: crypto.createHash("sha256").update("sparkos2024").digest("hex") };
  if (hash === db.auth.passwordHash) res.json({ success: true });
  else res.status(401).json({ success: false, error: "Incorrect password" });
});

app.post("/api/auth/change-password", (req, res) => {
  const db  = readDB();
  const { currentHash, newHash } = req.body;
  if (!db.auth) db.auth = { passwordHash: crypto.createHash("sha256").update("sparkos2024").digest("hex") };
  if (currentHash !== db.auth.passwordHash) return res.status(401).json({ error: "Current password is incorrect" });
  db.auth.passwordHash = newHash;
  writeDB(db);
  res.json({ success: true });
});

// ── Brands ────────────────────────────────────────────────────
app.get("/api/brands", (_, res) => {
  const db = readDB();
  res.json({ brands: Object.values(db.brands || {}) });
});

app.post("/api/brands", (req, res) => {
  const db = readDB(); const id = `brand_${uid()}`;
  db.brands[id] = { id, ...req.body, createdAt: new Date().toISOString() };
  writeDB(db); res.json({ success: true, brand: db.brands[id] });
});

app.put("/api/brands/:id", (req, res) => {
  const db = readDB();
  if (!db.brands[req.params.id]) return res.status(404).json({ error: "Not found" });
  db.brands[req.params.id] = { ...db.brands[req.params.id], ...req.body };
  writeDB(db); res.json({ success: true, brand: db.brands[req.params.id] });
});

app.delete("/api/brands/:id", (req, res) => {
  const db = readDB(); delete db.brands[req.params.id]; writeDB(db);
  res.json({ success: true });
});

// ── Assets ────────────────────────────────────────────────────
app.post("/api/assets/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const db      = readDB();
  const brandId = req.body.brandId || "default";
  const type    = req.query.type || "images";
  if (!db.assets[brandId]) db.assets[brandId] = { images: [], posters: [], docs: [] };
  const relativePath = `uploads/${type}/${req.file.filename}`;
  const url = `${req.protocol}://${req.get("host")}/${relativePath}`;
  if (type === "logo") {
    db.assets[brandId].logo    = relativePath;
    db.assets[brandId].logoUrl = url;
  } else {
    if (!db.assets[brandId][type]) db.assets[brandId][type] = [];
    db.assets[brandId][type].push({ id: uid(), path: relativePath, url, name: req.file.originalname, size: req.file.size });
  }
  writeDB(db);
  res.json({ success: true, url, path: relativePath, type, fileId: uid() });
});

app.get("/api/assets/:brandId", (req, res) => {
  const db = readDB();
  res.json({ assets: db.assets[req.params.brandId] || {} });
});

// ── Generate ─────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { brandId, prompt, campaignType, aspectRatio, mode, imageModel, enhanceModel, refImages } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  const apiKey = req.headers["x-openai-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ error: "OpenAI API key required" });
  const db    = readDB();
  const brand = brandId ? (db.brands[brandId] || {}) : (Object.values(db.brands)[0] || {});
  try {
    const result = await runPipeline({
      prompt, brand, campaignType, aspectRatio, mode,
      imageModel:   imageModel   || process.env.DEFAULT_IMAGE_MODEL || "gpt-image-1",
      enhanceModel: enhanceModel || "gpt-4o",
      apiKey, req,
      refImages:    refImages    || [],
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Generate error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── History ───────────────────────────────────────────────────
app.get("/api/generations", (req, res) => {
  const db = readDB();
  let gens  = db.generations || [];
  const { brandId, campaignType, limit = 50, offset = 0 } = req.query;
  if (brandId)      gens = gens.filter(g => g.brandId === brandId);
  if (campaignType) gens = gens.filter(g => g.campaignType === campaignType);
  res.json({ total: gens.length, generations: gens.slice(Number(offset), Number(offset) + Number(limit)) });
});

app.delete("/api/generations/:id", (req, res) => {
  const db  = readDB();
  const gen = db.generations.find(g => g.id === req.params.id);
  if (gen) {
    ["public/generated","public/thumbnails"].forEach(dir => {
      const f = path.join(__dirname, dir, path.basename(gen.imageUrl || ""));
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    });
  }
  db.generations = db.generations.filter(g => g.id !== req.params.id);
  writeDB(db); res.json({ success: true });
});

// ── Webhook ───────────────────────────────────────────────────
app.post("/webhook/generate", async (req, res) => {
  const { requestId, brandId, campaignType, prompt, aspectRatio, mode, imageModel, enhanceModel, callbackUrl } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: "prompt is required" });
  const apiKey = req.headers["x-openai-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ success: false, error: "OPENAI_API_KEY not configured" });

  const db    = readDB();
  const brand = brandId ? (db.brands[brandId] || {}) : (Object.values(db.brands)[0] || {});
  const logId = uid();
  db.webhookLogs.unshift({ id: logId, requestId, brandId, prompt, status: "processing", receivedAt: new Date().toISOString() });
  writeDB(db);

  res.json({ success: true, status: "processing", requestId, logId });

  setImmediate(async () => {
    try {
      const result = await runPipeline({
        prompt, brand, campaignType: campaignType || "auto",
        aspectRatio: aspectRatio || "1:1", mode: mode || "ai",
        imageModel:   imageModel   || "gpt-image-1",
        enhanceModel: enhanceModel || "gpt-4o",
        apiKey,
        req: { protocol: "https", get: () => process.env.DOMAIN || "localhost:3001" },
      });
      const payload = { success: true, requestId, generationId: result.id, imageUrl: result.imageUrl, thumbnailUrl: result.thumbnailUrl, brandId: result.brandId, campaignType: result.campaignType, createdAt: result.createdAt };
      const fresh = readDB();
      const idx = fresh.webhookLogs.findIndex(l => l.id === logId);
      if (idx > -1) Object.assign(fresh.webhookLogs[idx], { status: "success", ...payload });
      writeDB(fresh);
      if (callbackUrl) {
        const { default: fetch } = await import("node-fetch");
        await fetch(callbackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(e => console.warn("CB:", e.message));
      }
    } catch (err) {
      const fresh = readDB();
      const idx = fresh.webhookLogs.findIndex(l => l.id === logId);
      if (idx > -1) { fresh.webhookLogs[idx].status = "error"; fresh.webhookLogs[idx].error = err.message; }
      writeDB(fresh);
    }
  });
});

app.post("/webhook/generate/sync", async (req, res) => {
  const { requestId, brandId, campaignType, prompt, aspectRatio, mode, imageModel, enhanceModel } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: "prompt is required" });
  const apiKey = req.headers["x-openai-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ success: false, error: "OPENAI_API_KEY not configured" });
  const db    = readDB();
  const brand = brandId ? (db.brands[brandId] || {}) : (Object.values(db.brands)[0] || {});
  try {
    const result = await runPipeline({ prompt, brand, campaignType: campaignType || "auto", aspectRatio: aspectRatio || "1:1", mode: mode || "ai", imageModel: imageModel || "gpt-image-1", enhanceModel: enhanceModel || "gpt-4o", apiKey, req });
    res.json({ success: true, requestId, generationId: result.id, imageUrl: result.imageUrl, thumbnailUrl: result.thumbnailUrl, brandId: result.brandId, campaignType: result.campaignType, createdAt: result.createdAt });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get("/api/webhook/logs", (_, res) => {
  const db = readDB(); res.json({ logs: (db.webhookLogs || []).slice(0, 100) });
});

// ── Health ────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({
  status: "ok", version: "3.0.0", timestamp: new Date().toISOString(),
  openai: !!process.env.OPENAI_API_KEY,
  defaultModel: process.env.DEFAULT_IMAGE_MODEL || "gpt-image-1"
}));

// ── Serve frontend in production ──────────────────────────────
if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../frontend/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));
  }
}

app.listen(PORT, () => {
  console.log(`\n⚡ SparkOs v3 → http://localhost:${PORT}`);
  console.log(`   Webhook: POST http://localhost:${PORT}/webhook/generate\n`);
});

module.exports = app;
