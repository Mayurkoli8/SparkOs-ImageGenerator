import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Building2, FolderOpen, Sparkles, Image as ImageIcon,
  History, Webhook, Settings, Upload, Download, Copy, CheckCircle2,
  Key, Trash2, Eye, EyeOff, Star, TrendingUp, Clock, AlertCircle,
  FileText, Play, CheckCheck, X, Layers, Link2, RefreshCw
} from "lucide-react";

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const CAMPAIGN_TYPES = [
  { value: "auto", label: "Auto Detect" },
  { value: "festival", label: "Festival Post" },
  { value: "new_year", label: "New Year" },
  { value: "property_launch", label: "Property Launch" },
  { value: "offer", label: "Offer Promotion" },
  { value: "site_visit", label: "Site Visit Invite" },
  { value: "possession", label: "Possession Update" },
  { value: "milestone", label: "Milestone Announcement" },
  { value: "brand_awareness", label: "Brand Awareness" },
  { value: "testimonial", label: "Testimonial" },
  { value: "project_highlight", label: "Project Highlight" },
  { value: "construction_update", label: "Construction Update" },
];

const ASPECT_RATIOS = [
  { value: "1:1",  label: "1:1",  size: "1024x1024", desc: "Square Feed" },
  { value: "4:5",  label: "4:5",  size: "1024x1024", desc: "Portrait Feed" },
  { value: "9:16", label: "9:16", size: "1024x1792", desc: "Stories/Reels" },
  { value: "16:9", label: "16:9", size: "1792x1024", desc: "Landscape" },
];

const BRAND_TYPES = [
  "Premium Real Estate", "Luxury Apartments", "Affordable Housing",
  "Commercial Real Estate", "Villa Projects", "Plotted Development",
];

// ── All available image models ──────────────────────────
const IMAGE_MODELS = [
  { value: "gpt-image-1",  label: "GPT Image 1",          desc: "OpenAI multimodal image model" },
  { value: "gpt-image-1.5",  label: "GPT Image 1.5 ✦ Recommended", desc: "Best quality, most detailed" },
  { value: "dall-e-3",     label: "DALL-E 3",              desc: "High quality, HD mode available" },
  { value: "dall-e-2",     label: "DALL-E 2",              desc: "Faster, lower cost" },
];

// ── GPT models used for prompt enhancement ──────────────
const ENHANCE_MODELS = [
  { value: "gpt-4o",       label: "GPT-4o (Recommended)" },
  { value: "gpt-4o-mini",  label: "GPT-4o Mini (Faster)"  },
  { value: "gpt-4-turbo",  label: "GPT-4 Turbo"           },
];

// ═══════════════════════════════════════════════════════
// API UTILITIES  — 100% OpenAI, zero Anthropic
// ═══════════════════════════════════════════════════════

/** Prompt enhancement via OpenAI Chat Completions */
async function enhanceWithOpenAI(systemPrompt, userMsg, apiKey, gptModel = "gpt-4o") {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: gptModel,
      max_tokens: 900,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMsg },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI Chat error");
  return data.choices[0].message.content;
}

/** Image generation via OpenAI Images API */
async function generateImage(prompt, size, apiKey, model) {
  // gpt-image-1 and gpt-image-1.5 share the same endpoint but slightly different params
  const isGptImage = model === "gpt-image-1" || model === "gpt-image-1.5";

  const body = isGptImage
    ? { model, prompt, n: 1, size }
    : {
        model,
        prompt,
        n: 1,
        size,
        quality: "hd",
        response_format: "b64_json",
      };

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Image generation failed");

  const b64 = data.data[0].b64_json || data.data[0].b64;
  if (b64) return `data:image/png;base64,${b64}`;

  // Some models return a URL instead of b64
  return data.data[0].url || "";
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Returns the base URL of this running app — used to show webhook endpoint */
function getAppBaseUrl() {
  return `${window.location.protocol}//${window.location.host}`;
}

// ═══════════════════════════════════════════════════════
// CANVAS BRAND OVERLAY
// ═══════════════════════════════════════════════════════

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function applyBrandOverlay(baseDataUrl, brand, logoDataUrl) {
  const loadImg = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload  = () => res(img);
      img.onerror = () => rej(new Error("Image load failed"));
      img.src = src;
    });

  const canvas = document.createElement("canvas");
  canvas.width  = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  try {
    const base = await loadImg(baseDataUrl);
    ctx.drawImage(base, 0, 0, 1080, 1080);

    // Dark gradient at bottom
    const grad = ctx.createLinearGradient(0, 650, 0, 1080);
    grad.addColorStop(0,   "rgba(0,0,0,0)");
    grad.addColorStop(0.4, "rgba(0,0,0,0.65)");
    grad.addColorStop(1,   "rgba(0,0,0,0.93)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 650, 1080, 430);

    // Brand accent bar at bottom
    ctx.fillStyle = brand.primaryColor || "#C9A96E";
    ctx.fillRect(0, 1070, 1080, 10);

    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur  = 6;

    // Company name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 46px Georgia, serif";
    ctx.fillText(brand.companyName || "Your Company", 44, 890);

    // Tagline
    if (brand.tagline && brand.showTagline !== false) {
      ctx.font      = "italic 26px Georgia, serif";
      ctx.fillStyle = brand.primaryColor || "#C9A96E";
      ctx.fillText(brand.tagline, 44, 928);
    }

    // Contact
    ctx.shadowBlur = 3;
    ctx.font       = "22px Arial, sans-serif";
    ctx.fillStyle  = "rgba(255,255,255,0.85)";
    let yPos = 968;
    if (brand.phone && brand.showPhone !== false) {
      ctx.fillText(`\u260E  ${brand.phone}`, 44, yPos);
      yPos += 34;
    }
    if (brand.website && brand.showWebsite !== false) {
      ctx.fillStyle = "rgba(220,220,220,0.8)";
      ctx.font      = "20px Arial, sans-serif";
      ctx.fillText(`\u{1F310}  ${brand.website}`, 44, yPos);
    }

    // Logo top-right
    if (logoDataUrl && brand.showLogo !== false) {
      try {
        const logo = await loadImg(logoDataUrl);
        const lx = 1080 - 120, ly = 20, lw = 100, lh = 100;
        ctx.shadowBlur = 15;
        ctx.fillStyle  = "rgba(255,255,255,0.95)";
        drawRoundRect(ctx, lx - 8, ly - 8, lw + 16, lh + 16, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.drawImage(logo, lx, ly, lw, lh);
      } catch {}
    }

    return canvas.toDataURL("image/png", 0.93);
  } catch {
    return baseDataUrl;
  }
}

// ═══════════════════════════════════════════════════════
// UI ATOMS
// ═══════════════════════════════════════════════════════

function Btn({ children, onClick, variant = "primary", size = "md", disabled, loading, full, className = "" }) {
  const sz = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-2.5 text-sm" }[size];
  const v = {
    primary:   "bg-amber-500 text-gray-950 hover:bg-amber-400 font-semibold disabled:opacity-40",
    secondary: "bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 disabled:opacity-40",
    ghost:     "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 disabled:opacity-40",
    danger:    "bg-red-950 text-red-400 border border-red-900/60 hover:bg-red-900/40",
    success:   "bg-green-950 text-green-400 border border-green-900/60",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-lg transition-all focus:outline-none ${sz} ${v} ${full ? "w-full justify-center" : ""} ${className}`}
    >
      {loading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

function Inp({ value, onChange, placeholder, type = "text", className = "", readOnly }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full bg-gray-900 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/70 transition-colors ${readOnly ? "opacity-60 cursor-default" : ""} ${className}`}
    />
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500/70 transition-colors"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Txta({ value, onChange, placeholder, rows = 3, mono = false }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-gray-900 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/70 transition-colors resize-none ${mono ? "font-mono text-green-400" : ""}`}
    />
  );
}

function Lbl({ children }) {
  return <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{children}</label>;
}

function Card({ children, className = "" }) {
  return <div className={`bg-gray-900 border border-gray-800/80 rounded-xl ${className}`}>{children}</div>;
}

function Stat({ label, value, icon: Icon, color = "amber" }) {
  const colors = {
    amber:  "text-amber-400 bg-amber-500/10",
    green:  "text-green-400 bg-green-500/10",
    blue:   "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={14} className={colors[color].split(" ")[0]} />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-100">{value}</div>
    </Card>
  );
}

function Badge({ children, color = "amber" }) {
  const c = {
    amber:  "bg-amber-900/30 text-amber-400 border-amber-800/40",
    green:  "bg-green-900/30 text-green-400 border-green-800/40",
    blue:   "bg-blue-900/30 text-blue-400 border-blue-800/40",
    red:    "bg-red-900/30 text-red-400 border-red-800/40",
    gray:   "bg-gray-800/60 text-gray-400 border-gray-700/40",
    purple: "bg-purple-900/30 text-purple-400 border-purple-800/40",
  }[color];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c}`}>{children}</span>;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm shadow-2xl max-w-sm ${type === "success" ? "bg-green-950 border-green-800/60 text-green-300" : "bg-red-950 border-red-800/60 text-red-300"}`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

function DropZone({ onFiles, accept, multiple = false, children }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  return (
    <div
      className={`border-2 border-dashed rounded-xl cursor-pointer transition-all ${drag ? "border-amber-500 bg-amber-500/5" : "border-gray-700/70 hover:border-gray-600"}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(Array.from(e.dataTransfer.files)); }}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files || []))} />
      {children}
    </div>
  );
}

function ColorPicker({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent p-0.5" />
      <div className="flex-1"><Inp value={value} onChange={onChange} placeholder="#C9A96E" /></div>
      {label && <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════

const NAV = [
  { k: "dashboard", label: "Dashboard",    icon: LayoutDashboard },
  { k: "brand",     label: "Brand Setup",  icon: Building2 },
  { k: "assets",    label: "Assets",       icon: FolderOpen },
  { k: "studio",    label: "Prompt Studio",icon: Sparkles },
  { k: "preview",   label: "Preview",      icon: ImageIcon },
  { k: "history",   label: "History",      icon: History },
  { k: "webhook",   label: "Webhook",      icon: Webhook },
  { k: "settings",  label: "API Settings", icon: Settings },
];

function Sidebar({ active, setActive, histLen, hasKey, hasBrand }) {
  return (
    <aside className="w-52 bg-gray-950 border-r border-gray-800/80 flex flex-col shrink-0 h-screen">
      <div className="p-4 border-b border-gray-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Sparkles size={15} className="text-gray-950" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-100 leading-none">SparkOs</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Image Studio</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setActive(k)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${active === k ? "bg-amber-500/12 text-amber-400 border border-amber-500/20 font-medium" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"}`}>
            <Icon size={15} />
            <span>{label}</span>
            {k === "history" && histLen > 0 && (
              <span className="ml-auto text-[10px] bg-gray-800 text-gray-400 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{histLen}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800/80 space-y-1.5">
        <div className={`flex items-center gap-2 text-[11px] ${hasKey ? "text-green-400" : "text-gray-600"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-green-400" : "bg-gray-600"}`} />
          OpenAI {hasKey ? "Connected" : "Not Set"}
        </div>
        <div className={`flex items-center gap-2 text-[11px] ${hasBrand ? "text-amber-400" : "text-gray-600"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasBrand ? "bg-amber-400" : "bg-gray-600"}`} />
          Brand {hasBrand ? "Ready" : "Not Set"}
        </div>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

function Dashboard({ history, brand, assets, setTab }) {
  const thisMonth = history.filter((h) =>
    new Date(h.createdAt).getMonth() === new Date().getMonth()
  ).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Welcome to SparkOs</h1>
        <p className="text-sm text-gray-500 mt-1">AI-powered brand poster generation for real estate marketing</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat label="Total Generated" value={history.length}      icon={ImageIcon}   color="amber"  />
        <Stat label="This Month"      value={thisMonth}           icon={TrendingUp}  color="green"  />
        <Stat label="Brand Assets"    value={[assets.logo, ...assets.images, ...assets.posters].filter(Boolean).length} icon={FolderOpen} color="blue" />
        <Stat label="Campaigns"       value={[...new Set(history.map((h) => h.campaignType))].length} icon={Layers} color="purple" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">
          <Card className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300">Quick Generate</h3>
              <Badge color="amber">Studio</Badge>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Jump straight into generating. Configure your brand first for best results.
              GPT-4o auto-enhances your prompt with brand context.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {["New Year Post", "Property Launch", "Festival Greeting", "Offer Promotion"].map((t) => (
                <button key={t} onClick={() => setTab("studio")}
                  className="text-left px-3 py-2 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/40 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-all">
                  <span className="text-amber-500 mr-1.5">✦</span>{t}
                </button>
              ))}
            </div>
            <Btn onClick={() => setTab("studio")} variant="primary" size="sm" className="mt-4">
              <Sparkles size={13} /> Open Prompt Studio
            </Btn>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Setup Checklist</h3>
          <div className="space-y-2.5">
            {[
              { done: !!brand.companyName,       label: "Company name set",     tab: "brand"   },
              { done: !!assets.logo,             label: "Logo uploaded",        tab: "assets"  },
              { done: !!brand.primaryColor,      label: "Brand colors set",     tab: "brand"   },
              { done: assets.images.length > 0, label: "Project images added", tab: "assets"  },
              { done: history.length > 0,        label: "First poster generated",tab: "studio" },
            ].map(({ done, label, tab }) => (
              <button key={label} onClick={() => !done && setTab(tab)}
                className={`w-full flex items-center gap-2.5 text-xs ${done ? "text-gray-500" : "text-gray-400 hover:text-gray-200"} transition-colors`}>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${done ? "bg-green-500/20 border-green-600" : "border-gray-600"}`}>
                  {done && <CheckCheck size={9} className="text-green-400" />}
                </div>
                <span className={done ? "line-through" : ""}>{label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {history.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Recent Generations</h3>
            <Btn variant="ghost" size="sm" onClick={() => setTab("history")}>View All</Btn>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {history.slice(0, 4).map((item) => (
              <div key={item.id} className="group relative rounded-lg overflow-hidden bg-gray-800 aspect-square cursor-pointer"
                onClick={() => setTab("preview")}>
                <img src={item.imageDataUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <div>
                    <Badge color="amber">{item.campaignType.replace(/_/g, " ")}</Badge>
                    <p className="text-[10px] text-gray-300 mt-1 line-clamp-2">{item.prompt}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BRAND SETUP
// ═══════════════════════════════════════════════════════

function BrandSetup({ brand, setBrand, onSave }) {
  const [tab, setTab] = useState("info");
  const upd = (k) => (v) => setBrand((b) => ({ ...b, [k]: v }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Brand Setup</h2>
          <p className="text-xs text-gray-500 mt-0.5">Your brand info is injected into every AI prompt automatically</p>
        </div>
        <Btn onClick={onSave} variant="primary"><CheckCircle2 size={14} /> Save Brand</Btn>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-lg p-1">
        {[["info", "Company Info"], ["identity", "Brand Identity"], ["rules", "Branding Rules"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 text-xs py-1.5 rounded-md transition-all ${tab === k ? "bg-amber-500 text-gray-950 font-semibold" : "text-gray-500 hover:text-gray-300"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Lbl>Company Name *</Lbl><Inp value={brand.companyName} onChange={upd("companyName")} placeholder="e.g. Prestige Group" /></div>
            <div><Lbl>Brand Type</Lbl><Sel value={brand.brandType} onChange={upd("brandType")} options={BRAND_TYPES.map((b) => ({ value: b, label: b }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Lbl>Website</Lbl><Inp value={brand.website} onChange={upd("website")} placeholder="www.yourcompany.com" /></div>
            <div><Lbl>Phone</Lbl><Inp value={brand.phone} onChange={upd("phone")} placeholder="+91 98765 43210" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Lbl>Email</Lbl><Inp value={brand.email} onChange={upd("email")} placeholder="sales@company.com" /></div>
            <div><Lbl>RERA Number</Lbl><Inp value={brand.rera} onChange={upd("rera")} placeholder="RERA-XXXX" /></div>
          </div>
          <div><Lbl>Address</Lbl><Txta value={brand.address} onChange={upd("address")} placeholder="Office address" rows={2} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Lbl>Instagram</Lbl><Inp value={brand.instagram} onChange={upd("instagram")} placeholder="@handle" /></div>
            <div><Lbl>Facebook</Lbl><Inp value={brand.facebook} onChange={upd("facebook")} placeholder="page name" /></div>
            <div><Lbl>YouTube</Lbl><Inp value={brand.youtube} onChange={upd("youtube")} placeholder="channel" /></div>
          </div>
        </Card>
      )}

      {tab === "identity" && (
        <Card className="p-5 space-y-4">
          <div><Lbl>Tagline / Slogan</Lbl><Inp value={brand.tagline} onChange={upd("tagline")} placeholder="e.g. Building Dreams, Creating Legacies" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Lbl>Primary Color</Lbl><ColorPicker value={brand.primaryColor} onChange={upd("primaryColor")} label="Main accent" /></div>
            <div><Lbl>Secondary Color</Lbl><ColorPicker value={brand.secondaryColor} onChange={upd("secondaryColor")} label="Supporting" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Lbl>Text Color</Lbl><ColorPicker value={brand.textColor} onChange={upd("textColor")} label="Headlines" /></div>
            <div><Lbl>Background Color</Lbl><ColorPicker value={brand.bgColor} onChange={upd("bgColor")} label="Backgrounds" /></div>
          </div>
          <div>
            <Lbl>Brand Tone & Voice</Lbl>
            <Inp value={brand.tone} onChange={upd("tone")} placeholder="e.g. premium, professional, aspirational, trustworthy" />
            <p className="text-[11px] text-gray-600 mt-1">Comma-separated — injected into every AI generation prompt</p>
          </div>
          <div>
            <Lbl>Design Style</Lbl>
            <Sel value={brand.designStyle} onChange={upd("designStyle")} options={[
              { value: "luxury-minimal",  label: "Luxury Minimal"   },
              { value: "modern-bold",     label: "Modern Bold"      },
              { value: "classic-elegant", label: "Classic Elegant"  },
              { value: "vibrant-dynamic", label: "Vibrant Dynamic"  },
              { value: "clean-corporate", label: "Clean Corporate"  },
            ]} />
          </div>
          <div><Lbl>Typography Preference</Lbl><Inp value={brand.typography} onChange={upd("typography")} placeholder="e.g. elegant serif, modern sans-serif, mixed" /></div>
        </Card>
      )}

      {tab === "rules" && (
        <Card className="p-5 space-y-4">
          <div>
            <Lbl>Logo Placement</Lbl>
            <div className="grid grid-cols-3 gap-2">
              {["top-left","top-center","top-right","bottom-left","bottom-center","bottom-right"].map((p) => (
                <button key={p} onClick={() => upd("logoPlacement")(p)}
                  className={`py-2 text-xs rounded-lg border transition-all ${brand.logoPlacement === p ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-gray-700 text-gray-500 hover:border-gray-600"}`}>
                  {p.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Lbl>Content to Always Include</Lbl>
            <div className="grid grid-cols-2 gap-2">
              {[["showPhone","Phone Number"],["showWebsite","Website URL"],["showLogo","Logo"],["showTagline","Tagline"],["showAddress","Address"],["showSocial","Social Handles"]].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={brand[k] !== false} onChange={(e) => upd(k)(e.target.checked)} className="accent-amber-500" />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div><Lbl>Design Restrictions / Do Nots</Lbl><Txta value={brand.restrictions} onChange={upd("restrictions")} placeholder="e.g. No dark backgrounds, avoid red color..." rows={3} /></div>
          <div><Lbl>Special Instructions for AI</Lbl><Txta value={brand.aiInstructions} onChange={upd("aiInstructions")} placeholder="e.g. Always show luxury apartments, use warm lighting..." rows={3} /></div>
          <div><Lbl>Disclaimer / Legal Text</Lbl><Inp value={brand.disclaimer} onChange={upd("disclaimer")} placeholder="e.g. *T&C Apply. RERA registered project." /></div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ASSET UPLOAD
// ═══════════════════════════════════════════════════════

function AssetUpload({ assets, setAssets, showToast }) {
  const handleLogo = async (files) => {
    if (!files.length) return;
    const dataUrl = await fileToDataUrl(files[0]);
    setAssets((a) => ({ ...a, logo: { name: files[0].name, dataUrl } }));
    showToast("Logo uploaded!", "success");
  };
  const handleImages = async (files) => {
    const arr = await Promise.all(files.map(async (f) => ({ id: uid(), name: f.name, dataUrl: await fileToDataUrl(f) })));
    setAssets((a) => ({ ...a, images: [...a.images, ...arr] }));
    showToast(`${files.length} image(s) added`, "success");
  };
  const handlePosters = async (files) => {
    const arr = await Promise.all(files.map(async (f) => ({ id: uid(), name: f.name, dataUrl: await fileToDataUrl(f) })));
    setAssets((a) => ({ ...a, posters: [...a.posters, ...arr] }));
    showToast(`${files.length} reference poster(s) added`, "success");
  };
  const handleDocs = async (files) => {
    setAssets((a) => ({ ...a, docs: [...a.docs, ...files.map((f) => ({ id: uid(), name: f.name, size: f.size }))] }));
    showToast(`${files.length} document(s) added`, "success");
  };
  const removeItem = (type, id) => setAssets((a) => ({ ...a, [type]: a[type].filter((i) => i.id !== id) }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-100">Asset Library</h2>
        <p className="text-xs text-gray-500 mt-0.5">Upload brand assets used in AI generation and brand overlay mode</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={14} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-gray-200">Company Logo</h3>
            <span className="text-[10px] text-red-400">Required</span>
          </div>
          {assets.logo ? (
            <div>
              <div className="w-full h-32 bg-gray-800 rounded-lg flex items-center justify-center">
                <img src={assets.logo.dataUrl} alt="logo" className="max-w-full max-h-full object-contain p-3" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500 truncate">{assets.logo.name}</span>
                <Btn variant="ghost" size="sm" onClick={() => setAssets((a) => ({ ...a, logo: null }))}><Trash2 size={12} /></Btn>
              </div>
            </div>
          ) : (
            <DropZone onFiles={handleLogo} accept="image/*">
              <div className="p-6 text-center">
                <Upload size={24} className="text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Drop logo here or click</p>
                <p className="text-[11px] text-gray-600 mt-1">PNG, SVG recommended</p>
              </div>
            </DropZone>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-200">Project Images</h3>
            <Badge color="blue">{assets.images.length}</Badge>
          </div>
          <DropZone onFiles={handleImages} accept="image/*" multiple>
            <div className="p-4 text-center"><Upload size={20} className="text-gray-600 mx-auto mb-1" /><p className="text-xs text-gray-500">Drop multiple images</p></div>
          </DropZone>
          {assets.images.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {assets.images.map((img) => (
                <div key={img.id} className="group relative aspect-square rounded-md overflow-hidden bg-gray-800">
                  <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeItem("images", img.id)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-gray-200">Reference Posters</h3>
            <Badge color="purple">{assets.posters.length}</Badge>
          </div>
          <p className="text-[11px] text-gray-600 mb-3">Upload sample posters for AI style reference</p>
          <DropZone onFiles={handlePosters} accept="image/*" multiple>
            <div className="p-4 text-center"><Upload size={20} className="text-gray-600 mx-auto mb-1" /><p className="text-xs text-gray-500">Drop sample designs</p></div>
          </DropZone>
          {assets.posters.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {assets.posters.map((p) => (
                <div key={p.id} className="group relative aspect-square rounded-md overflow-hidden bg-gray-800">
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeItem("posters", p.id)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} className="text-green-400" />
            <h3 className="text-sm font-semibold text-gray-200">Documents</h3>
            <Badge color="green">{assets.docs.length}</Badge>
          </div>
          <p className="text-[11px] text-gray-600 mb-3">Brochures, pricing sheets, project details</p>
          <DropZone onFiles={handleDocs} accept=".pdf,.docx,.txt,.doc" multiple>
            <div className="p-4 text-center"><Upload size={20} className="text-gray-600 mx-auto mb-1" /><p className="text-xs text-gray-500">PDF, DOCX, TXT</p></div>
          </DropZone>
          {assets.docs.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {assets.docs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-800/60 rounded-lg">
                  <FileText size={12} className="text-gray-500 shrink-0" />
                  <span className="text-xs text-gray-400 flex-1 truncate">{d.name}</span>
                  <span className="text-[11px] text-gray-600">{(d.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => removeItem("docs", d.id)} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROMPT STUDIO
// ═══════════════════════════════════════════════════════

function PromptStudio({ brand, assets, openAIKey, imageModel, enhanceModel, history, setHistory, setPreview, setTab, showToast }) {
  const [prompt,          setPrompt]          = useState("");
  const [campaign,        setCampaign]        = useState("auto");
  const [ratio,           setRatio]           = useState("1:1");
  const [mode,            setMode]            = useState("ai");
  const [enhanced,        setEnhanced]        = useState("");
  const [detectedCampaign,setDetectedCampaign]= useState("");
  const [showEnhanced,    setShowEnhanced]    = useState(false);
  const [isGenerating,    setIsGenerating]    = useState(false);
  const [logs,            setLogs]            = useState([]);

  const addLog = (msg, type = "info") =>
    setLogs((l) => [...l, { msg, type, time: new Date().toLocaleTimeString() }]);

  const buildSystemPrompt = () => {
    const b = brand;
    return `You are a world-class marketing expert and AI image prompt engineer for ${b.brandType || "real estate"} marketing.

Brand: ${b.companyName || "Brand"}
Type: ${b.brandType || "Premium Real Estate"}
Colors: Primary ${b.primaryColor || "#C9A96E"}, Secondary ${b.secondaryColor || "#1A1A2E"}
Tone: ${b.tone || "premium, professional, aspirational"}
Style: ${b.designStyle || "luxury minimal"}
Tagline: ${b.tagline || ""}
AI Instructions: ${b.aiInstructions || "none"}
Restrictions: ${b.restrictions || "none"}

Transform the user's simple prompt into a rich, detailed image generation prompt for a STUNNING professional marketing poster.

RULES:
- High-end, premium visual quality
- Describe lighting, depth, atmosphere, color palette
- Leave natural space in composition for text overlay
- Do NOT include readable text in the image itself
- Match the brand's visual style and tone

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "campaignType": "one of: festival|new_year|property_launch|offer|site_visit|possession|milestone|brand_awareness|testimonial|project_highlight|construction_update",
  "enhancedPrompt": "detailed image generation prompt here",
  "aspectRatio": "1:1 or 4:5 or 9:16 or 16:9",
  "reasoning": "brief explanation"
}`;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { showToast("Please enter a prompt", "error"); return; }
    if (!openAIKey)     { showToast("OpenAI API key required — go to API Settings", "error"); return; }

    setIsGenerating(true);
    setLogs([]);
    setShowEnhanced(false);

    try {
      // ── Step 1: Enhance prompt using GPT-4o (no Anthropic needed) ──
      addLog(`Enhancing prompt with ${enhanceModel}...`, "info");
      const raw = await enhanceWithOpenAI(
        buildSystemPrompt(),
        `User prompt: "${prompt}". Selected campaign: ${campaign}. Preferred ratio: ${ratio}.`,
        openAIKey,
        enhanceModel
      );

      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      } catch {
        parsed = { campaignType: campaign === "auto" ? "brand_awareness" : campaign, enhancedPrompt: prompt, aspectRatio: ratio, reasoning: "" };
      }

      const finalCampaign = parsed.campaignType || campaign;
      const finalPrompt   = parsed.enhancedPrompt || prompt;
      const finalRatio    = parsed.aspectRatio || ratio;

      setEnhanced(finalPrompt);
      setDetectedCampaign(finalCampaign);
      setShowEnhanced(true);
      addLog(`✓ Campaign: ${finalCampaign}`, "success");
      addLog(`✓ Ratio: ${finalRatio}`, "success");

      // ── Step 2: Generate image ──
      addLog(`Generating with ${imageModel}...`, "info");
      const ratioObj  = ASPECT_RATIOS.find((r) => r.value === finalRatio) || ASPECT_RATIOS[0];
      const imgDataUrl = await generateImage(finalPrompt, ratioObj.size, openAIKey, imageModel);
      addLog("✓ Image generated!", "success");

      let finalImg = imgDataUrl;

      // ── Step 3: Optional brand overlay ──
      if (mode === "overlay") {
        addLog("Applying brand overlay...", "info");
        finalImg = await applyBrandOverlay(imgDataUrl, brand, assets.logo?.dataUrl);
        addLog("✓ Brand overlay applied!", "success");
      }

      const gen = {
        id: uid(), prompt, enhancedPrompt: finalPrompt, campaignType: finalCampaign,
        aspectRatio: finalRatio, mode, imageDataUrl: finalImg,
        createdAt: new Date().toISOString(), reasoning: parsed.reasoning || "",
      };

      setHistory((h) => [gen, ...h]);
      setPreview(gen);
      addLog("Saved to history.", "success");
      setTimeout(() => setTab("preview"), 600);
    } catch (err) {
      addLog(`Error: ${err.message}`, "error");
      showToast(err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-100">Prompt Studio</h2>
        <p className="text-xs text-gray-500 mt-0.5">GPT-4o enhances your simple prompt — {imageModel} generates the image</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <Card className="p-4">
            <Lbl>Your Prompt</Lbl>
            <Txta value={prompt} onChange={setPrompt} rows={4}
              placeholder={`e.g. "Create a New Year post" or "Property launch for Skyline Tower" or "Diwali festival offer"`} />
            <p className="text-[11px] text-gray-600 mt-1.5">Keep it simple — AI handles the creative work</p>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <Lbl>Campaign Type</Lbl>
              <Sel value={campaign} onChange={setCampaign} options={CAMPAIGN_TYPES} />
              {campaign === "auto" && <p className="text-[11px] text-gray-600 mt-1.5">AI will auto-detect from your prompt</p>}
            </Card>
            <Card className="p-4">
              <Lbl>Aspect Ratio</Lbl>
              <div className="grid grid-cols-2 gap-1.5">
                {ASPECT_RATIOS.map((r) => (
                  <button key={r.value} onClick={() => setRatio(r.value)}
                    className={`py-1.5 text-xs rounded-lg border transition-all ${ratio === r.value ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-gray-700 text-gray-500 hover:border-gray-600"}`}>
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-[10px] opacity-70">{r.desc}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <Lbl>Generation Mode</Lbl>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "ai",      icon: Sparkles, label: "AI Full Control",  desc: "AI generates the full design including branding. Best creative results." },
                { v: "overlay", icon: Layers,   label: "Brand Overlay",    desc: "AI generates base visual, then logo + contact + website overlaid programmatically." },
              ].map(({ v, icon: Icon, label, desc }) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`p-3 rounded-xl border text-left transition-all ${mode === v ? "border-amber-500 bg-amber-500/8" : "border-gray-700 hover:border-gray-600"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={13} className={mode === v ? "text-amber-400" : "text-gray-500"} />
                    <span className={`text-xs font-semibold ${mode === v ? "text-amber-400" : "text-gray-400"}`}>{label}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">{desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {showEnhanced && enhanced && (
            <Card className="p-4 border-amber-800/30 bg-amber-950/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400">GPT-Enhanced Prompt</span>
                  {detectedCampaign && <Badge color="amber">{detectedCampaign.replace(/_/g, " ")}</Badge>}
                </div>
                <button onClick={() => setShowEnhanced(false)} className="text-gray-600 hover:text-gray-400"><X size={13} /></button>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{enhanced}</p>
            </Card>
          )}

          <Btn onClick={handleGenerate} loading={isGenerating} disabled={!prompt.trim() || !openAIKey} variant="primary" size="lg" full>
            {isGenerating ? "Generating..." : <><Play size={15} /> Generate Poster</>}
          </Btn>

          {!openAIKey && (
            <div className="flex items-center gap-2 text-xs text-amber-500/80 bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2">
              <AlertCircle size={13} />
              <span>Add your OpenAI API key in API Settings to enable generation</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <Lbl>Quick Templates</Lbl>
            <div className="space-y-1.5">
              {["Create a New Year 2025 post","Property launch announcement","Diwali festival offer post","Site visit this weekend","Possession ceremony update","5 years celebration milestone","Luxury apartment showcase"].map((t) => (
                <button key={t} onClick={() => setPrompt(t)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-all border border-transparent hover:border-gray-700/40">
                  <span className="text-amber-600 mr-1">›</span> {t}
                </button>
              ))}
            </div>
          </Card>

          {logs.length > 0 && (
            <Card className="p-4">
              <Lbl>Generation Log</Lbl>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {logs.map((l, i) => (
                  <div key={i} className={`flex items-start gap-2 text-[11px] ${l.type === "success" ? "text-green-400" : l.type === "error" ? "text-red-400" : "text-gray-500"}`}>
                    <span className="shrink-0 text-gray-700">{l.time}</span>
                    <span>{l.msg}</span>
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex items-center gap-2 text-[11px] text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Processing...
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <Lbl>Assets in Use</Lbl>
            <div className="space-y-1.5">
              {[
                { label: "Logo",              val: assets.logo ? "✓ Ready" : "Not uploaded", ok: !!assets.logo },
                { label: "Project images",    val: `${assets.images.length} files`,          ok: assets.images.length > 0 },
                { label: "Reference posters", val: `${assets.posters.length} files`,         ok: assets.posters.length > 0 },
                { label: "Brand name",        val: brand.companyName || "Not set",           ok: !!brand.companyName },
              ].map(({ label, val, ok }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{label}</span>
                  <span className={ok ? "text-green-400" : "text-gray-600"}>{val}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PREVIEW
// ═══════════════════════════════════════════════════════

function PreviewSection({ item, brand, assets, history, setHistory, showToast }) {
  const [applying, setApplying] = useState(false);
  const [copied,   setCopied]   = useState(false);

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <ImageIcon size={48} className="text-gray-700 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-600">No preview yet</h3>
          <p className="text-sm text-gray-700 mt-1">Generate a poster in Prompt Studio to preview it here</p>
        </div>
      </div>
    );
  }

  const download = () => {
    const a = document.createElement("a");
    a.href     = item.imageDataUrl;
    a.download = `sparkos-${item.campaignType}-${item.id}.png`;
    a.click();
    showToast("Downloaded!", "success");
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(item.imageDataUrl.substring(0, 80) + "... [full base64]");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyOverlay = async () => {
    setApplying(true);
    try {
      const overlaid = await applyBrandOverlay(item.imageDataUrl, brand, assets.logo?.dataUrl);
      const updated  = { ...item, imageDataUrl: overlaid, mode: "overlay" };
      setHistory((h) => h.map((g) => (g.id === item.id ? updated : g)));
      showToast("Brand overlay applied!", "success");
    } catch { showToast("Failed to apply overlay", "error"); }
    setApplying(false);
  };

  const arStyle = item.aspectRatio === "16:9" ? "16/9" : item.aspectRatio === "9:16" ? "9/16" : "1/1";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Preview</h2>
          <p className="text-xs text-gray-500 mt-0.5">{fmtDate(item.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {item.mode !== "overlay" && (
            <Btn onClick={applyOverlay} loading={applying} variant="secondary" size="sm">
              <Layers size={13} /> Apply Brand Overlay
            </Btn>
          )}
          <Btn onClick={copyUrl} variant="secondary" size="sm">
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy URL"}
          </Btn>
          <Btn onClick={download} variant="primary" size="sm"><Download size={13} /> Download</Btn>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card className="p-2 bg-gray-950">
            <div className="relative bg-gray-800 rounded-lg overflow-hidden" style={{ aspectRatio: arStyle, maxHeight: "70vh" }}>
              <img src={item.imageDataUrl} alt="Generated poster" className="w-full h-full object-contain" />
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</h4>
            <div className="space-y-3">
              <div><span className="text-[11px] text-gray-600">Campaign</span><div className="mt-0.5"><Badge color="amber">{item.campaignType.replace(/_/g, " ")}</Badge></div></div>
              <div><span className="text-[11px] text-gray-600">Aspect Ratio</span><div className="text-xs text-gray-300 mt-0.5">{item.aspectRatio}</div></div>
              <div><span className="text-[11px] text-gray-600">Mode</span><div className="text-xs text-gray-300 mt-0.5">{item.mode === "overlay" ? "Brand Overlay" : "AI Full Control"}</div></div>
              <div><span className="text-[11px] text-gray-600">Original Prompt</span><p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.prompt}</p></div>
              {item.reasoning && <div><span className="text-[11px] text-gray-600">AI Reasoning</span><p className="text-xs text-gray-500 mt-0.5 italic">{item.reasoning}</p></div>}
            </div>
          </Card>
          <Card className="p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Enhanced Prompt</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{item.enhancedPrompt}</p>
          </Card>
          <Btn onClick={download} variant="primary" size="md" full><Download size={14} /> Download Full Resolution</Btn>
          {item.mode !== "overlay" && (
            <Btn onClick={applyOverlay} loading={applying} variant="secondary" size="md" full><Layers size={14} /> Apply Brand Overlay</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════

function HistorySection({ history, setPreview, setTab, setHistory, showToast }) {
  const [filter, setFilter] = useState("all");
  const filtered  = filter === "all" ? history : history.filter((h) => h.campaignType === filter);
  const allTypes  = [...new Set(history.map((h) => h.campaignType))];

  const download = (item) => {
    const a = document.createElement("a");
    a.href = item.imageDataUrl;
    a.download = `sparkos-${item.campaignType}-${item.id}.png`;
    a.click();
    showToast("Downloaded!", "success");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Generation History</h2>
          <p className="text-xs text-gray-500 mt-0.5">{history.length} poster{history.length !== 1 ? "s" : ""} generated</p>
        </div>
        {history.length > 0 && (
          <Btn onClick={() => { if (confirm("Clear all history?")) setHistory([]); }} variant="danger" size="sm">
            <Trash2 size={13} /> Clear All
          </Btn>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Clock size={40} className="text-gray-700 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-600">No generations yet</h3>
            <p className="text-sm text-gray-700 mt-1">Your generated posters will appear here</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setFilter("all")} className={`px-3 py-1 rounded-full text-xs transition-all ${filter === "all" ? "bg-amber-500 text-gray-950 font-semibold" : "bg-gray-800 text-gray-500 hover:text-gray-300"}`}>All ({history.length})</button>
            {allTypes.map((t) => (
              <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1 rounded-full text-xs transition-all ${filter === t ? "bg-amber-500 text-gray-950 font-semibold" : "bg-gray-800 text-gray-500 hover:text-gray-300"}`}>
                {t.replace(/_/g, " ")} ({history.filter((h) => h.campaignType === t).length})
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {filtered.map((item) => (
              <Card key={item.id} className="overflow-hidden group">
                <div className="relative aspect-square bg-gray-800 cursor-pointer" onClick={() => { setPreview(item); setTab("preview"); }}>
                  <img src={item.imageDataUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye size={20} className="text-white" />
                  </div>
                  {item.mode === "overlay" && <div className="absolute top-1.5 left-1.5"><Badge color="green">Branded</Badge></div>}
                </div>
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Badge color="amber">{item.campaignType.replace(/_/g, " ")}</Badge>
                    <Badge color="gray">{item.aspectRatio}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.prompt}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-700">{fmtDate(item.createdAt)}</span>
                    <button onClick={() => download(item)} className="text-gray-600 hover:text-amber-400 transition-colors"><Download size={13} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WEBHOOK  — URL auto-detected from window.location
// ═══════════════════════════════════════════════════════

function WebhookSettings({ brand, openAIKey, imageModel, enhanceModel, showToast }) {
  // ── Auto-detect the app's own base URL ──────────────────
  const baseUrl = getAppBaseUrl();
  const webhookEndpoint      = `${baseUrl}/webhook/generate`;
  const webhookEndpointSync  = `${baseUrl}/webhook/generate/sync`;

  const [callbackUrl,  setCallbackUrl]  = useState("");
  const [testPayload,  setTestPayload]  = useState(
    JSON.stringify({ requestId: "req_abc123", brandId: "brand_001", campaignType: "new_year", prompt: "Create a premium New Year post", aspectRatio: "1:1", mode: "overlay" }, null, 2)
  );
  const [webhookLogs,  setWebhookLogs]  = useState([]);
  const [simulating,   setSimulating]   = useState(false);
  const [copiedMain,   setCopiedMain]   = useState(false);
  const [copiedSync,   setCopiedSync]   = useState(false);

  const copyText = (text, setter) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const simulateWebhook = async () => {
    if (!openAIKey) { showToast("OpenAI key required", "error"); return; }
    setSimulating(true);
    const logEntry = { id: uid(), ts: new Date().toISOString(), status: "processing" };
    setWebhookLogs((l) => [logEntry, ...l]);

    try {
      const parsed = JSON.parse(testPayload);
      const sys = `You are a marketing prompt enhancer for ${brand.brandType || "real estate"}. Brand: ${brand.companyName || "Brand"}. Tone: ${brand.tone || "premium"}. Return ONLY JSON: { "enhancedPrompt": "...", "size": "1024x1024" }`;
      const raw = await enhanceWithOpenAI(sys, `Enhance: "${parsed.prompt}" for campaign: ${parsed.campaignType}`, openAIKey, enhanceModel);
      let ep;
      try { ep = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { ep = { enhancedPrompt: parsed.prompt, size: "1024x1024" }; }

      await generateImage(ep.enhancedPrompt, ep.size || "1024x1024", openAIKey, imageModel);

      const result = { success: true, generationId: `gen_${uid()}`, imageUrl: `${baseUrl}/public/generated/...`, brandId: parsed.brandId, campaignType: parsed.campaignType, createdAt: new Date().toISOString() };
      setWebhookLogs((l) => l.map((lg) => lg.id === logEntry.id ? { ...lg, status: "success", result } : lg));
      showToast("Simulation successful!", "success");
    } catch (err) {
      setWebhookLogs((l) => l.map((lg) => lg.id === logEntry.id ? { ...lg, status: "error", error: err.message } : lg));
      showToast("Simulation failed: " + err.message, "error");
    }
    setSimulating(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-100">Webhook Integration</h2>
        <p className="text-xs text-gray-500 mt-0.5">Connect with n8n, Zapier, Make, or any automation tool</p>
      </div>

      {/* ── Auto-configured endpoints ───────────────────────── */}
      <Card className="p-5 mb-4 border-green-900/40 bg-green-950/10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-green-400">Your Webhook Endpoints — Auto Configured</h3>
        </div>

        <div className="space-y-3">
          <div>
            <Lbl>Async Endpoint (recommended for n8n)</Lbl>
            <div className="flex gap-2">
              <div className="flex-1 font-mono text-xs bg-gray-950 border border-gray-700/60 rounded-lg px-3 py-2 text-green-400 flex items-center">{webhookEndpoint}</div>
              <button onClick={() => copyText(webhookEndpoint, setCopiedMain)}
                className="px-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-green-400 transition-colors">
                {copiedMain ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">Returns immediately, sends result to your callbackUrl when done</p>
          </div>

          <div>
            <Lbl>Sync Endpoint (waits for result ~20s)</Lbl>
            <div className="flex gap-2">
              <div className="flex-1 font-mono text-xs bg-gray-950 border border-gray-700/60 rounded-lg px-3 py-2 text-blue-400 flex items-center">{webhookEndpointSync}</div>
              <button onClick={() => copyText(webhookEndpointSync, setCopiedSync)}
                className="px-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-blue-400 transition-colors">
                {copiedSync ? <CheckCircle2 size={14} className="text-blue-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">Waits for generation to complete, returns full result directly</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Input Payload</h4>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-green-400 overflow-auto max-h-52">
            <pre>{JSON.stringify({ requestId: "req_abc123", brandId: "brand_001", campaignType: "new_year | festival | ...", prompt: "Create a New Year post", aspectRatio: "1:1 | 4:5 | 9:16 | 16:9", mode: "ai | overlay", callbackUrl: "https://your-n8n.com/callback" }, null, 2)}</pre>
          </div>
        </Card>
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Success Response</h4>
          <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-blue-400 overflow-auto max-h-52">
            <pre>{JSON.stringify({ success: true, generationId: "gen_k8f2m", imageUrl: `${baseUrl}/public/generated/gen_k8f2m.png`, thumbnailUrl: `${baseUrl}/public/thumbnails/gen_k8f2m_thumb.png`, brandId: "brand_001", campaignType: "new_year", createdAt: new Date().toISOString() }, null, 2)}</pre>
          </div>
        </Card>
      </div>

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-300">Webhook Tester</h4>
          <Badge color="amber">Live Test</Badge>
        </div>
        <div className="mb-3">
          <Lbl>n8n Callback URL (optional)</Lbl>
          <Inp value={callbackUrl} onChange={setCallbackUrl} placeholder="https://your-n8n.com/webhook/callback" />
        </div>
        <Lbl>Test Payload (JSON)</Lbl>
        <div className="mb-3">
          <Txta value={testPayload} onChange={setTestPayload} rows={7} mono />
        </div>
        <Btn onClick={simulateWebhook} loading={simulating} variant="primary">
          <Play size={13} /> Run Live Simulation
        </Btn>
        {!openAIKey && <p className="text-xs text-amber-500/70 mt-2">⚠ Add OpenAI API key in API Settings first</p>}
      </Card>

      {webhookLogs.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-300">Webhook Logs</h4>
            <button onClick={() => setWebhookLogs([])} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
          </div>
          <div className="space-y-2">
            {webhookLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-950 rounded-lg">
                <Badge color={log.status === "success" ? "green" : log.status === "error" ? "red" : "gray"}>{log.status}</Badge>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-gray-600">{fmtDate(log.ts)}</span>
                  {log.result && <p className="text-xs text-green-400 mt-1">✓ generationId: {log.result.generationId}</p>}
                  {log.error  && <p className="text-xs text-red-400 mt-1">{log.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// API SETTINGS  — OpenAI only, model picker for both
// ═══════════════════════════════════════════════════════

function ApiSettings({ openAIKey, setOpenAIKey, imageModel, setImageModel, enhanceModel, setEnhanceModel, showToast }) {
  const [show,    setShow]    = useState(false);
  const [testing, setTesting] = useState(false);
  const [local,   setLocal]   = useState(openAIKey);

  const testKey = async () => {
    if (!local) { showToast("Enter an API key first", "error"); return; }
    setTesting(true);
    try {
      const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${local}` } });
      if (res.ok) showToast("✓ OpenAI API key is valid!", "success");
      else        showToast("Invalid API key", "error");
    } catch { showToast("Connection failed", "error"); }
    setTesting(false);
  };

  const save = () => { setOpenAIKey(local); showToast("API key saved!", "success"); };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-100">API Settings</h2>
        <p className="text-xs text-gray-500 mt-0.5">One OpenAI key powers everything — prompt enhancement + image generation</p>
      </div>

      {/* OpenAI Key */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-gray-200">OpenAI API Key</h3>
          {openAIKey && <Badge color="green">Active</Badge>}
        </div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <Inp type={show ? "text" : "password"} value={local} onChange={setLocal} placeholder="sk-proj-..." />
          </div>
          <button onClick={() => setShow(!show)} className="px-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <Btn onClick={save} variant="primary" size="sm">Save Key</Btn>
          <Btn onClick={testKey} loading={testing} variant="secondary" size="sm">Test Connection</Btn>
        </div>
        <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-lg">
          <p className="text-xs text-amber-600 leading-relaxed">
            <strong className="text-amber-500">Security:</strong> Key stored in memory only — never sent to any server except OpenAI. Cleared on tab close.
          </p>
        </div>
      </Card>

      {/* Image Generation Model */}
      <Card className="p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Image Generation Model</h3>
        <p className="text-xs text-gray-600 mb-3">Choose the model that generates your posters</p>
        <div className="space-y-2">
          {IMAGE_MODELS.map((m) => (
            <button key={m.value} onClick={() => setImageModel(m.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${imageModel === m.value ? "border-amber-500 bg-amber-500/8" : "border-gray-700 hover:border-gray-600"}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${imageModel === m.value ? "border-amber-500" : "border-gray-600"}`}>
                {imageModel === m.value && <div className="w-2 h-2 rounded-full bg-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${imageModel === m.value ? "text-amber-400" : "text-gray-300"}`}>{m.label}</div>
                <div className="text-[11px] text-gray-600 mt-0.5">{m.desc}</div>
              </div>
              {m.value === "gpt-image-1.5" && <Badge color="amber">Recommended</Badge>}
            </button>
          ))}
        </div>
      </Card>

      {/* Prompt Enhancement Model */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Prompt Enhancement Model</h3>
        <p className="text-xs text-gray-600 mb-3">GPT model used to analyze your prompt and build the image prompt</p>
        <div className="space-y-2">
          {ENHANCE_MODELS.map((m) => (
            <button key={m.value} onClick={() => setEnhanceModel(m.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${enhanceModel === m.value ? "border-blue-500 bg-blue-500/8" : "border-gray-700 hover:border-gray-600"}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${enhanceModel === m.value ? "border-blue-500" : "border-gray-600"}`}>
                {enhanceModel === m.value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <div className={`text-sm font-medium ${enhanceModel === m.value ? "text-blue-400" : "text-gray-300"}`}>{m.label}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 p-3 bg-blue-950/20 border border-blue-900/30 rounded-lg">
          <p className="text-xs text-blue-400/80 leading-relaxed">
            Same OpenAI API key is used for both enhancement and generation. No Anthropic key needed.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════

export default function SparkOs() {
  const [activeTab,    setActiveTab]    = useState("dashboard");
  const [brand,        setBrand]        = useState({
    companyName: "", website: "", phone: "", email: "", address: "",
    tagline: "", brandType: "Premium Real Estate",
    primaryColor: "#C9A96E", secondaryColor: "#1A1A2E",
    textColor: "#FFFFFF", bgColor: "#0A0A0A",
    instagram: "", facebook: "", youtube: "", rera: "",
    tone: "premium, professional, aspirational",
    designStyle: "luxury-minimal", typography: "elegant serif",
    logoPlacement: "top-right",
    showPhone: true, showWebsite: true, showLogo: true,
    showTagline: true, showAddress: false, showSocial: false,
    restrictions: "", aiInstructions: "", disclaimer: "",
  });
  const [assets,       setAssets]       = useState({ logo: null, images: [], posters: [], docs: [] });
  const [history,      setHistory]      = useState([]);
  const [preview,      setPreview]      = useState(null);
  const [openAIKey,    setOpenAIKey]    = useState("");
  const [imageModel,   setImageModel]   = useState("gpt-image-1.5");   // ← default to gpt-image-1.5
  const [enhanceModel, setEnhanceModel] = useState("gpt-4o");
  const [toast,        setToast]        = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type, id: uid() });
  }, []);

  const hasBrand = !!(brand.companyName && brand.primaryColor);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        select option { background: #1a1a2e; color: #e2e8f0; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <Sidebar active={activeTab} setActive={setActiveTab} histLen={history.length} hasKey={!!openAIKey} hasBrand={hasBrand} />

      <main className="flex-1 overflow-y-auto bg-gray-950">
        {activeTab === "dashboard" && <Dashboard history={history} brand={brand} assets={assets} setTab={setActiveTab} />}
        {activeTab === "brand"     && <BrandSetup brand={brand} setBrand={setBrand} onSave={() => showToast("Brand profile saved!", "success")} />}
        {activeTab === "assets"    && <AssetUpload assets={assets} setAssets={setAssets} showToast={showToast} />}
        {activeTab === "studio"    && (
          <PromptStudio brand={brand} assets={assets} openAIKey={openAIKey} imageModel={imageModel}
            enhanceModel={enhanceModel} history={history} setHistory={setHistory}
            setPreview={setPreview} setTab={setActiveTab} showToast={showToast} />
        )}
        {activeTab === "preview"   && (
          <PreviewSection item={preview || history[0]} brand={brand} assets={assets}
            history={history} setHistory={setHistory} showToast={showToast} />
        )}
        {activeTab === "history"   && (
          <HistorySection history={history} setPreview={setPreview} setTab={setActiveTab}
            setHistory={setHistory} showToast={showToast} />
        )}
        {activeTab === "webhook"   && (
          <WebhookSettings brand={brand} openAIKey={openAIKey} imageModel={imageModel}
            enhanceModel={enhanceModel} showToast={showToast} />
        )}
        {activeTab === "settings"  && (
          <ApiSettings openAIKey={openAIKey} setOpenAIKey={setOpenAIKey}
            imageModel={imageModel} setImageModel={setImageModel}
            enhanceModel={enhanceModel} setEnhanceModel={setEnhanceModel}
            showToast={showToast} />
        )}
      </main>

      {toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
