/**
 * SparkOs Backend v5
 * - Complete image with brand text (phone, website, tagline) rendered by AI
 * - Aspect ratios fixed per model
 * - Single generation mode (AI does everything)
 * - Top-right corner kept clear of text (not a white box, just empty space)
 * - API key + models + assets stored on server persistently
 */

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const crypto  = require("crypto");
const OpenAI  = require("openai");

const app  = express();
const PORT = process.env.PORT || 3001;

["public/generated","public/thumbnails","uploads/logos","uploads/images",
 "uploads/posters","uploads/docs","data"]
  .forEach(d => fs.mkdirSync(path.join(__dirname, d), { recursive: true }));

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/public",  express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── DB ─────────────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, "data/db.json");

const DEFAULT_DB = () => ({
  auth: { passwordHash: crypto.createHash("sha256").update("sparkos2024").digest("hex") },
  settings: { openaiKey:"", imageModel:"gpt-image-1", enhanceModel:"gpt-4o" },
  brands: {}, assets: {}, generations: [], webhookLogs: [],
});

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const d = DEFAULT_DB();
    fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2));
    return d;
  }
  try {
    const d = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    if (!d.settings) d.settings = DEFAULT_DB().settings;
    return d;
  } catch { return DEFAULT_DB(); }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ── Multer ─────────────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function uid()       { return Date.now().toString(36) + crypto.randomBytes(3).toString("hex"); }
function getBaseUrl(req) { return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`; }

function getApiKey() {
  const db  = readDB();
  const key = db.settings?.openaiKey || process.env.OPENAI_API_KEY || "";
  if (!key) throw new Error("OpenAI API key not configured. Go to Settings and add your key.");
  return key;
}

// ── ASPECT RATIO SIZES — verified per model ────────────────────────────────
// gpt-image-1 supports: 1024x1024, 1024x1536, 1536x1024
// dall-e-3    supports: 1024x1024, 1024x1792, 1792x1024
// dall-e-2    supports: 1024x1024 only
function getImageSize(ratio, model) {
  const isGpt = ["gpt-image-1","gpt-image-1.5","gpt-image-2"].includes(model);
  const isDe3 = model === "dall-e-3";
  const sizes = {
    "1:1":  { gpt:"1024x1024", de3:"1024x1024", de2:"1024x1024" },
    "4:5":  { gpt:"1024x1536", de3:"1024x1792", de2:"1024x1024" },  // portrait
    "9:16": { gpt:"1024x1536", de3:"1024x1792", de2:"1024x1024" },  // stories
    "16:9": { gpt:"1536x1024", de3:"1792x1024", de2:"1024x1024" },  // landscape
  };
  const e = sizes[ratio] || sizes["1:1"];
  return isGpt ? e.gpt : isDe3 ? e.de3 : e.de2;
}

// ── CAMPAIGN TEXT TEMPLATES ────────────────────────────────────────────────
// ── CAMPAIGN CONFIGS ──────────────────────────────────────────────────────

const CAMPAIGN_CONFIG = {
  new_year:            { headline:"Happy New Year 2025", sub:"Wishing You Joy, Success & Prosperity", vibe:"golden fireworks bokeh, midnight dark sky, glowing lights, celebration",          colors:"gold, midnight blue, champagne glow" },
  festival:            { headline:"Festival Greetings",  sub:"Celebrate the Joy of the Season",       vibe:"festive lighting, warm diyas, colorful rangoli, celebratory atmosphere",        colors:"saffron, crimson, gold" },
  property_launch:     { headline:"Grand Launch",        sub:"Your Dream Home Awaits",                vibe:"architectural photography, glass towers, luxury facade, blue sky, dramatic sun", colors:"steel blue, white, gold" },
  offer:               { headline:"Limited Time Offer",  sub:"Exclusive Deal — Don't Miss Out",       vibe:"clean modern studio, bold graphic design, premium product feel",                 colors:"deep navy, gold, white" },
  site_visit:          { headline:"You're Invited",      sub:"Visit Your Future Home This Weekend",   vibe:"welcoming entrance, manicured garden, soft golden hour lighting",                colors:"warm amber, forest green, ivory" },
  possession:          { headline:"Welcome Home",        sub:"Keys Handover — A Dream Fulfilled",     vibe:"joyful family, luxury apartment entrance, keys in hand, soft sunlight",          colors:"warm gold, off-white, earthy tones" },
  milestone:           { headline:"Celebrating 10 Years",sub:"A Decade of Trust & Excellence",        vibe:"trophy, corporate elegance, golden confetti, premium dark background",           colors:"gold, charcoal, white" },
  brand_awareness:     { headline:"Excellence Redefined",sub:"Where Luxury Meets Lifestyle",          vibe:"sweeping city skyline aerial, glass buildings, dramatic clouds, sunset",          colors:"deep blue, gold, silver" },
  testimonial:         { headline:"Happy Homeowners",    sub:"Real Stories. Real Smiles.",            vibe:"warm interior photography, cozy living room, natural light, joyful family",      colors:"warm beige, terracotta, white" },
  project_highlight:   { headline:"Project Spotlight",  sub:"Discover Our Latest Masterpiece",       vibe:"architectural render, rooftop pool, panoramic view, luxury interior",            colors:"teal, white, dark charcoal" },
  construction_update: { headline:"Taking Shape",        sub:"Progress Update — On Time, On Vision",  vibe:"construction timelapse feel, golden sunrise, cranes, rising structure",           colors:"orange safety, grey concrete, sky blue" },
};

const DEFAULT_CAMPAIGN = { headline:"Premium Living", sub:"Building Dreams, Creating Legacies", vibe:"luxury real estate aerial view, glass towers, city panorama, golden sunset", colors:"gold, dark navy, white" };

// ── MASTER PROMPT BUILDER ──────────────────────────────────────────────────
// Critical function — this directly controls image quality
function buildMasterPrompt(userPrompt, brand, campaignType, detectedHeadline, refCount) {

  const b      = brand;
  const cfg    = CAMPAIGN_CONFIG[campaignType] || DEFAULT_CAMPAIGN;
  const vibe   = cfg.vibe;
  const colors = cfg.colors;

  // Use AI-detected headline if available, else campaign default
  const mainHeadline = detectedHeadline || cfg.headline;
  const subHeadline  = cfg.sub;

  // Brand identity
  const companyName = b.companyName || "Your Company";
  const tagline     = b.tagline     || "";
  const phone       = b.phone       || "";
  const website     = b.website     || "";
  const brandType   = b.brandType   || "Premium Real Estate";
  const designStyle = b.designStyle || "luxury minimal";
  const tone        = b.tone        || "premium, aspirational, professional";
  const extra       = b.aiInstructions || "";
  const avoid       = b.restrictions   || "";

  // Primary/secondary from brand
  const primaryHex   = b.primaryColor   || "#e53935";
  const secondaryHex = b.secondaryColor || "#1a1a1a";

  // Reference image instruction
  const refInstruction = refCount > 0
    ? `REFERENCE STYLE: ${refCount} sample poster(s) provided. Carefully match their typography style, text layout, color grading, spacing, and overall aesthetic.`
    : "";

  // Build exact text lines for AI to render
  const bottomLines = [];
  if (companyName) bottomLines.push(companyName);
  if (tagline)     bottomLines.push(tagline);
  if (phone && website) bottomLines.push(`${phone}   |   ${website}`);
  else if (phone)       bottomLines.push(phone);
  else if (website)     bottomLines.push(website);
  const bottomBlock = bottomLines.join(" • ");

  console.log("📝 BOTTOM BRAND BAR CONSTRUCTED:", {
    companyName,
    phone,
    website,
    tagline,
    finalBottomBlock: bottomBlock,
  });

  return `You are creating a ${brandType} marketing poster. This must look like it was designed by a world-class professional graphic designer for Instagram.

${refInstruction}

━━━ VISUAL SCENE ━━━
Create a stunning ${vibe}. 
The scene should feel: ${tone}. Dominant palette: ${colors}.
Brand primary accent color: ${primaryHex}. Secondary: ${secondaryHex}.
Design style: ${designStyle}.
Campaign context: "${userPrompt}".
${extra ? `Special request: ${extra}` : ""}
${avoid ? `Do NOT include: ${avoid}` : ""}

━━━ TEXT THAT MUST APPEAR IN THE IMAGE ━━━
Render these text elements as part of the design — styled, positioned, beautiful:

① MAIN HEADLINE — large, bold, dominant, takes up significant visual space:
   "${mainHeadline}"
   Style: Impactful display font, high contrast against background, decorative if appropriate

② SUB-HEADLINE — medium size, beneath or beside main headline:
   "${subHeadline}"
   Style: Lighter weight, elegant, readable

③ BOTTOM BRAND BAR — at the very bottom of the image, clean dark or colored strip/band:
   "${bottomBlock}"
   Style: Professional sans-serif, smaller size, ULTRA-CRISP SHARP TEXT, white or light text on dark/colored background strip
   CRITICAL: This text MUST be pixel-perfect sharp, high contrast, 100% legible — not blurry under any circumstances

━━━ COMPOSITION RULES ━━━
- TOP-RIGHT ~15% of image: intentionally left clear — no text elements here, natural background only
- Headline: Dominant, upper half or center, designed with the scene not just placed on top
- Bottom brand strip: Full-width band at bottom, ~12% height, shows company name + phone + website — TEXT MUST BE CRISP
- Overall: magazine cover quality, dramatic depth, professional lighting, photorealistic or high-end illustration
- Typography: ALL TEXT must be CRISP, SHARP, READABLE — not blurry, not distorted, especially the bottom bar
- Aspect ratio composition: fill the full frame, no empty space at edges

━━━ QUALITY STANDARD ━━━
This poster will be published to Instagram. It must be thumb-stopping.
- Cinematic lighting (dramatic shadows, god rays, bokeh, golden hour glow)
- Ultra sharp details
- Luxury feel — nothing cheap, nothing amateur
- The text must look DESIGNED, not added after — it is part of the visual composition
- Every element serves a purpose

CRITICAL: Render all text legibly. Company name, phone number and website MUST be visible and readable at the bottom.`;
}

// ── ENHANCE PROMPT (detect campaign + get headline) ────────────────────────
async function enhancePrompt(userPrompt, brand, campaignType, aspectRatio, gptModel, refImages, brandCtx) {
  const openai = new OpenAI({ apiKey: getApiKey() });

  const system = `You are a marketing strategist for real estate. Extract details from the user prompt and return JSON.

Campaign types: festival, new_year, property_launch, offer, site_visit, possession, milestone, brand_awareness, testimonial, project_highlight, construction_update

RULES for headline:
- Be SPECIFIC: use names/numbers from user prompt (e.g. "Grand Launch — Skyline Residences", "Happy Diwali 2024", "20% Off This Weekend Only")
- If year/festival/project name mentioned, include it
- Make it punchy, memorable, campaign-specific

RULES for aspectRatio:
- "9:16" for stories/reels content
- "4:5" for portrait Instagram feed posts  
- "1:1" for square feed posts (default for most campaigns)
- "16:9" only if landscape explicitly requested

Return ONLY valid JSON (no markdown):
{
  "campaignType": "detected type from list above",
  "headline": "SPECIFIC punchy headline using details from user prompt",
  "aspectRatio": "1:1 or 4:5 or 9:16 or 16:9",
  "reasoning": "one line"
}`;

  const brandContext = [
    brand.companyName ? `Company: ${brand.companyName}` : "",
    brand.tagline     ? `Tagline: ${brand.tagline}` : "",
  ].filter(Boolean).join(", ");

  const userMsg = campaignType !== "auto"
    ? `User prompt: "${userPrompt}". ${brandContext}. Campaign: ${campaignType}. Preferred ratio: ${aspectRatio}. Give a specific, creative headline.`
    : `User prompt: "${userPrompt}". ${brandContext}. Preferred ratio: ${aspectRatio}. Detect campaign type and give specific headline.`;

  try {
    const res = await openai.chat.completions.create({
      model: gptModel || "gpt-4o",
      max_tokens: 300,
      temperature: 0.7,
      messages: [{ role:"system", content:system }, { role:"user", content:userMsg }],
    });
    return JSON.parse(res.choices[0].message.content.replace(/```json|```/g,"").trim());
  } catch {
    return {
      campaignType: campaignType === "auto" ? "brand_awareness" : campaignType,
      headline: "",
      aspectRatio: aspectRatio || "1:1",
      reasoning: "Direct",
    };
  }
}

// ── GET REFERENCE IMAGES ──────────────────────────────────────────────────
function getRefImages(brandId, limit = 2) {
  const db = readDB();
  const brandAssets = db.assets?.[brandId];
  if (!brandAssets || !brandAssets.images) return [];
  
  // Return base64 images (used by GPT vision), up to limit
  const images = brandAssets.images
    .filter(img => img.base64)
    .slice(0, limit)
    .map(img => ({ id: img.id, base64: img.base64, name: img.name }));
  
  return images;
}

// ── IMAGE GENERATION ───────────────────────────────────────────────────────
async function generateImage(prompt, size, model) {
  const openai = new OpenAI({ apiKey: getApiKey() });
  const isGpt  = ["gpt-image-1","gpt-image-1.5","gpt-image-2"].includes(model);

  const params = isGpt
    ? { model, prompt, n:1, size }
    : { model, prompt, n:1, size, quality:"hd", response_format:"b64_json" };

  const res = await openai.images.generate(params);
  const b64 = res.data[0].b64_json || res.data[0].b64;
  if (b64) return Buffer.from(b64, "base64");

  if (res.data[0].url) {
    const { default: fetch } = await import("node-fetch");
    const r = await fetch(res.data[0].url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("No image data returned from OpenAI");
}

// ── GENERATION PIPELINE ────────────────────────────────────────────────────
async function runPipeline({ prompt, brand, campaignType="auto", aspectRatio="1:1",
  imageModel, enhanceModel, req }) {

  const db     = readDB();
  const iModel = imageModel   || db.settings.imageModel   || "gpt-image-1";
  const eModel = enhanceModel || db.settings.enhanceModel || "gpt-4o";

  // DEBUG: Log the brand object being used
  console.log("🎨 GENERATION PIPELINE — Brand Data:", {
    id: brand.id,
    companyName: brand.companyName,
    phone: brand.phone,
    website: brand.website,
    tagline: brand.tagline,
  });

  // Step 1: Detect campaign + headline using GPT
  const refImages  = getRefImages(brand.id, 2);
  const analysis   = await enhancePrompt(prompt, brand, campaignType, aspectRatio, eModel, refImages, brand);

  const finalCampaign = analysis.campaignType || campaignType;
  const finalRatio    = analysis.aspectRatio  || aspectRatio;
  const headline      = analysis.headline     || "";

  // Step 2: Build master prompt with ALL brand details for AI to render
  const masterPrompt = buildMasterPrompt(prompt, brand, finalCampaign, headline, refImages.length);

  // Step 3: Generate image — AI renders complete poster with text + brand info
  const size        = getImageSize(finalRatio, iModel);
  const imageBuffer = await generateImage(masterPrompt, size, iModel);

  // Step 4: Save
  const genId    = `gen_${uid()}`;
  const filename = `${genId}.png`;
  fs.writeFileSync(path.join(__dirname, "public/generated",  filename), imageBuffer);
  fs.writeFileSync(path.join(__dirname, "public/thumbnails", `${genId}_thumb.png`), imageBuffer);

  const base   = getBaseUrl(req);
  const record = {
    id: genId, brandId: brand.id || "default", prompt,
    enhancedPrompt: masterPrompt,
    campaignType: finalCampaign, headline,
    aspectRatio: finalRatio, imageModel: iModel, enhanceModel: eModel,
    imageUrl:     `${base}/public/generated/${filename}`,
    thumbnailUrl: `${base}/public/thumbnails/${genId}_thumb.png`,
    reasoning: analysis.reasoning,
    refImagesUsed: refImages.length,
    createdAt: new Date().toISOString(),
  };

  db.generations.unshift(record);
  writeDB(db);
  return record;
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════

app.get("/",       (_, res) => res.json({ status:"ok", app:"SparkOs v5" }));
app.get("/health", (_, res) => {
  const db  = readDB();
  const key = db.settings?.openaiKey || process.env.OPENAI_API_KEY || "";
  res.json({ status:"ok", version:"5.0.0", apiKeySet:!!key,
    imageModel:db.settings?.imageModel||"gpt-image-1",
    enhanceModel:db.settings?.enhanceModel||"gpt-4o" });
});

// ── Auth ───────────────────────────────────────────────────────────────────
app.post("/api/auth/login", (req, res) => {
  const db   = readDB();
  const hash = req.body.hash;
  if (!db.auth) db.auth = DEFAULT_DB().auth;
  if (hash === db.auth.passwordHash) res.json({ success:true });
  else res.status(401).json({ success:false, error:"Incorrect password" });
});

app.post("/api/auth/change-password", (req, res) => {
  const db = readDB();
  const { currentHash, newHash } = req.body;
  if (!db.auth) db.auth = DEFAULT_DB().auth;
  if (currentHash !== db.auth.passwordHash)
    return res.status(401).json({ error:"Current password is incorrect" });
  db.auth.passwordHash = newHash;
  writeDB(db);
  res.json({ success:true });
});

// ── Settings ───────────────────────────────────────────────────────────────
app.get("/api/settings", (_, res) => {
  const db = readDB();
  const s  = db.settings || {};
  const raw = s.openaiKey || process.env.OPENAI_API_KEY || "";
  res.json({
    apiKeySet:    !!raw,
    apiKeyMasked: raw ? raw.slice(0,7)+"••••••••••••••••"+raw.slice(-4) : "",
    imageModel:   s.imageModel   || "gpt-image-1",
    enhanceModel: s.enhanceModel || "gpt-4o",
  });
});

app.post("/api/settings", (req, res) => {
  const db = readDB();
  if (!db.settings) db.settings = DEFAULT_DB().settings;
  const { openaiKey, imageModel, enhanceModel } = req.body;
  if (openaiKey    !== undefined && openaiKey    !== "") db.settings.openaiKey    = openaiKey;
  if (imageModel   !== undefined) db.settings.imageModel   = imageModel;
  if (enhanceModel !== undefined) db.settings.enhanceModel = enhanceModel;
  writeDB(db);
  res.json({ success:true });
});

app.post("/api/settings/test-key", async (req, res) => {
  try {
    const db  = readDB();
    const key = req.body.openaiKey || db.settings?.openaiKey || process.env.OPENAI_API_KEY;
    if (!key) return res.status(400).json({ success:false, error:"No key provided" });
    const openai = new OpenAI({ apiKey: key });
    await openai.models.list();
    res.json({ success:true });
  } catch(e) { res.status(400).json({ success:false, error:e.message }); }
});

// ── Brands ─────────────────────────────────────────────────────────────────
app.get("/api/brands",     (_, res)  => { const db=readDB(); res.json({ brands:Object.values(db.brands||{}) }); });
app.post("/api/brands",    (req,res) => { const db=readDB(); const id=`brand_${uid()}`; db.brands[id]={id,...req.body,createdAt:new Date().toISOString()}; writeDB(db); res.json({success:true,brand:db.brands[id]}); });
app.put("/api/brands/:id", (req,res) => { const db=readDB(); if(!db.brands[req.params.id]) return res.status(404).json({error:"Not found"}); db.brands[req.params.id]={...db.brands[req.params.id],...req.body}; writeDB(db); res.json({success:true,brand:db.brands[req.params.id]}); });
app.delete("/api/brands/:id",(req,res)=>{ const db=readDB(); delete db.brands[req.params.id]; delete db.assets[req.params.id]; writeDB(db); res.json({success:true}); });

// ── Assets — upload + cache base64 in DB ──────────────────────────────────
app.post("/api/assets/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error:"No file uploaded" });
  const db      = readDB();
  const brandId = req.body.brandId || "default";
  const type    = req.query.type || "images";
  if (!db.assets[brandId]) db.assets[brandId] = { images:[], posters:[], docs:[] };

  const filePath     = path.join(__dirname, `uploads/${type}/${req.file.filename}`);
  const relativePath = `uploads/${type}/${req.file.filename}`;
  const url          = `${req.protocol}://${req.get("host")}/${relativePath}`;
  const fileId       = uid();

  // Cache base64 — used by pipeline for GPT vision without re-upload
  let base64 = null;
  const isImg = /jpeg|jpg|png|gif|webp/i.test(path.extname(req.file.originalname));
  if (isImg && type !== "docs") {
    try {
      const buf = fs.readFileSync(filePath);
      base64    = `data:${req.file.mimetype||"image/png"};base64,${buf.toString("base64")}`;
    } catch(e) { console.warn("base64 cache failed:", e.message); }
  }

  const entry = { id:fileId, path:relativePath, url, name:req.file.originalname, size:req.file.size, base64 };

  if (type === "logo") {
    db.assets[brandId].logo       = relativePath;
    db.assets[brandId].logoUrl    = url;
    db.assets[brandId].logoBase64 = base64;
  } else {
    if (!db.assets[brandId][type]) db.assets[brandId][type] = [];
    db.assets[brandId][type].push(entry);
  }

  writeDB(db);
  res.json({ success:true, url, path:relativePath, type, fileId });
});

app.get("/api/assets/:brandId", (req, res) => {
  const db     = readDB();
  const assets = db.assets[req.params.brandId] || {};
  const strip  = list => (list||[]).map(({ base64, ...rest }) => rest);
  res.json({ assets:{
    logo:    assets.logo ? { url:assets.logoUrl, path:assets.logo } : null,
    logoUrl: assets.logoUrl || null,
    images:  strip(assets.images),
    posters: strip(assets.posters),
    docs:    strip(assets.docs),
  }});
});

app.delete("/api/assets/:brandId/:type/:fileId", (req, res) => {
  const db = readDB();
  const { brandId, type, fileId } = req.params;
  if (db.assets[brandId]?.[type]) {
    const item = db.assets[brandId][type].find(i => i.id === fileId);
    if (item) { try { fs.unlinkSync(path.join(__dirname, item.path)); } catch {} }
    db.assets[brandId][type] = db.assets[brandId][type].filter(i => i.id !== fileId);
    writeDB(db);
  }
  res.json({ success:true });
});

// ── Generate ───────────────────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { brandId, prompt, campaignType, aspectRatio, imageModel, enhanceModel } = req.body;
  if (!prompt) return res.status(400).json({ error:"prompt is required" });
  const db    = readDB();
  const brand = brandId ? (db.brands[brandId]||{}) : (Object.values(db.brands)[0]||{});
  try {
    const result = await runPipeline({ prompt, brand, campaignType, aspectRatio, imageModel, enhanceModel, req });
    res.json({ success:true, ...result });
  } catch(err) {
    console.error("Generate error:", err.message);
    res.status(500).json({ success:false, error:err.message });
  }
});

// ── History ────────────────────────────────────────────────────────────────
app.get("/api/generations", (req, res) => {
  const db  = readDB();
  let gens  = db.generations || [];
  const { brandId, campaignType, limit=50, offset=0 } = req.query;
  if (brandId)      gens = gens.filter(g => g.brandId === brandId);
  if (campaignType) gens = gens.filter(g => g.campaignType === campaignType);
  res.json({ total:gens.length, generations:gens.slice(Number(offset), Number(offset)+Number(limit)) });
});

app.delete("/api/generations/:id", (req, res) => {
  const db  = readDB();
  const gen = db.generations.find(g => g.id === req.params.id);
  if (gen) ["public/generated","public/thumbnails"].forEach(dir => {
    const f = path.join(__dirname, dir, path.basename(gen.imageUrl||""));
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  });
  db.generations = db.generations.filter(g => g.id !== req.params.id);
  writeDB(db);
  res.json({ success:true });
});

// ── Webhook ────────────────────────────────────────────────────────────────
app.post("/webhook/generate", async (req, res) => {
  const { requestId, brandId, campaignType, prompt, aspectRatio, imageModel, enhanceModel, callbackUrl } = req.body;
  if (!prompt) return res.status(400).json({ success:false, error:"prompt is required" });
  const db    = readDB();
  const brand = brandId ? (db.brands[brandId]||{}) : (Object.values(db.brands)[0]||{});
  const logId = uid();
  db.webhookLogs.unshift({ id:logId, requestId, brandId, prompt, status:"processing", receivedAt:new Date().toISOString() });
  writeDB(db);
  res.json({ success:true, status:"processing", requestId, logId });
  setImmediate(async () => {
    try {
      const result  = await runPipeline({ prompt, brand, campaignType:campaignType||"auto", aspectRatio:aspectRatio||"1:1", imageModel, enhanceModel, req:{protocol:"https",get:()=>process.env.BASE_URL||"localhost:3001"} });
      const payload = { success:true, requestId, generationId:result.id, imageUrl:result.imageUrl, thumbnailUrl:result.thumbnailUrl, brandId:result.brandId, campaignType:result.campaignType, headline:result.headline, createdAt:result.createdAt };
      const fresh = readDB();
      const idx   = fresh.webhookLogs.findIndex(l => l.id===logId);
      if (idx>-1) Object.assign(fresh.webhookLogs[idx], { status:"success", ...payload });
      writeDB(fresh);
      if (callbackUrl) {
        const { default:fetch } = await import("node-fetch");
        await fetch(callbackUrl, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }).catch(e=>console.warn("CB:",e.message));
      }
    } catch(err) {
      const fresh = readDB();
      const idx   = fresh.webhookLogs.findIndex(l => l.id===logId);
      if (idx>-1) { fresh.webhookLogs[idx].status="error"; fresh.webhookLogs[idx].error=err.message; }
      writeDB(fresh);
    }
  });
});

app.post("/webhook/generate/sync", async (req, res) => {
  const { requestId, brandId, campaignType, prompt, aspectRatio, imageModel, enhanceModel } = req.body;
  if (!prompt) return res.status(400).json({ success:false, error:"prompt is required" });
  const db    = readDB();
  const brand = brandId ? (db.brands[brandId]||{}) : (Object.values(db.brands)[0]||{});
  try {
    const result = await runPipeline({ prompt, brand, campaignType:campaignType||"auto", aspectRatio:aspectRatio||"1:1", imageModel, enhanceModel, req });
    res.json({ success:true, requestId, generationId:result.id, imageUrl:result.imageUrl, thumbnailUrl:result.thumbnailUrl, brandId:result.brandId, campaignType:result.campaignType, headline:result.headline, createdAt:result.createdAt });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

app.get("/api/webhook/logs", (_, res) => {
  const db = readDB();
  res.json({ logs:(db.webhookLogs||[]).slice(0,100) });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../frontend/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n⚡ SparkOs v5 → http://localhost:${PORT}`);
  console.log(`   API key stored: ${!!readDB().settings?.openaiKey}`);
});

module.exports = app;
