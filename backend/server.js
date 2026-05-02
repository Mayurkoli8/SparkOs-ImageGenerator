/**
 * SparkOs Image Generator — Backend Server v2
 * Node.js + Express | 100% OpenAI — No Anthropic
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

// ─────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/public",  express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─────────────────────────────────────────────────────────
// ENSURE DIRECTORIES EXIST
// ─────────────────────────────────────────────────────────

["public/generated","public/thumbnails","uploads/logos","uploads/images","uploads/posters","uploads/docs","data"]
  .forEach((d) => fs.mkdirSync(path.join(__dirname, d), { recursive: true }));

// ─────────────────────────────────────────────────────────
// JSON DATABASE
// ─────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, "data/db.json");

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const init = { brands: {}, generations: [], webhookLogs: [], assets: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
    return init;
  }
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); }
  catch { return { brands: {}, generations: [], webhookLogs: [], assets: {} }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────────────────
// MULTER
// ─────────────────────────────────────────────────────────

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
  fileFilter: (_, file, cb) => {
    cb(null, /jpeg|jpg|png|gif|webp|svg|pdf|doc|docx|txt/i.test(path.extname(file.originalname)));
  },
});

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + crypto.randomBytes(3).toString("hex"); }

function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function getOpenAI(apiKey) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey: key });
}

const RATIO_SIZES = { "1:1":"1024x1024","4:5":"1024x1024","9:16":"1024x1792","16:9":"1792x1024" };

// ─────────────────────────────────────────────────────────
// PROMPT ENHANCEMENT — GPT-4o only, zero Anthropic
// ─────────────────────────────────────────────────────────

async function enhancePrompt(userPrompt, brand, campaignType, aspectRatio, apiKey, gptModel = "gpt-4o") {
  const openai = getOpenAI(apiKey);

  const system = `You are a world-class marketing expert for ${brand.brandType || "real estate"}.

Brand: ${brand.companyName || "Brand"}
Type: ${brand.brandType || "Premium Real Estate"}
Colors: Primary ${brand.primaryColor || "#C9A96E"}, Secondary ${brand.secondaryColor || "#1A1A2E"}
Style: ${brand.designStyle || "luxury minimal"}
Tone: ${brand.tone || "premium, aspirational, professional"}
Tagline: ${brand.tagline || ""}
AI Instructions: ${brand.aiInstructions || "none"}
Restrictions: ${brand.restrictions || "none"}

Transform the user prompt into a detailed professional image generation prompt.
RULES:
- Describe lighting, atmosphere, color palette, composition
- Do NOT include readable text in image
- Leave visual space at bottom for text overlay
- Premium, editorial, Instagram-ready quality

Return ONLY valid JSON — no markdown:
{
  "campaignType": "festival|new_year|property_launch|offer|site_visit|possession|milestone|brand_awareness|testimonial|project_highlight|construction_update",
  "enhancedPrompt": "full detailed image generation prompt",
  "aspectRatio": "1:1 or 4:5 or 9:16 or 16:9",
  "reasoning": "brief explanation"
}`;

  const res = await openai.chat.completions.create({
    model: gptModel,
    max_tokens: 800,
    temperature: 0.7,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: `User prompt: "${userPrompt}". Campaign: ${campaignType}. Ratio: ${aspectRatio}.` },
    ],
  });

  try {
    return JSON.parse(res.choices[0].message.content.replace(/```json|```/g, "").trim());
  } catch {
    return { enhancedPrompt: userPrompt, campaignType: campaignType === "auto" ? "brand_awareness" : campaignType, aspectRatio: aspectRatio || "1:1", reasoning: "Direct" };
  }
}

// ─────────────────────────────────────────────────────────
// IMAGE GENERATION — gpt-image-1.5, gpt-image-1, dall-e-3, dall-e-2
// ─────────────────────────────────────────────────────────

async function generateImage(prompt, size, apiKey, model = "gpt-image-1.5") {
  const openai     = getOpenAI(apiKey);
  const isGptImage = model === "gpt-image-1" || model === "gpt-image-1.5";

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

// ─────────────────────────────────────────────────────────
// CANVAS BRAND OVERLAY
// ─────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

async function applyBrandOverlay(imageBuffer, brand, logoPath) {
  const canvas = createCanvas(1080, 1080);
  const ctx    = canvas.getContext("2d");
  ctx.drawImage(await loadImage(imageBuffer), 0, 0, 1080, 1080);

  const grad = ctx.createLinearGradient(0, 600, 0, 1080);
  grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(0.45,"rgba(0,0,0,0.7)"); grad.addColorStop(1,"rgba(0,0,0,0.94)");
  ctx.fillStyle = grad; ctx.fillRect(0, 600, 1080, 480);

  ctx.fillStyle = brand.primaryColor || "#C9A96E"; ctx.fillRect(0, 1072, 1080, 8);
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;

  ctx.fillStyle = "#FFF"; ctx.font = "bold 52px Georgia, serif"; ctx.fillText(brand.companyName || "", 44, 880);

  if (brand.tagline && brand.showTagline !== false) {
    ctx.font = "italic 28px Georgia, serif"; ctx.fillStyle = brand.primaryColor || "#C9A96E";
    ctx.fillText(brand.tagline, 44, 922);
  }

  ctx.shadowBlur = 4; ctx.font = "24px Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.88)";
  let y = 965;
  if (brand.phone && brand.showPhone !== false) { ctx.fillText(`\u260E  ${brand.phone}`, 44, y); y += 36; }
  if (brand.website && brand.showWebsite !== false) { ctx.fillStyle = "rgba(200,200,200,0.8)"; ctx.font = "22px Arial"; ctx.fillText(`\u{1F310}  ${brand.website}`, 44, y); }

  if (logoPath && fs.existsSync(logoPath) && brand.showLogo !== false) {
    try {
      const logo = await loadImage(logoPath);
      const lx = 950, ly = 20, lw = 108, lh = 108;
      ctx.shadowBlur = 20; ctx.fillStyle = "rgba(255,255,255,0.97)";
      roundRect(ctx, lx-10, ly-10, lw+20, lh+20, 14); ctx.fill();
      ctx.shadowBlur = 0; ctx.drawImage(logo, lx, ly, lw, lh);
    } catch (e) { console.warn("Logo skip:", e.message); }
  }

  return canvas.toBuffer("image/png");
}

// ─────────────────────────────────────────────────────────
// GENERATION PIPELINE
// ─────────────────────────────────────────────────────────

async function runGenerationPipeline({ prompt, brand, campaignType="auto", aspectRatio="1:1", mode="ai", imageModel="gpt-image-1.5", enhanceModel="gpt-4o", apiKey, req }) {
  const enhanced   = await enhancePrompt(prompt, brand, campaignType, aspectRatio, apiKey, enhanceModel);
  const finalRatio = enhanced.aspectRatio || aspectRatio;
  const size       = RATIO_SIZES[finalRatio] || "1024x1024";

  let imageBuffer  = await generateImage(enhanced.enhancedPrompt, size, apiKey, imageModel);

  if (mode === "overlay") {
    const db        = readDB();
    const bAssets   = db.assets[brand.id] || {};
    const logoPath  = bAssets.logo ? path.join(__dirname, bAssets.logo) : null;
    imageBuffer     = await applyBrandOverlay(imageBuffer, brand, logoPath);
  }

  const genId    = `gen_${uid()}`;
  const filename = `${genId}.png`;
  fs.writeFileSync(path.join(__dirname, "public/generated",  filename), imageBuffer);
  fs.writeFileSync(path.join(__dirname, "public/thumbnails", `${genId}_thumb.png`), imageBuffer);

  const base         = getBaseUrl(req);
  const imageUrl     = `${base}/public/generated/${filename}`;
  const thumbnailUrl = `${base}/public/thumbnails/${genId}_thumb.png`;

  const record = { id: genId, brandId: brand.id||"default", prompt, enhancedPrompt: enhanced.enhancedPrompt, campaignType: enhanced.campaignType, aspectRatio: finalRatio, mode, imageModel, enhanceModel, imageUrl, thumbnailUrl, reasoning: enhanced.reasoning, createdAt: new Date().toISOString() };

  const db = readDB(); db.generations.unshift(record); writeDB(db);
  return record;
}

// ─────────────────────────────────────────────────────────
// ROUTES — BRANDS
// ─────────────────────────────────────────────────────────

app.get("/api/brands", (_, res) => { const db = readDB(); res.json({ brands: Object.values(db.brands) }); });

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
  const db = readDB(); delete db.brands[req.params.id]; writeDB(db); res.json({ success: true });
});

// ─────────────────────────────────────────────────────────
// ROUTES — ASSETS
// ─────────────────────────────────────────────────────────

app.post("/api/assets/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const db = readDB(); const brandId = req.body.brandId || "default"; const type = req.query.type || "images";
  if (!db.assets[brandId]) db.assets[brandId] = { images: [], posters: [], docs: [] };
  const relativePath = `uploads/${type}/${req.file.filename}`;
  const url = `${req.protocol}://${req.get("host")}/${relativePath}`;
  if (type === "logo") { db.assets[brandId].logo = relativePath; db.assets[brandId].logoUrl = url; }
  else { if (!db.assets[brandId][type]) db.assets[brandId][type] = []; db.assets[brandId][type].push({ id: uid(), path: relativePath, url, name: req.file.originalname, size: req.file.size }); }
  writeDB(db); res.json({ success: true, url, path: relativePath, type });
});

app.get("/api/assets/:brandId", (req, res) => {
  const db = readDB(); res.json({ assets: db.assets[req.params.brandId] || {} });
});

// ─────────────────────────────────────────────────────────
// ROUTES — GENERATE
// ─────────────────────────────────────────────────────────
// CONFIG CHECK
// ─────────────────────────────────────────────────────────

app.get("/api/config/check-key", (req, res) => {
  const hasEnvKey = !!process.env.OPENAI_API_KEY;
  res.json({ keyConfigured: hasEnvKey });
});

// ─────────────────────────────────────────────────────────

app.post("/api/generate", async (req, res) => {
  const { brandId, prompt, campaignType, aspectRatio, mode, imageModel, enhanceModel } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  const apiKey = req.headers["x-openai-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ error: "OpenAI API key required" });
  const db = readDB(); const brand = brandId ? (db.brands[brandId]||{}) : (Object.values(db.brands)[0]||{});
  try {
    const result = await runGenerationPipeline({ prompt, brand, campaignType, aspectRatio, mode, imageModel: imageModel||process.env.DEFAULT_IMAGE_MODEL||"gpt-image-1.5", enhanceModel: enhanceModel||"gpt-4o", apiKey, req });
    res.json({ success: true, ...result });
  } catch (err) { console.error(err.message); res.status(500).json({ success: false, error: err.message }); }
});

app.post("/api/enhance-prompt", async (req, res) => {
  const { prompt, brandId, campaignType, aspectRatio, enhanceModel } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  const apiKey = req.headers["x-openai-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ error: "OpenAI API key required" });
  const db = readDB(); const brand = brandId ? (db.brands[brandId]||{}) : {};
  try { const enhanced = await enhancePrompt(prompt, brand, campaignType||"auto", aspectRatio||"1:1", apiKey, enhanceModel||"gpt-4o"); res.json({ success: true, ...enhanced }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─────────────────────────────────────────────────────────
// ROUTES — HISTORY
// ─────────────────────────────────────────────────────────

app.get("/api/generations", (req, res) => {
  const db = readDB(); let gens = db.generations;
  const { brandId, campaignType, limit=50, offset=0 } = req.query;
  if (brandId) gens = gens.filter((g) => g.brandId === brandId);
  if (campaignType) gens = gens.filter((g) => g.campaignType === campaignType);
  res.json({ total: gens.length, generations: gens.slice(Number(offset), Number(offset)+Number(limit)) });
});

app.delete("/api/generations/:id", (req, res) => {
  const db = readDB(); const gen = db.generations.find((g) => g.id === req.params.id);
  if (gen) {
    [path.join(__dirname,"public/generated",path.basename(gen.imageUrl||"")), path.join(__dirname,"public/thumbnails",path.basename(gen.thumbnailUrl||""))].forEach((p) => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} });
  }
  db.generations = db.generations.filter((g) => g.id !== req.params.id); writeDB(db); res.json({ success: true });
});

// ─────────────────────────────────────────────────────────
// WEBHOOK — ASYNC
// ─────────────────────────────────────────────────────────

app.post("/webhook/generate", async (req, res) => {
  const { requestId, brandId, campaignType, prompt, aspectRatio, mode, imageModel, enhanceModel, callbackUrl } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: "prompt is required" });
  const apiKey = req.headers["x-openai-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ success: false, error: "OPENAI_API_KEY not configured" });

  const db = readDB(); const brand = brandId ? (db.brands[brandId]||{}) : (Object.values(db.brands)[0]||{});
  const logId = uid();
  db.webhookLogs.unshift({ id: logId, requestId, brandId, prompt, status: "processing", receivedAt: new Date().toISOString() });
  writeDB(db);

  res.json({ success: true, status: "processing", requestId, logId });

  setImmediate(async () => {
    try {
      const result = await runGenerationPipeline({ prompt, brand, campaignType: campaignType||"auto", aspectRatio: aspectRatio||"1:1", mode: mode||"ai", imageModel: imageModel||process.env.DEFAULT_IMAGE_MODEL||"gpt-image-1.5", enhanceModel: enhanceModel||"gpt-4o", apiKey, req: { protocol:"https", get:()=>process.env.DOMAIN||"localhost:3001" } });
      const payload = { success:true, requestId, generationId:result.id, imageUrl:result.imageUrl, thumbnailUrl:result.thumbnailUrl, brandId:result.brandId, campaignType:result.campaignType, createdAt:result.createdAt };
      const fresh = readDB(); const idx = fresh.webhookLogs.findIndex((l)=>l.id===logId);
      if (idx>-1) Object.assign(fresh.webhookLogs[idx], { status:"success", ...payload }); writeDB(fresh);
      if (callbackUrl) { const {default:fetch}=await import("node-fetch"); await fetch(callbackUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}).catch((e)=>console.warn("Callback failed:",e.message)); }
    } catch (err) {
      const fresh = readDB(); const idx = fresh.webhookLogs.findIndex((l)=>l.id===logId);
      if (idx>-1) { fresh.webhookLogs[idx].status="error"; fresh.webhookLogs[idx].error=err.message; } writeDB(fresh);
    }
  });
});

// ─────────────────────────────────────────────────────────
// WEBHOOK — SYNC
// ─────────────────────────────────────────────────────────

app.post("/webhook/generate/sync", async (req, res) => {
  const { requestId, brandId, campaignType, prompt, aspectRatio, mode, imageModel, enhanceModel } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: "prompt is required" });
  const apiKey = req.headers["x-openai-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(400).json({ success: false, error: "OPENAI_API_KEY not configured" });
  const db = readDB(); const brand = brandId ? (db.brands[brandId]||{}) : (Object.values(db.brands)[0]||{});
  try {
    const result = await runGenerationPipeline({ prompt, brand, campaignType:campaignType||"auto", aspectRatio:aspectRatio||"1:1", mode:mode||"ai", imageModel:imageModel||process.env.DEFAULT_IMAGE_MODEL||"gpt-image-1.5", enhanceModel:enhanceModel||"gpt-4o", apiKey, req });
    res.json({ success:true, requestId, generationId:result.id, imageUrl:result.imageUrl, thumbnailUrl:result.thumbnailUrl, brandId:result.brandId, campaignType:result.campaignType, createdAt:result.createdAt });
  } catch (err) { res.status(500).json({ success:false, error:err.message }); }
});

app.get("/api/webhook/logs", (_, res) => { const db = readDB(); res.json({ logs: db.webhookLogs.slice(0,100) }); });

// ─────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────

app.get("/health", (_, res) => res.json({ status:"ok", version:"2.0.0", timestamp:new Date().toISOString(), services:{ openai:!!process.env.OPENAI_API_KEY }, defaultImageModel: process.env.DEFAULT_IMAGE_MODEL||"gpt-image-1.5" }));

// ─────────────────────────────────────────────────────────
// SERVE FRONTEND IN PRODUCTION
// ─────────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../frontend/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));
  }
}

app.listen(PORT, () => {
  console.log(`\n⚡ SparkOs v2 running → http://localhost:${PORT}`);
  console.log(`   Webhook: POST http://localhost:${PORT}/webhook/generate`);
});

module.exports = app;
