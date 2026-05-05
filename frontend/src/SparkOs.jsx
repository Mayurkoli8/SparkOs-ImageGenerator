/**
 * SparkOs v5 — AI Brand Poster Generator
 * Clean complete rewrite — no browser storage, server-side generation
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Building2, FolderOpen, Sparkles, Image as ImageIcon,
  History, Webhook, Settings, Upload, Download, Copy, CheckCircle2,
  Key, Trash2, Eye, EyeOff, Star, TrendingUp, Clock, AlertCircle,
  FileText, Play, CheckCheck, X, Lock, Plus, ChevronDown,
  LogOut, Pencil, Users, Shield, Info, RefreshCw
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const BACKEND = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

const IMAGE_MODELS = [
  { value:"gpt-image-1",   label:"GPT Image 1",   desc:"Stable · Recommended (default)" },
  { value:"gpt-image-1.5", label:"GPT Image 1.5", desc:"Use if you have access" },
  { value:"gpt-image-2",   label:"GPT Image 2",   desc:"Use if you have access" },
  { value:"dall-e-3",      label:"DALL-E 3",       desc:"High quality HD mode" },
  { value:"dall-e-2",      label:"DALL-E 2",       desc:"Faster · Lower cost" },
  { value:"custom",        label:"Custom Model…",  desc:"Type any model name in settings" },
];

const ENHANCE_MODELS = [
  { value:"gpt-4o",      label:"GPT-4o",      desc:"Best results — reads reference images" },
  { value:"gpt-4o-mini", label:"GPT-4o Mini", desc:"Faster · Lower cost" },
  { value:"gpt-4-turbo", label:"GPT-4 Turbo", desc:"Powerful alternative" },
];

const CAMPAIGN_TYPES = [
  { value:"auto",                label:"Auto Detect" },
  { value:"festival",            label:"Festival Post" },
  { value:"new_year",            label:"New Year" },
  { value:"property_launch",     label:"Property Launch" },
  { value:"offer",               label:"Offer Promotion" },
  { value:"site_visit",          label:"Site Visit Invite" },
  { value:"possession",          label:"Possession Update" },
  { value:"milestone",           label:"Milestone" },
  { value:"brand_awareness",     label:"Brand Awareness" },
  { value:"testimonial",         label:"Testimonial" },
  { value:"project_highlight",   label:"Project Highlight" },
  { value:"construction_update", label:"Construction Update" },
];

const ASPECT_RATIOS = [
  { value:"1:1",  desc:"Square Feed" },
  { value:"4:5",  desc:"Portrait Feed" },
  { value:"9:16", desc:"Stories / Reels" },
  { value:"16:9", desc:"Landscape" },
];

const BRAND_TYPES = [
  "Premium Real Estate","Luxury Apartments","Affordable Housing",
  "Commercial Real Estate","Villa Projects","Plotted Development",
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getImageSize(ratio, model) {
  const isGpt = ["gpt-image-1","gpt-image-1.5","gpt-image-2"].includes(model);
  const isDe3 = model === "dall-e-3";
  const s = {
    "1:1":  { gpt:"1024x1024", de3:"1024x1024", de2:"1024x1024" },
    "4:5":  { gpt:"1024x1536", de3:"1024x1792", de2:"1024x1024" },
    "9:16": { gpt:"1024x1536", de3:"1024x1792", de2:"1024x1024" },
    "16:9": { gpt:"1536x1024", de3:"1792x1024", de2:"1024x1024" },
  };
  const e = s[ratio] || s["1:1"];
  return isGpt ? e.gpt : isDe3 ? e.de3 : e.de2;
}

function useIsMobile() {
  const [mob, setMob] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mob;
}

function uid()     { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmtDate(iso) {
  return new Date(iso).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}
async function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function api(path, opts = {}) {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    signal: AbortSignal.timeout(60000),
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ─────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────

const C = {
  bg:"#080808", sidebar:"#0c0c0c", card:"#111", input:"#0c0c0c",
  border:"#202020", borderSub:"#181818",
  text:"#eeeeee", textSec:"#777", textMuted:"#404040",
  red:"#e53935", redH:"#ef5350", redD:"rgba(229,57,53,0.10)", redB:"rgba(229,57,53,0.20)",
  green:"#43a047", greenD:"rgba(67,160,71,0.10)", greenB:"rgba(67,160,71,0.22)",
  blue:"#1e88e5",
};

const SI = {
  input: { background:C.input, border:`1px solid ${C.border}`, borderRadius:7, padding:"8px 12px", color:C.text, fontSize:13, width:"100%", outline:"none", fontFamily:"inherit" },
  label: { display:"block", fontSize:11, fontWeight:600, color:C.textMuted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 },
};
const fcs = (e, on) => { e.target.style.borderColor = on ? C.red : C.border; };

// ─────────────────────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────────────────────

function Btn({ children, onClick, variant="primary", size="md", disabled, loading, full, style={} }) {
  const pad = { sm:"7px 14px", md:"9px 18px", lg:"11px 26px" }[size];
  const fs  = size === "sm" ? 12 : 13;
  const vs  = {
    primary:   { background:C.red,    color:"#fff",     border:"none" },
    secondary: { background:"transparent", color:C.textSec, border:`1px solid ${C.border}` },
    ghost:     { background:"transparent", color:C.textMuted, border:"none" },
    danger:    { background:C.redD,   color:C.red,      border:`1px solid ${C.redB}` },
    success:   { background:C.greenD, color:C.green,    border:`1px solid ${C.greenB}` },
  }[variant] || {};
  return (
    <button onClick={onClick} disabled={disabled||loading}
      style={{ display:"inline-flex",alignItems:"center",gap:7,borderRadius:7,cursor:disabled||loading?"not-allowed":"pointer",
        fontWeight:600,fontSize:fs,padding:pad,transition:"all .15s",outline:"none",
        width:full?"100%":"auto",justifyContent:"center",opacity:disabled||loading?.5:1,
        fontFamily:"inherit",...vs,...style }}>
      {loading && <span style={{width:11,height:11,border:"2px solid currentColor",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>}
      {children}
    </button>
  );
}

function Inp({ value, onChange, placeholder, type="text", readOnly }) {
  return <input type={type} value={value} onChange={onChange?e=>onChange(e.target.value):undefined}
    placeholder={placeholder} readOnly={readOnly}
    style={{...SI.input, opacity:readOnly?.5:1}}
    onFocus={e=>fcs(e,true)} onBlur={e=>fcs(e,false)}/>;
}

function Sel({ value, onChange, options }) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{...SI.input,cursor:"pointer"}} onFocus={e=>fcs(e,true)} onBlur={e=>fcs(e,false)}>
    {options.map(o=><option key={o.value} value={o.value} style={{background:"#111",color:C.text}}>{o.label}</option>)}
  </select>;
}

function Txta({ value, onChange, placeholder, rows=3, mono }) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{...SI.input,resize:"none",lineHeight:1.65,fontFamily:mono?"monospace":"inherit"}}
    onFocus={e=>fcs(e,true)} onBlur={e=>fcs(e,false)}/>;
}

function Lbl({ children }) { return <label style={SI.label}>{children}</label>; }
function Card({ children, style={} }) { return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,...style}}>{children}</div>; }
function CP({ children, style={} }) { return <Card style={{padding:20,...style}}>{children}</Card>; }

function Badge({ children, color="red" }) {
  const cc = {
    red:  {bg:C.redD,   text:C.red,   bd:C.redB},
    green:{bg:C.greenD, text:C.green, bd:C.greenB},
    gray: {bg:"#1a1a1a",text:C.textSec,bd:C.border},
    blue: {bg:"rgba(30,136,229,.1)",text:"#42a5f5",bd:"rgba(30,136,229,.2)"},
  }[color]||{bg:C.redD,text:C.red,bd:C.redB};
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,background:cc.bg,color:cc.text,border:`1px solid ${cc.bd}`}}>{children}</span>;
}

function Toast({ msg, type, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,4000); return()=>clearTimeout(t); },[onClose]);
  return (
    <div style={{position:"fixed",bottom:20,right:20,zIndex:9999,display:"flex",alignItems:"center",gap:10,
      padding:"12px 16px",borderRadius:10,border:`1px solid ${type==="success"?C.greenB:C.redB}`,
      background:type==="success"?"#0b1b0c":"#1b0c0c",color:type==="success"?C.green:C.red,
      fontSize:13,boxShadow:"0 8px 40px rgba(0,0,0,.7)",maxWidth:380}}>
      {type==="success"?<CheckCircle2 size={15}/>:<AlertCircle size={15}/>}
      <span style={{flex:1}}>{msg}</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:"inherit",cursor:"pointer",opacity:.6}}><X size={13}/></button>
    </div>
  );
}

function DropZone({ onFiles, accept, multiple, children }) {
  const [drag,setDrag]=useState(false);
  const ref=useRef();
  return (
    <div style={{border:`2px dashed ${drag?C.red:C.border}`,borderRadius:10,cursor:"pointer",background:drag?C.redD:"transparent",transition:"all .15s"}}
      onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);onFiles(Array.from(e.dataTransfer.files));}}
      onClick={()=>ref.current?.click()}>
      <input ref={ref} type="file" accept={accept} multiple={multiple} style={{display:"none"}}
        onChange={e=>onFiles(Array.from(e.target.files||[]))}/>
      {children}
    </div>
  );
}

function Stat({ label, value, icon:Icon, color="red" }) {
  const col={red:C.red,green:C.green,blue:C.blue,purple:"#ab47bc"}[color];
  return (
    <CP style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:C.textMuted,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</span>
        <div style={{width:28,height:28,borderRadius:6,background:`${col}18`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon size={13} color={col}/>
        </div>
      </div>
      <span style={{fontSize:26,fontWeight:700,color:C.text}}>{value}</span>
    </CP>
  );
}

function RCard({ selected, onClick, label, desc, badge }) {
  return (
    <button onClick={onClick} style={{width:"100%",textAlign:"left",background:selected?C.redD:C.input,border:`1px solid ${selected?C.red:C.border}`,borderRadius:8,padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"flex-start",gap:10,transition:"all .15s"}}>
      <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${selected?C.red:C.border}`,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {selected&&<div style={{width:6,height:6,borderRadius:"50%",background:C.red}}/>}
      </div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:600,color:selected?C.red:C.text}}>{label}</span>
          {badge&&<Badge>{badge}</Badge>}
        </div>
        {desc&&<p style={{fontSize:11,color:C.textMuted,marginTop:3,lineHeight:1.5}}>{desc}</p>}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

function Login({ onLogin }) {
  const [pw,setPw]=useState(""); const [show,setShow]=useState(false);
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);

  const login = async () => {
    if (!pw) { setErr("Enter your password"); return; }
    setBusy(true); setErr("");
    try {
      const hash = await sha256(pw);
      const res  = await api("/api/auth/login", { method:"POST", body:JSON.stringify({hash}) });
      if (res.success) { sessionStorage.setItem("ss","1"); onLogin(); }
      else setErr("Incorrect password");
    } catch(e) { setErr("Cannot reach server — make sure backend is running and VITE_API_URL is set"); }
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"min(400px,94vw)",padding:"40px 32px",background:C.card,border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 24px 80px rgba(0,0,0,.8)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
            <img src="/SparkOs_Logo_2.png" alt="SparkOs" style={{height:42,width:"auto"}} onError={e=>{e.target.style.display="none";}}/>
          </div>
          <p style={{fontSize:13,color:C.textSec}}>Sign in to your workspace</p>
        </div>
        <Lbl>Password</Lbl>
        <div style={{position:"relative",marginBottom:12}}>
          <input type={show?"text":"password"} value={pw}
            onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
            placeholder="Enter password" autoFocus
            style={{...SI.input,paddingRight:42}}
            onFocus={e=>fcs(e,true)} onBlur={e=>fcs(e,false)}/>
          <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.textMuted,cursor:"pointer"}}>
            {show?<EyeOff size={14}/>:<Eye size={14}/>}
          </button>
        </div>
        {err&&<p style={{fontSize:12,color:C.red,marginBottom:12,display:"flex",alignItems:"flex-start",gap:6,lineHeight:1.5}}><AlertCircle size={13} style={{flexShrink:0,marginTop:1}}/>{err}</p>}
        <Btn onClick={login} loading={busy} full style={{padding:"11px 0",marginTop:4}}>
          <Lock size={14}/> Sign In
        </Btn>
        <p style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:20}}>
          Default password: <code style={{background:"#1a1a1a",padding:"2px 7px",borderRadius:4,color:C.textSec}}>sparkos2024</code>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────

const NAV = [
  { k:"dashboard", label:"Dashboard",     icon:LayoutDashboard },
  { k:"brands",    label:"Brands",        icon:Users },
  { k:"assets",    label:"Assets",        icon:FolderOpen },
  { k:"studio",    label:"Prompt Studio", icon:Sparkles },
  { k:"preview",   label:"Preview",       icon:ImageIcon },
  { k:"history",   label:"History",       icon:History },
  { k:"webhook",   label:"Webhook",       icon:Webhook },
  { k:"settings",  label:"Settings",      icon:Settings },
];

function Sidebar({ active, setActive, brands, activeBrand, setActiveBrand, histLen, hasKey, onLogout }) {
  const [bOpen,setBOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const isMobile=useIsMobile();
  const ref=useRef();

  useEffect(()=>{
    const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setBOpen(false);};
    document.addEventListener("mousedown",fn);
    return()=>document.removeEventListener("mousedown",fn);
  },[]);

  const BrandPicker = () => (
    <div ref={ref} style={{padding:"10px 10px 8px",borderBottom:`1px solid ${C.borderSub}`,position:"relative"}}>
      <p style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5,paddingLeft:4}}>Active Brand</p>
      <button onClick={()=>setBOpen(!bOpen)} style={{width:"100%",background:C.input,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:activeBrand?C.red:C.textMuted,flexShrink:0}}/>
          <span style={{fontSize:12,fontWeight:600,color:activeBrand?C.text:C.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeBrand?.companyName||"Select Brand"}</span>
        </div>
        <ChevronDown size={12} color={C.textMuted} style={{transform:bOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}/>
      </button>
      {bOpen&&(
        <div style={{position:"absolute",left:10,right:10,top:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,zIndex:50,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,.7)"}}>
          {brands.length===0&&<p style={{padding:"10px 12px",fontSize:12,color:C.textMuted}}>No brands yet</p>}
          {brands.map(b=>(
            <button key={b.id} onClick={()=>{setActiveBrand(b);setBOpen(false);localStorage.setItem("ab",b.id);}}
              style={{width:"100%",textAlign:"left",padding:"9px 12px",background:activeBrand?.id===b.id?C.redD:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${C.borderSub}`}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:activeBrand?.id===b.id?C.red:C.textMuted}}/>
              <span style={{fontSize:12,color:activeBrand?.id===b.id?C.red:C.text,fontWeight:activeBrand?.id===b.id?600:400}}>{b.companyName}</span>
            </button>
          ))}
          <button onClick={()=>{setActive("brands");setBOpen(false);if(isMobile)setMenuOpen(false);}}
            style={{width:"100%",textAlign:"left",padding:"9px 12px",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
            <Plus size={11} color={C.textSec}/><span style={{fontSize:12,color:C.textSec}}>Add Brand</span>
          </button>
        </div>
      )}
    </div>
  );

  const NavItems = ({ onNav }) => (
    <>
      {NAV.map(({k,label,icon:Icon})=>(
        <button key={k} onClick={()=>{setActive(k);if(onNav)onNav();}}
          style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:7,border:"none",cursor:"pointer",marginBottom:1,background:active===k?C.redD:"transparent",transition:"all .12s"}}>
          <Icon size={14} color={active===k?C.red:C.textMuted}/>
          <span style={{fontSize:12,fontWeight:active===k?600:400,color:active===k?C.red:C.textMuted}}>{label}</span>
          {k==="history"&&histLen>0&&<span style={{marginLeft:"auto",fontSize:10,background:"#1e1e1e",color:C.textSec,borderRadius:10,padding:"1px 6px"}}>{histLen}</span>}
        </button>
      ))}
    </>
  );

  if (isMobile) {
    const BOTTOM=[
      {k:"dashboard",icon:LayoutDashboard,label:"Home"},
      {k:"brands",   icon:Users,          label:"Brands"},
      {k:"studio",   icon:Sparkles,       label:"Studio"},
      {k:"history",  icon:History,        label:"History"},
    ];
    return (
      <>
        {menuOpen&&(
          <div style={{position:"fixed",inset:0,zIndex:200}}>
            <div onClick={()=>setMenuOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.7)"}}/>
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:250,background:C.sidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflowY:"auto"}}>
              <div style={{padding:"16px",borderBottom:`1px solid ${C.borderSub}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <img src="/SparkOs_Logo_2.png" alt="SparkOs" style={{height:30,width:"auto"}} onError={e=>{e.target.style.display="none";}}/>
                <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer"}}><X size={18}/></button>
              </div>
              <BrandPicker/>
              <nav style={{flex:1,padding:"8px"}}><NavItems onNav={()=>setMenuOpen(false)}/></nav>
              <div style={{padding:"12px 14px",borderTop:`1px solid ${C.borderSub}`}}>
                <div style={{fontSize:11,color:hasKey?C.green:C.textMuted,marginBottom:8}}>OpenAI {hasKey?"Connected":"Not Set"}</div>
                <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer"}}>
                  <LogOut size={13} color={C.textMuted}/><span style={{fontSize:12,color:C.textMuted}}>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:C.sidebar,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center"}}>
          {BOTTOM.map(({k,icon:Icon,label})=>(
            <button key={k} onClick={()=>setActive(k)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px",background:"transparent",border:"none",cursor:"pointer",gap:3}}>
              <Icon size={20} color={active===k?C.red:C.textMuted}/>
              <span style={{fontSize:10,color:active===k?C.red:C.textMuted,fontWeight:active===k?600:400}}>{label}</span>
            </button>
          ))}
          <button onClick={()=>setMenuOpen(true)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px",background:"transparent",border:"none",cursor:"pointer",gap:3}}>
            <Settings size={20} color={["settings","webhook","brandedit","assets"].includes(active)?C.red:C.textMuted}/>
            <span style={{fontSize:10,color:["settings","webhook","brandedit","assets"].includes(active)?C.red:C.textMuted}}>More</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <aside style={{width:210,background:C.sidebar,borderRight:`1px solid ${C.borderSub}`,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0}}>
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${C.borderSub}`}}>
        <img src="/SparkOs_Logo_2.png" alt="SparkOs" style={{height:34,width:"auto",maxWidth:"100%",display:"block"}} onError={e=>{e.target.style.display="none";}}/>
      </div>
      <BrandPicker/>
      <nav style={{flex:1,padding:"8px",overflowY:"auto"}}><NavItems/></nav>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${C.borderSub}`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:hasKey?C.green:C.textMuted}}/>
          <span style={{fontSize:11,color:hasKey?C.green:C.textMuted}}>OpenAI {hasKey?"Connected":"Not Set"}</span>
        </div>
        <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer"}}>
          <LogOut size={12} color={C.textMuted}/><span style={{fontSize:11,color:C.textMuted}}>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────

function Dashboard({ history, brands, activeBrand, assets, setTab }) {
  const isMobile=useIsMobile();
  const thisMonth=history.filter(h=>new Date(h.createdAt).getMonth()===new Date().getMonth()).length;
  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:960,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:isMobile?18:21,fontWeight:700,color:C.text,margin:0}}>Dashboard</h1>
        <p style={{fontSize:12,color:C.textSec,marginTop:4}}>{activeBrand?`Active: ${activeBrand.companyName}`:"Select or create a brand to get started"}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <Stat label="Total Generated" value={history.length}  icon={ImageIcon} color="red"/>
        <Stat label="This Month"      value={thisMonth}        icon={TrendingUp} color="green"/>
        <Stat label="Brands"          value={brands.length}    icon={Users}      color="blue"/>
        <Stat label="Assets"          value={(assets.images||[]).length+(assets.posters||[]).length} icon={FolderOpen} color="purple"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:14,marginBottom:16}}>
        <CP>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>Quick Start</span>
            <Badge>Studio</Badge>
          </div>
          <p style={{fontSize:12,color:C.textSec,marginBottom:14,lineHeight:1.7}}>AI generates complete posters — brand name, headline, phone &amp; website all rendered in the image. Upload reference posters to match your style.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
            {["New Year Post","Property Launch","Festival Greeting","Offer Promotion"].map(t=>(
              <button key={t} onClick={()=>setTab("studio")}
                style={{textAlign:"left",padding:"8px 12px",background:C.input,border:`1px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.textSec,cursor:"pointer"}}
                onMouseEnter={e=>{e.target.style.borderColor=C.red;e.target.style.color=C.text;}}
                onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.color=C.textSec;}}>
                <span style={{color:C.red,marginRight:6}}>›</span>{t}
              </button>
            ))}
          </div>
          <Btn onClick={()=>setTab("studio")} size="sm"><Sparkles size={13}/>Open Prompt Studio</Btn>
        </CP>
        <CP>
          <span style={{fontSize:13,fontWeight:600,color:C.text,display:"block",marginBottom:14}}>Setup Checklist</span>
          {[
            {done:brands.length>0,       label:"Brand created",         tab:"brands"},
            {done:!!assets.logo,          label:"Logo uploaded",         tab:"assets"},
            {done:!!activeBrand?.phone,   label:"Phone number set",      tab:"brandedit"},
            {done:(assets.posters||[]).length>0,label:"Reference posters added",tab:"assets"},
            {done:history.length>0,       label:"First poster generated",tab:"studio"},
          ].map(({done,label,tab})=>(
            <button key={label} onClick={()=>!done&&setTab(tab)}
              style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:done?"default":"pointer",padding:"5px 0",width:"100%"}}>
              <div style={{width:16,height:16,borderRadius:"50%",border:`1.5px solid ${done?C.green:C.border}`,background:done?C.greenD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {done&&<CheckCheck size={9} color={C.green}/>}
              </div>
              <span style={{fontSize:12,color:done?C.textMuted:C.textSec,textDecoration:done?"line-through":"none"}}>{label}</span>
            </button>
          ))}
        </CP>
      </div>
      {history.length>0&&(
        <CP>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>Recent Generations</span>
            <Btn variant="ghost" size="sm" onClick={()=>setTab("history")}>View All</Btn>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {history.slice(0,4).map(item=>(
              <div key={item.id} onClick={()=>setTab("preview")}
                style={{position:"relative",aspectRatio:"1",borderRadius:8,overflow:"hidden",background:"#1a1a1a",cursor:"pointer"}}>
                <img src={item.imageDataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              </div>
            ))}
          </div>
        </CP>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BRANDS MANAGER
// ─────────────────────────────────────────────────────────────

function BrandsManager({ brands, activeBrand, setActiveBrand, setBrands, setTab, showToast }) {
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const isMobile=useIsMobile();

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await api("/api/brands",{method:"POST",body:JSON.stringify({
        companyName:name,brandType:"Premium Real Estate",
        primaryColor:"#e53935",secondaryColor:"#1a1a1a",textColor:"#ffffff",bgColor:"#080808",
        tone:"premium, professional, aspirational",designStyle:"luxury-minimal",typography:"elegant serif",
        logoPlacement:"top-right",showPhone:true,showWebsite:true,showLogo:true,showTagline:true,
      })});
      const updated=[...brands,res.brand];
      setBrands(updated);setActiveBrand(res.brand);
      localStorage.setItem("ab",res.brand.id);
      setCreating(false);setName("");
      showToast(`Brand "${name}" created!`,"success");
    } catch(e){showToast(e.message,"error");}
    setLoading(false);
  };

  const del = async b => {
    if(!confirm(`Delete "${b.companyName}"?`))return;
    try {
      await api(`/api/brands/${b.id}`,{method:"DELETE"});
      const upd=brands.filter(x=>x.id!==b.id);
      setBrands(upd);
      if(activeBrand?.id===b.id){setActiveBrand(upd[0]||null);if(upd[0])localStorage.setItem("ab",upd[0].id);else localStorage.removeItem("ab");}
      showToast("Brand deleted","success");
    } catch(e){showToast(e.message,"error");}
  };

  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:760,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h2 style={{fontSize:isMobile?18:20,fontWeight:700,color:C.text,margin:0}}>Brand Manager</h2>
          <p style={{fontSize:12,color:C.textSec,marginTop:4}}>Each brand has independent assets, settings and history</p>
        </div>
        <Btn onClick={()=>setCreating(true)} size="sm"><Plus size={13}/>New Brand</Btn>
      </div>
      {creating&&(
        <CP style={{marginBottom:16,border:`1px solid ${C.redB}`,background:C.redD}}>
          <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>Create Brand</p>
          <Lbl>Company Name</Lbl>
          <Inp value={name} onChange={setName} placeholder="e.g. Prestige Group"/>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <Btn onClick={create} loading={loading}><Plus size={13}/>Create</Btn>
            <Btn variant="secondary" onClick={()=>{setCreating(false);setName("");}}>Cancel</Btn>
          </div>
        </CP>
      )}
      {brands.length===0&&!creating&&(
        <CP style={{textAlign:"center",padding:48}}>
          <Users size={36} color={C.textMuted} style={{marginBottom:12}}/>
          <p style={{fontSize:14,color:C.textSec,marginBottom:16}}>No brands yet</p>
          <Btn onClick={()=>setCreating(true)} size="sm"><Plus size={13}/>Create Brand</Btn>
        </CP>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {brands.map(b=>(
          <Card key={b.id} style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:38,height:38,borderRadius:9,background:b.primaryColor||C.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Building2 size={16} color="#fff"/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <span style={{fontSize:14,fontWeight:600,color:C.text}}>{b.companyName}</span>
                {activeBrand?.id===b.id&&<Badge>Active</Badge>}
              </div>
              <span style={{fontSize:11,color:C.textMuted}}>{b.brandType||"Brand"} · {b.website||"No website"}</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {activeBrand?.id!==b.id&&<Btn variant="secondary" size="sm" onClick={()=>{setActiveBrand(b);localStorage.setItem("ab",b.id);showToast(`Switched to ${b.companyName}`,"success");}}>Select</Btn>}
              <Btn variant="secondary" size="sm" onClick={()=>{setActiveBrand(b);localStorage.setItem("ab",b.id);setTab("brandedit");}}><Pencil size={12}/>Edit</Btn>
              <Btn variant="danger" size="sm" onClick={()=>del(b)}><Trash2 size={12}/></Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BRAND EDIT
// ─────────────────────────────────────────────────────────────

function BrandEdit({ brand, brands, setBrands, setActiveBrand, showToast }) {
  const [f,setF]=useState({...brand});
  const [tab,setTab]=useState("info");
  const [sav,setSav]=useState(false);
  const isMobile=useIsMobile();
  const u=k=>v=>setF(p=>({...p,[k]:v}));

  const save = async () => {
    setSav(true);
    try {
      const res=await api(`/api/brands/${brand.id}`,{method:"PUT",body:JSON.stringify(f)});
      setBrands(p=>p.map(b=>b.id===brand.id?res.brand:b));
      setActiveBrand(res.brand);
      showToast("Brand saved!","success");
    } catch(e){showToast(e.message,"error");}
    setSav(false);
  };

  const TB=({k,l})=>(<button onClick={()=>setTab(k)} style={{flex:1,padding:"8px",background:tab===k?C.red:"transparent",color:tab===k?"#fff":C.textSec,border:"none",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>);
  const CRow=({k,label})=>(<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.textSec,cursor:"pointer"}}><input type="checkbox" checked={f[k]!==false} onChange={e=>u(k)(e.target.checked)} style={{accentColor:C.red}}/>{label}</label>);

  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:660,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"space-between",flexDirection:isMobile?"column":"row",gap:isMobile?10:0,marginBottom:20}}>
        <div>
          <h2 style={{fontSize:isMobile?18:20,fontWeight:700,color:C.text,margin:0}}>Edit Brand</h2>
          <p style={{fontSize:12,color:C.red,marginTop:4}}>{f.companyName}</p>
        </div>
        <Btn onClick={save} loading={sav}><CheckCircle2 size={14}/>Save Changes</Btn>
      </div>
      <div style={{display:"flex",gap:4,background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:4,marginBottom:16}}>
        <TB k="info" l="Company Info"/><TB k="identity" l="Brand Identity"/><TB k="rules" l="AI Rules"/>
      </div>
      {tab==="info"&&(
        <CP style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            <div><Lbl>Company Name *</Lbl><Inp value={f.companyName||""} onChange={u("companyName")} placeholder="Prestige Group"/></div>
            <div><Lbl>Brand Type</Lbl><Sel value={f.brandType||"Premium Real Estate"} onChange={u("brandType")} options={BRAND_TYPES.map(b=>({value:b,label:b}))}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            <div><Lbl>Website</Lbl><Inp value={f.website||""} onChange={u("website")} placeholder="www.yourcompany.com"/></div>
            <div><Lbl>Phone</Lbl><Inp value={f.phone||""} onChange={u("phone")} placeholder="+91 98765 43210"/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            <div><Lbl>Email</Lbl><Inp value={f.email||""} onChange={u("email")} placeholder="sales@company.com"/></div>
            <div><Lbl>RERA</Lbl><Inp value={f.rera||""} onChange={u("rera")} placeholder="RERA-XXXX"/></div>
          </div>
          <div><Lbl>Address</Lbl><Txta value={f.address||""} onChange={u("address")} rows={2}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <div><Lbl>Instagram</Lbl><Inp value={f.instagram||""} onChange={u("instagram")} placeholder="@handle"/></div>
            <div><Lbl>Facebook</Lbl><Inp value={f.facebook||""} onChange={u("facebook")} placeholder="page"/></div>
            <div><Lbl>YouTube</Lbl><Inp value={f.youtube||""} onChange={u("youtube")} placeholder="channel"/></div>
          </div>
        </CP>
      )}
      {tab==="identity"&&(
        <CP style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><Lbl>Tagline</Lbl><Inp value={f.tagline||""} onChange={u("tagline")} placeholder="Building Dreams, Creating Legacies"/></div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            <div>
              <Lbl>Primary Color</Lbl>
              <div style={{display:"flex",gap:8}}>
                <input type="color" value={f.primaryColor||"#e53935"} onChange={e=>u("primaryColor")(e.target.value)} style={{width:36,height:36,border:"none",background:"none",cursor:"pointer",borderRadius:6,padding:2}}/>
                <Inp value={f.primaryColor||"#e53935"} onChange={u("primaryColor")} placeholder="#e53935"/>
              </div>
            </div>
            <div>
              <Lbl>Secondary Color</Lbl>
              <div style={{display:"flex",gap:8}}>
                <input type="color" value={f.secondaryColor||"#1a1a1a"} onChange={e=>u("secondaryColor")(e.target.value)} style={{width:36,height:36,border:"none",background:"none",cursor:"pointer",borderRadius:6,padding:2}}/>
                <Inp value={f.secondaryColor||"#1a1a1a"} onChange={u("secondaryColor")} placeholder="#1a1a1a"/>
              </div>
            </div>
          </div>
          <div><Lbl>Brand Tone</Lbl><Inp value={f.tone||""} onChange={u("tone")} placeholder="premium, professional, aspirational"/></div>
          <div><Lbl>Design Style</Lbl>
            <Sel value={f.designStyle||"luxury-minimal"} onChange={u("designStyle")} options={[
              {value:"luxury-minimal",label:"Luxury Minimal"},{value:"modern-bold",label:"Modern Bold"},
              {value:"classic-elegant",label:"Classic Elegant"},{value:"vibrant-dynamic",label:"Vibrant Dynamic"},
              {value:"clean-corporate",label:"Clean Corporate"},
            ]}/>
          </div>
          <div><Lbl>Typography Preference</Lbl><Inp value={f.typography||""} onChange={u("typography")} placeholder="elegant serif, modern sans-serif"/></div>
        </CP>
      )}
      {tab==="rules"&&(
        <CP style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <Lbl>Top-Right Corner (AI leaves this area clear of text)</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
              {["top-left","top-center","top-right","bottom-left","bottom-center","bottom-right"].map(p=>(
                <button key={p} onClick={()=>u("logoPlacement")(p)}
                  style={{padding:"8px",background:f.logoPlacement===p?C.redD:"transparent",border:`1px solid ${f.logoPlacement===p?C.red:C.border}`,borderRadius:7,fontSize:11,color:f.logoPlacement===p?C.red:C.textMuted,cursor:"pointer"}}>
                  {p.replace("-"," ")}
                </button>
              ))}
            </div>
            <p style={{fontSize:11,color:C.textMuted,marginTop:6}}>AI keeps this corner free of text — natural background only. No white box.</p>
          </div>
          <div>
            <Lbl>Brand Details to Include in Image</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <CRow k="showPhone" label="Phone Number"/><CRow k="showWebsite" label="Website URL"/>
              <CRow k="showTagline" label="Tagline"/><CRow k="showAddress" label="Address"/>
            </div>
          </div>
          <div><Lbl>Design Restrictions</Lbl><Txta value={f.restrictions||""} onChange={u("restrictions")} placeholder="No dark backgrounds, avoid red..." rows={3}/></div>
          <div><Lbl>Special AI Instructions</Lbl><Txta value={f.aiInstructions||""} onChange={u("aiInstructions")} placeholder="Always show luxury towers, warm lighting, happy families..." rows={3}/></div>
          <div><Lbl>Legal Disclaimer</Lbl><Inp value={f.disclaimer||""} onChange={u("disclaimer")} placeholder="*T&C Apply. RERA registered."/></div>
        </CP>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ASSET UPLOAD
// ─────────────────────────────────────────────────────────────

function AssetUpload({ activeBrand, assets, setAssets, showToast }) {
  const isMobile=useIsMobile();
  if (!activeBrand) return (
    <div style={{padding:28,textAlign:"center",paddingTop:80}}>
      <FolderOpen size={36} color={C.textMuted} style={{marginBottom:12}}/>
      <p style={{color:C.textSec}}>Select a brand first to manage assets</p>
    </div>
  );

  const uploadFile = async (file, type) => {
    try {
      const dataUrl  = await fileToDataUrl(file);
      const formData = new FormData();
      formData.append("file",file);
      formData.append("brandId",activeBrand.id);
      const res  = await fetch(`${BACKEND}/api/assets/upload?type=${type}`,{method:"POST",body:formData});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAssets(prev=>{
        if (type==="logo") return {...prev,logo:{name:file.name,dataUrl,url:data.url,fileId:data.fileId}};
        return {...prev,[type]:[...(prev[type]||[]),{id:data.fileId,name:file.name,dataUrl,url:data.url}]};
      });
      return true;
    } catch(e){showToast(e.message,"error");return false;}
  };

  const uploadMany = async (files, type) => {
    let ok=0;
    for (const f of files) { if (await uploadFile(f,type)) ok++; }
    if (ok) showToast(`${ok} file(s) uploaded & cached on server`,"success");
  };

  const rm=(type,id)=>setAssets(prev=>({...prev,[type]:prev[type].filter(i=>i.id!==id)}));

  const Box=({title,type,Icon,color,hint,accept,multi})=>(
    <CP>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <Icon size={14} color={color}/>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{title}</span>
        {type!=="logo"&&<Badge color="gray">{(assets[type]||[]).length} files</Badge>}
      </div>
      {hint&&<p style={{fontSize:11,color:C.textMuted,marginBottom:10}}>{hint}</p>}
      {type==="logo"&&assets.logo?(
        <div>
          <div style={{width:"100%",height:110,background:C.input,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
            <img src={assets.logo.dataUrl||assets.logo.url} alt="logo" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",padding:10}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:C.textMuted}}>{assets.logo.name}</span>
            <Btn variant="danger" size="sm" onClick={()=>setAssets(p=>({...p,logo:null}))}><Trash2 size={11}/></Btn>
          </div>
        </div>
      ):(
        <DropZone onFiles={f=>type==="logo"?uploadMany([f[0]],type):uploadMany(f,type)} accept={accept} multiple={multi}>
          <div style={{padding:20,textAlign:"center"}}>
            <Upload size={18} color={C.textMuted} style={{marginBottom:7}}/>
            <p style={{fontSize:12,color:C.textMuted}}>{multi?"Drop files or click":"Drop file or click"}</p>
          </div>
        </DropZone>
      )}
      {type!=="logo"&&(assets[type]||[]).length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}>
          {(assets[type]||[]).map(item=>(
            <div key={item.id} style={{position:"relative",aspectRatio:"1",borderRadius:7,overflow:"hidden",background:"#1a1a1a"}}>
              {(item.url||item.dataUrl)?<img src={item.url||item.dataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}><FileText size={16} color={C.textMuted}/></div>}
              <button onClick={()=>rm(type,item.id)} style={{position:"absolute",top:4,right:4,width:20,height:20,borderRadius:"50%",background:"rgba(0,0,0,.7)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <X size={10} color="#fff"/>
              </button>
            </div>
          ))}
        </div>
      )}
      {type!=="logo"&&(
        <div style={{marginTop:8}}>
          <DropZone onFiles={f=>uploadMany(f,type)} accept={accept} multiple={multi}>
            <div style={{padding:"9px",textAlign:"center"}}><span style={{fontSize:11,color:C.textMuted}}>+ Add more</span></div>
          </DropZone>
        </div>
      )}
    </CP>
  );

  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:880,margin:"0 auto"}}>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:isMobile?18:20,fontWeight:700,color:C.text,margin:0}}>Asset Library</h2>
        <p style={{fontSize:12,color:C.textSec,marginTop:4}}>Brand: <span style={{color:C.red}}>{activeBrand.companyName}</span></p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:C.greenD,border:`1px solid ${C.greenB}`,borderRadius:8,marginBottom:16,fontSize:12,color:C.green}}>
        <Info size={13}/>
        <span>Files are stored &amp; cached on the server as base64. Reference posters are automatically sent to AI on every generation — matching your design style.</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
        <Box title="Company Logo" type="logo" Icon={ImageIcon} color={C.red} hint="Brand logo — stored on server" accept="image/*"/>
        <Box title="Project Images" type="images" Icon={FolderOpen} color={C.blue} hint="Property photos, renders — AI uses for style context" accept="image/*" multi/>
        <Box title="Reference Posters" type="posters" Icon={Star} color="#ab47bc" hint="Sample designs — AI learns typography & layout from these" accept="image/*" multi/>
        <Box title="Documents" type="docs" Icon={FileText} color={C.green} hint="Brochures, pricing sheets" accept=".pdf,.docx,.txt" multi/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROMPT STUDIO
// ─────────────────────────────────────────────────────────────

function PromptStudio({ activeBrand, assets, apiKeySet, imageModel, enhanceModel, history, setHistory, setPreview, setTab, showToast }) {
  const [prompt,setPrompt]=useState("");
  const [campaign,setCampaign]=useState("auto");
  const [ratio,setRatio]=useState("1:1");
  const [enhanced,setEnhanced]=useState("");
  const [showEnh,setShowEnh]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [logs,setLogs]=useState([]);
  const isMobile=useIsMobile();

  if (!activeBrand) return (
    <div style={{padding:28,textAlign:"center",paddingTop:80}}>
      <Sparkles size={36} color={C.textMuted} style={{marginBottom:12}}/>
      <p style={{color:C.textSec}}>Select a brand first</p>
    </div>
  );

  const addLog=(msg,type="info")=>setLogs(l=>[...l,{msg,type,time:new Date().toLocaleTimeString()}]);

  const generate = async () => {
    if (!prompt.trim()){showToast("Enter a prompt","error");return;}
    if (!apiKeySet){showToast("Add your OpenAI API key in Settings first","error");return;}
    setGenerating(true);setLogs([]);setShowEnh(false);
    try {
      addLog("Sending to server — AI generating complete poster with brand details...");
      const res = await api("/api/generate",{
        method:"POST",
        body:JSON.stringify({ brandId:activeBrand.id, prompt, campaignType:campaign, aspectRatio:ratio, imageModel, enhanceModel }),
      });
      if (!res.success) throw new Error(res.error||"Generation failed");

      addLog(`✓ Campaign: ${res.campaignType}  |  Ratio: ${res.aspectRatio}  |  Model: ${res.imageModel}`,"success");
      if (res.headline) addLog(`✓ Headline: "${res.headline}"`,"success");
      if (res.refImagesUsed>0) addLog(`✓ ${res.refImagesUsed} reference poster(s) used for style matching`,"success");
      addLog("✓ Image generated — loading preview...","success");

      setEnhanced(res.enhancedPrompt||"");
      setShowEnh(true);

      // Fetch image as dataUrl for local preview
      let imageDataUrl = res.imageUrl;
      try {
        const imgRes = await fetch(res.imageUrl);
        const blob   = await imgRes.blob();
        imageDataUrl = await new Promise(r=>{const fr=new FileReader();fr.onload=e=>r(e.target.result);fr.readAsDataURL(blob);});
      } catch {}

      const gen = {
        id:res.id, brandId:activeBrand.id, prompt,
        enhancedPrompt:res.enhancedPrompt||"",
        campaignType:res.campaignType, headline:res.headline||"",
        aspectRatio:res.aspectRatio, imageModel:res.imageModel,
        imageDataUrl, imageUrl:res.imageUrl,
        createdAt:res.createdAt, reasoning:res.reasoning||"",
      };
      setHistory(h=>[gen,...h]);
      setPreview(gen);
      addLog("Done!","success");
      setTimeout(()=>setTab("preview"),400);
    } catch(e){
      addLog(`Error: ${e.message}`,"error");
      showToast(e.message,"error");
    }
    setGenerating(false);
  };

  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:940,margin:"0 auto"}}>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:isMobile?18:20,fontWeight:700,color:C.text,margin:0}}>Prompt Studio</h2>
        <p style={{fontSize:12,color:C.textSec,marginTop:4}}>
          Brand: <span style={{color:C.red}}>{activeBrand.companyName}</span>
          <span style={{color:C.textMuted}}> · AI renders complete poster — headline, company name, phone &amp; website in the image</span>
        </p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 260px",gap:14}}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <CP>
            <Lbl>Your Prompt</Lbl>
            <Txta value={prompt} onChange={setPrompt} rows={4}
              placeholder={`Simple is best:\n"Create a New Year post"\n"Property launch for Skyline Tower"\n"Diwali festival offer 20% off"`}/>
            <p style={{fontSize:11,color:C.textMuted,marginTop:8}}>AI builds a detailed generation prompt using your brand's name, phone, website, colors and reference posters</p>
          </CP>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            <CP>
              <Lbl>Campaign Type</Lbl>
              <Sel value={campaign} onChange={setCampaign} options={CAMPAIGN_TYPES}/>
              {campaign==="auto"&&<p style={{fontSize:11,color:C.textMuted,marginTop:6}}>AI detects from your prompt</p>}
            </CP>
            <CP>
              <Lbl>Aspect Ratio</Lbl>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {ASPECT_RATIOS.map(r=>(
                  <button key={r.value} onClick={()=>setRatio(r.value)}
                    style={{padding:"7px",background:ratio===r.value?C.redD:C.input,border:`1px solid ${ratio===r.value?C.red:C.border}`,borderRadius:7,cursor:"pointer",transition:"all .12s",textAlign:"center"}}>
                    <div style={{fontSize:12,fontWeight:700,color:ratio===r.value?C.red:C.text}}>{r.value}</div>
                    <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{r.desc}</div>
                    <div style={{fontSize:9,color:ratio===r.value?C.red:C.textMuted,marginTop:1,fontFamily:"monospace"}}>{getImageSize(r.value,imageModel)}</div>
                  </button>
                ))}
              </div>
            </CP>
          </div>
          {showEnh&&enhanced&&(
            <CP style={{border:`1px solid ${C.redB}`,background:C.redD}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Sparkles size={13} color={C.red}/>
                  <span style={{fontSize:12,fontWeight:600,color:C.red}}>AI Generation Prompt Used</span>
                </div>
                <button onClick={()=>setShowEnh(false)} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted}}><X size={13}/></button>
              </div>
              <p style={{fontSize:11,color:C.textSec,lineHeight:1.7,maxHeight:120,overflow:"auto"}}>{enhanced}</p>
            </CP>
          )}
          <Btn onClick={generate} loading={generating} disabled={!prompt.trim()||!apiKeySet} full style={{padding:"12px"}}>
            {generating?"Generating…":<><Play size={15}/>Generate Poster</>}
          </Btn>
          {!apiKeySet&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:C.redD,border:`1px solid ${C.redB}`,borderRadius:8,fontSize:12,color:C.red}}>
              <AlertCircle size={13}/>Add your OpenAI API key in Settings — stored securely on server
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <CP>
            <Lbl>Quick Templates</Lbl>
            {["Create a New Year 2025 post","Property launch announcement","Diwali festival special offer","Site visit this Sunday — free shuttle","Possession ceremony celebration","5-year anniversary milestone","Luxury 3BHK showcase"].map(t=>(
              <button key={t} onClick={()=>setPrompt(t)}
                style={{width:"100%",textAlign:"left",padding:"7px 8px",background:"transparent",border:"none",cursor:"pointer",fontSize:12,color:C.textSec,borderRadius:6,display:"block"}}
                onMouseEnter={e=>{e.target.style.background=C.input;e.target.style.color=C.text;}}
                onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.color=C.textSec;}}>
                <span style={{color:C.red,marginRight:5}}>›</span>{t}
              </button>
            ))}
          </CP>
          {logs.length>0&&(
            <CP>
              <Lbl>Generation Log</Lbl>
              <div style={{maxHeight:190,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                {logs.map((l,i)=>(
                  <div key={i} style={{display:"flex",gap:7,fontSize:11,color:l.type==="success"?C.green:l.type==="error"?C.red:C.textMuted}}>
                    <span style={{color:C.textMuted,flexShrink:0}}>{l.time}</span>
                    <span style={{lineHeight:1.5}}>{l.msg}</span>
                  </div>
                ))}
                {generating&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.red}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:C.red,animation:"spin 1s linear infinite",display:"inline-block"}}/>Processing…
                </div>}
              </div>
            </CP>
          )}
          <CP>
            <Lbl>Server Assets</Lbl>
            {[
              {label:"Logo",      ok:!!assets.logo,               val:assets.logo?"✓ On server":"-"},
              {label:"Ref images",ok:(assets.images||[]).length>0, val:`${(assets.images||[]).length} on server`},
              {label:"Ref posters",ok:(assets.posters||[]).length>0,val:`${(assets.posters||[]).length} on server`},
            ].map(({label,ok,val})=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
                <span style={{color:C.textMuted}}>{label}</span>
                <span style={{color:ok?C.green:C.textMuted}}>{val}</span>
              </div>
            ))}
          </CP>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────────────────────

function PreviewSection({ item, history, setHistory, showToast }) {
  const [copied,setCopied]=useState(false);
  const isMobile=useIsMobile();

  if (!item) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:28,height:"80vh"}}>
      <div style={{textAlign:"center"}}>
        <ImageIcon size={44} color={C.textMuted} style={{marginBottom:12}}/>
        <p style={{fontSize:14,color:C.textSec}}>No preview yet — generate a poster first</p>
      </div>
    </div>
  );

  const download=()=>{
    const a=document.createElement("a");a.href=item.imageDataUrl;a.download=`sparkos-${item.campaignType}-${item.id}.png`;a.click();
    showToast("Downloaded!","success");
  };

  const arStyle=item.aspectRatio==="16:9"?"16/9":item.aspectRatio==="9:16"?"9/16":item.aspectRatio==="4:5"?"4/5":"1/1";

  return (
    <div style={{padding:isMobile?"12px":"28px",maxWidth:980,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <h2 style={{fontSize:isMobile?17:20,fontWeight:700,color:C.text,margin:0}}>Preview</h2>
          <p style={{fontSize:12,color:C.textSec,marginTop:4}}>{fmtDate(item.createdAt)}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="secondary" size="sm" onClick={()=>{navigator.clipboard.writeText(item.imageUrl||"");setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
            {copied?<CheckCircle2 size={13}/>:<Copy size={13}/>}{copied?"Copied!":"Copy URL"}
          </Btn>
          <Btn size="sm" onClick={download}><Download size={13}/>Download</Btn>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 290px",gap:14}}>
        <Card style={{padding:8,background:"#060606"}}>
          <div style={{position:"relative",background:"#111",borderRadius:8,overflow:"hidden",aspectRatio:arStyle,maxHeight:"75vh"}}>
            <img src={item.imageDataUrl} alt="Generated poster" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
          </div>
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <CP>
            <span style={{fontSize:11,fontWeight:600,color:C.textMuted,display:"block",marginBottom:12,textTransform:"uppercase",letterSpacing:".07em"}}>Details</span>
            {[
              {label:"Campaign", val:<Badge>{(item.campaignType||"").replace(/_/g," ")}</Badge>},
              {label:"Headline", val:item.headline||"—"},
              {label:"Ratio",    val:item.aspectRatio},
              {label:"Model",    val:item.imageModel||"gpt-image-1"},
            ].map(({label,val})=>(
              <div key={label} style={{marginBottom:10}}>
                <span style={{fontSize:11,color:C.textMuted}}>{label}</span>
                <div style={{fontSize:12,color:C.text,marginTop:3}}>{val}</div>
              </div>
            ))}
            <div>
              <span style={{fontSize:11,color:C.textMuted}}>Your Prompt</span>
              <p style={{fontSize:12,color:C.textSec,marginTop:3,lineHeight:1.6}}>{item.prompt}</p>
            </div>
          </CP>
          <Btn onClick={download} full style={{padding:"11px"}}><Download size={14}/>Download Full Resolution</Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────

function HistorySection({ history, activeBrand, setPreview, setTab, setHistory, showToast }) {
  const [filter,setFilter]=useState("all");
  const isMobile=useIsMobile();
  const filtered=history.filter(h=>(!activeBrand||h.brandId===activeBrand?.id)&&(filter==="all"||h.campaignType===filter));
  const types=[...new Set(history.filter(h=>!activeBrand||h.brandId===activeBrand?.id).map(h=>h.campaignType))];

  const dl=item=>{
    const a=document.createElement("a");a.href=item.imageDataUrl;a.download=`sparkos-${item.campaignType}-${item.id}.png`;a.click();
    showToast("Downloaded!","success");
  };

  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:980,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:isMobile?18:20,fontWeight:700,color:C.text,margin:0}}>History</h2>
          <p style={{fontSize:12,color:C.textSec,marginTop:4}}>{filtered.length} posters{activeBrand?` · ${activeBrand.companyName}`:""}</p>
        </div>
        {filtered.length>0&&<Btn variant="danger" size="sm" onClick={()=>{if(confirm("Clear history?"))setHistory([]);}}><Trash2 size={13}/>Clear</Btn>}
      </div>
      {filtered.length===0?(
        <div style={{textAlign:"center",paddingTop:60}}>
          <Clock size={40} color={C.textMuted} style={{marginBottom:12}}/>
          <p style={{color:C.textSec}}>No generations yet</p>
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
            {["all",...types].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filter===f?C.red:C.border}`,background:filter===f?C.redD:"transparent",color:filter===f?C.red:C.textSec,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                {f==="all"?"All":(f||"").replace(/_/g," ")} ({f==="all"?filtered.length:history.filter(h=>h.campaignType===f&&(!activeBrand||h.brandId===activeBrand?.id)).length})
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10}}>
            {filtered.map(item=>(
              <Card key={item.id} style={{overflow:"hidden"}}>
                <div style={{position:"relative",aspectRatio:"1",background:"#111",cursor:"pointer"}} onClick={()=>{setPreview(item);setTab("preview");}}>
                  <img src={item.imageDataUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                </div>
                <div style={{padding:"10px 12px"}}>
                  <div style={{display:"flex",gap:5,marginBottom:4,flexWrap:"wrap"}}>
                    <Badge>{(item.campaignType||"").replace(/_/g," ")}</Badge>
                    <Badge color="gray">{item.aspectRatio}</Badge>
                  </div>
                  {item.headline&&<p style={{fontSize:10,color:C.red,marginBottom:4,fontWeight:600}}>{item.headline}</p>}
                  <p style={{fontSize:11,color:C.textSec,marginBottom:6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{item.prompt}</p>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:10,color:C.textMuted}}>{fmtDate(item.createdAt)}</span>
                    <button onClick={()=>dl(item)} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4}}
                      onMouseEnter={e=>e.target.style.color=C.red} onMouseLeave={e=>e.target.style.color=C.textMuted}>
                      <Download size={13}/>
                    </button>
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

// ─────────────────────────────────────────────────────────────
// WEBHOOK
// ─────────────────────────────────────────────────────────────

function WebhookPage({ apiKeySet, showToast }) {
  const async_=`${BACKEND}/webhook/generate`;
  const sync_= `${BACKEND}/webhook/generate/sync`;
  const [payload,setPayload]=useState(JSON.stringify({requestId:"req_001",brandId:"brand_001",campaignType:"new_year",prompt:"Create a premium New Year post",aspectRatio:"1:1",callbackUrl:"https://n8n.yoursite.com/cb"},null,2));
  const [logs,setLogs]=useState([]);
  const [simming,setSimming]=useState(false);
  const [cp,setCp]=useState({});
  const isMobile=useIsMobile();

  const copy=(txt,k)=>{navigator.clipboard.writeText(txt);setCp(p=>({...p,[k]:true}));setTimeout(()=>setCp(p=>({...p,[k]:false})),2000);};

  const simulate=async()=>{
    if(!apiKeySet){showToast("Add OpenAI key in Settings first","error");return;}
    setSimming(true);
    const entry={id:uid(),ts:new Date().toISOString(),status:"processing"};
    setLogs(l=>[entry,...l]);
    try {
      const p=JSON.parse(payload);
      const res=await api("/api/generate",{method:"POST",body:JSON.stringify({brandId:p.brandId,prompt:p.prompt,campaignType:p.campaignType||"auto",aspectRatio:p.aspectRatio||"1:1"})});
      const result={success:true,generationId:res.id,imageUrl:res.imageUrl,headline:res.headline,createdAt:res.createdAt};
      setLogs(l=>l.map(lg=>lg.id===entry.id?{...lg,status:"success",result}:lg));
      showToast("Simulation successful!","success");
    } catch(e){
      setLogs(l=>l.map(lg=>lg.id===entry.id?{...lg,status:"error",error:e.message}:lg));
      showToast("Failed: "+e.message,"error");
    }
    setSimming(false);
  };

  const ERow=({label,url,k,color})=>(
    <div style={{marginBottom:12}}>
      <Lbl>{label}</Lbl>
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1,background:"#080808",border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",fontFamily:"monospace",fontSize:12,color,overflowX:"auto",whiteSpace:"nowrap"}}>{url}</div>
        <button onClick={()=>copy(url,k)} style={{padding:"0 12px",background:C.input,border:`1px solid ${C.border}`,borderRadius:7,cursor:"pointer",color:C.textSec,flexShrink:0}}>
          {cp[k]?<CheckCircle2 size={13} color={C.green}/>:<Copy size={13}/>}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:820,margin:"0 auto"}}>
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:isMobile?18:20,fontWeight:700,color:C.text,margin:0}}>Webhook Integration</h2>
        <p style={{fontSize:12,color:C.textSec,marginTop:4}}>n8n · Zapier · Make · Any automation tool</p>
      </div>
      <CP style={{border:`1px solid ${C.greenB}`,background:C.greenD,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.green}}/>
          <span style={{fontSize:13,fontWeight:600,color:C.green}}>Endpoints — Auto Configured</span>
        </div>
        <ERow label="Async (recommended — returns immediately, POSTs to callbackUrl when done)" url={async_} k="async" color={C.green}/>
        <ERow label="Sync (waits ~25s — returns full result directly)" url={sync_} k="sync" color="#42a5f5"/>
      </CP>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
        <CP>
          <Lbl>Input</Lbl>
          <div style={{background:"#060606",border:`1px solid ${C.border}`,borderRadius:7,padding:12,fontFamily:"monospace",fontSize:11,color:C.green,maxHeight:180,overflow:"auto"}}>
            <pre>{JSON.stringify({requestId:"req_001",brandId:"brand_001",campaignType:"new_year|festival|...",prompt:"Create a New Year post",aspectRatio:"1:1|4:5|9:16|16:9",callbackUrl:"https://n8n.yoursite.com/cb"},null,2)}</pre>
          </div>
        </CP>
        <CP>
          <Lbl>Success Response</Lbl>
          <div style={{background:"#060606",border:`1px solid ${C.border}`,borderRadius:7,padding:12,fontFamily:"monospace",fontSize:11,color:"#42a5f5",maxHeight:180,overflow:"auto"}}>
            <pre>{JSON.stringify({success:true,generationId:"gen_abc",imageUrl:`${BACKEND}/public/generated/gen_abc.png`,headline:"Happy New Year 2025",campaignType:"new_year",createdAt:"2025-01-01T10:00:00Z"},null,2)}</pre>
          </div>
        </CP>
      </div>
      <CP style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Live Tester</span>
          <Badge>Simulation</Badge>
        </div>
        <div style={{marginBottom:12}}><Lbl>Test Payload</Lbl><Txta value={payload} onChange={setPayload} rows={7} mono/></div>
        <Btn onClick={simulate} loading={simming}><Play size={13}/>Run Simulation</Btn>
        {!apiKeySet&&<p style={{fontSize:11,color:C.red,marginTop:8}}>⚠ Add OpenAI key in Settings first</p>}
      </CP>
      {logs.length>0&&(
        <CP>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>Logs</span>
            <button onClick={()=>setLogs([])} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.textMuted}}>Clear</button>
          </div>
          {logs.map(l=>(
            <div key={l.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 12px",background:"#080808",border:`1px solid ${C.border}`,borderRadius:7,marginBottom:6}}>
              <Badge color={l.status==="success"?"green":l.status==="error"?"red":"gray"}>{l.status}</Badge>
              <div>
                <span style={{fontSize:11,color:C.textMuted}}>{fmtDate(l.ts)}</span>
                {l.result&&<p style={{fontSize:11,color:C.green,marginTop:2}}>✓ {l.result.generationId} · {l.result.headline}</p>}
                {l.error&&<p style={{fontSize:11,color:C.red,marginTop:2}}>{l.error}</p>}
              </div>
            </div>
          ))}
        </CP>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────

function SettingsPage({ apiKeySet, setApiKeySet, apiKeyMasked, setApiKeyMasked, imageModel, setImageModel, enhanceModel, setEnhanceModel, showToast }) {
  const [keyLocal,setKeyLocal]=useState("");
  const [showKey,setShowKey]=useState(false);
  const [saving,setSaving]=useState(false);
  const [testing,setTesting]=useState(false);
  const [customModel,setCustomModel]=useState("");
  const [curPwd,setCurPwd]=useState("");
  const [newPwd,setNewPwd]=useState("");
  const [confPwd,setConfPwd]=useState("");
  const [changingPwd,setChangingPwd]=useState(false);
  const isMobile=useIsMobile();

  const saveKey=async()=>{
    if(!keyLocal.trim()){showToast("Enter your API key","error");return;}
    setSaving(true);
    try {
      await api("/api/settings",{method:"POST",body:JSON.stringify({openaiKey:keyLocal})});
      setApiKeySet(true);
      setApiKeyMasked(keyLocal.slice(0,7)+"••••••••••••••••"+keyLocal.slice(-4));
      setKeyLocal("");
      showToast("API key saved to server — available on all devices!","success");
    } catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const testKey=async()=>{
    if(!keyLocal.trim()){showToast("Enter a key to test","error");return;}
    setTesting(true);
    try {
      const res=await api("/api/settings/test-key",{method:"POST",body:JSON.stringify({openaiKey:keyLocal})});
      if(res.success)showToast("✓ API key is valid!","success");
      else showToast("Invalid key: "+res.error,"error");
    } catch(e){showToast(e.message,"error");}
    setTesting(false);
  };

  const saveModel=async(field,val,setter)=>{
    setter(val);
    try{await api("/api/settings",{method:"POST",body:JSON.stringify({[field]:val})});}
    catch(e){console.warn("Model save:",e.message);}
  };

  const changePwd=async()=>{
    if(!newPwd){showToast("Enter new password","error");return;}
    if(newPwd!==confPwd){showToast("Passwords do not match","error");return;}
    if(newPwd.length<6){showToast("Min 6 characters","error");return;}
    setChangingPwd(true);
    try {
      await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({currentHash:await sha256(curPwd),newHash:await sha256(newPwd)})});
      showToast("Password changed!","success");
      setCurPwd("");setNewPwd("");setConfPwd("");
    } catch(e){showToast(e.message,"error");}
    setChangingPwd(false);
  };

  const Sec=({title,children})=>(
    <div style={{marginBottom:24}}>
      <p style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>{title}</p>
      {children}
    </div>
  );

  return (
    <div style={{padding:isMobile?"16px":"28px",maxWidth:660,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:isMobile?18:20,fontWeight:700,color:C.text,margin:0}}>Settings</h2>
        <p style={{fontSize:12,color:C.textSec,marginTop:4}}>API key · Models · Security — all stored on server</p>
      </div>

      <Sec title="OpenAI API Key">
        <CP>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <Key size={15} color={C.red}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>OpenAI API Key</span>
            {apiKeySet&&<Badge color="green">Active</Badge>}
          </div>
          {apiKeySet&&apiKeyMasked&&(
            <div style={{padding:"10px 14px",background:C.greenD,border:`1px solid ${C.greenB}`,borderRadius:8,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
              <CheckCircle2 size={14} color={C.green}/>
              <div>
                <p style={{fontSize:12,color:C.green,fontWeight:600}}>API Key Active — Stored on Server</p>
                <p style={{fontSize:11,color:C.textMuted,marginTop:2,fontFamily:"monospace"}}>{apiKeyMasked}</p>
              </div>
            </div>
          )}
          <p style={{fontSize:11,color:C.textMuted,marginBottom:8}}>{apiKeySet?"Update key:":"Enter your OpenAI API key:"}</p>
          <div style={{position:"relative",marginBottom:10}}>
            <input type={showKey?"text":"password"} value={keyLocal} onChange={e=>setKeyLocal(e.target.value)}
              placeholder="sk-proj-..." style={{...SI.input,paddingRight:42}}
              onFocus={e=>fcs(e,true)} onBlur={e=>fcs(e,false)}/>
            <button onClick={()=>setShowKey(!showKey)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.textMuted,cursor:"pointer"}}>
              {showKey?<EyeOff size={14}/>:<Eye size={14}/>}
            </button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <Btn onClick={saveKey} loading={saving} size="sm">Save to Server</Btn>
            <Btn variant="secondary" size="sm" onClick={testKey} loading={testing}>Test Key</Btn>
          </div>
          <div style={{padding:"10px 14px",background:C.greenD,border:`1px solid ${C.greenB}`,borderRadius:8}}>
            <p style={{fontSize:11,color:C.textSec,lineHeight:1.6}}>
              <span style={{color:C.green,fontWeight:600}}>Server-stored:</span> Saved in backend DB — available on every device, every session. Never stored in browser.
            </p>
          </div>
        </CP>
      </Sec>

      <Sec title="Image Generation Model">
        <CP style={{display:"flex",flexDirection:"column",gap:8}}>
          {IMAGE_MODELS.map(m=>(
            <RCard key={m.value} selected={imageModel===m.value} onClick={()=>saveModel("imageModel",m.value,setImageModel)}
              label={m.label} desc={m.desc} badge={m.value==="gpt-image-1"?"Default":""}/>
          ))}
        </CP>
      </Sec>

      <Sec title="Custom Model Name">
        <CP>
          <p style={{fontSize:12,color:C.textSec,marginBottom:12,lineHeight:1.6}}>If you selected "Custom Model…" above, type the exact model name here.</p>
          <Lbl>Custom Model Name</Lbl>
          <div style={{display:"flex",gap:8}}>
            <Inp value={customModel} onChange={setCustomModel} placeholder="e.g. gpt-image-1.5"/>
            <Btn size="sm" onClick={async()=>{await api("/api/settings",{method:"POST",body:JSON.stringify({imageModel:customModel})});setImageModel(customModel);showToast("Custom model saved!","success");}}>Save</Btn>
          </div>
          {customModel&&<p style={{fontSize:11,color:C.green,marginTop:8}}>✓ Will use: {customModel}</p>}
        </CP>
      </Sec>

      <Sec title="Prompt Enhancement Model">
        <CP style={{display:"flex",flexDirection:"column",gap:8}}>
          {ENHANCE_MODELS.map(m=>(
            <RCard key={m.value} selected={enhanceModel===m.value} onClick={()=>saveModel("enhanceModel",m.value,setEnhanceModel)}
              label={m.label} desc={m.desc} badge={m.value==="gpt-4o"?"Default":""}/>
          ))}
          <div style={{padding:"10px 14px",background:"rgba(30,136,229,.08)",border:"1px solid rgba(30,136,229,.18)",borderRadius:8}}>
            <p style={{fontSize:11,color:"#5bc0de"}}>gpt-4o reads your reference poster images to match design style — recommended.</p>
          </div>
        </CP>
      </Sec>

      <Sec title="Security">
        <CP>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <Shield size={15} color={C.red}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>Change Password</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            <div><Lbl>Current Password</Lbl><Inp type="password" value={curPwd} onChange={setCurPwd} placeholder="Current password"/></div>
            <div><Lbl>New Password</Lbl><Inp type="password" value={newPwd} onChange={setNewPwd} placeholder="Min 6 characters"/></div>
            <div><Lbl>Confirm New</Lbl><Inp type="password" value={confPwd} onChange={setConfPwd} placeholder="Repeat new password"/></div>
          </div>
          <Btn onClick={changePwd} loading={changingPwd} size="sm"><Shield size={13}/>Change Password</Btn>
        </CP>
      </Sec>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────

export default function SparkOs() {
  const [loggedIn,setLoggedIn]=useState(!!sessionStorage.getItem("ss"));
  const [activeTab,setActiveTab]=useState("dashboard");
  const [brands,setBrands]=useState([]);
  const [activeBrand,setActiveBrand]=useState(null);
  const [assets,setAssets]=useState({logo:null,images:[],posters:[],docs:[]});
  const [history,setHistory]=useState([]);
  const [preview,setPreview]=useState(null);
  const [toast,setToast]=useState(null);
  const [apiKeySet,setApiKeySet]=useState(false);
  const [apiKeyMasked,setApiKeyMasked]=useState("");
  const [imageModel,setImageModel]=useState("gpt-image-1");
  const [enhanceModel,setEnhanceModel]=useState("gpt-4o");
  const isMobile=useIsMobile();

  const showToast=useCallback((msg,type="success")=>setToast({msg,type,id:uid()}),[]);

  // Load brands + settings from server
  useEffect(()=>{
    if(!loggedIn)return;
    api("/api/brands").then(res=>{
      const list=res.brands||[];
      setBrands(list);
      const savedId=localStorage.getItem("ab");
      const found=list.find(b=>b.id===savedId)||list[0]||null;
      if(found)setActiveBrand(found);
    }).catch(()=>{});
    api("/api/settings").then(res=>{
      setApiKeySet(res.apiKeySet||false);
      setApiKeyMasked(res.apiKeyMasked||"");
      if(res.imageModel)setImageModel(res.imageModel);
      if(res.enhanceModel)setEnhanceModel(res.enhanceModel);
    }).catch(()=>{});
  },[loggedIn]);

  // Load assets from server when brand changes
  useEffect(()=>{
    if(!activeBrand)return;
    api(`/api/assets/${activeBrand.id}`).then(res=>{
      const a=res.assets||{};
      setAssets({
        logo:a.logo?{url:a.logoUrl||a.logo?.url,name:"logo",dataUrl:null}:null,
        images:(a.images||[]).map(i=>({...i,dataUrl:null})),
        posters:(a.posters||[]).map(i=>({...i,dataUrl:null})),
        docs:a.docs||[],
      });
    }).catch(()=>{});
  },[activeBrand?.id]);

  const logout=()=>{sessionStorage.removeItem("ss");setLoggedIn(false);};

  if(!loggedIn) return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;margin:0;padding:0} body{background:#080808} input::placeholder,textarea::placeholder{color:#404040;font-family:inherit} button{font-family:inherit}`}</style>
      <Login onLogin={()=>setLoggedIn(true)}/>
    </>
  );

  const tabs={
    dashboard:<Dashboard history={history} brands={brands} activeBrand={activeBrand} assets={assets} setTab={setActiveTab}/>,
    brands:   <BrandsManager brands={brands} activeBrand={activeBrand} setActiveBrand={setActiveBrand} setBrands={setBrands} setTab={setActiveTab} showToast={showToast}/>,
    brandedit:activeBrand?<BrandEdit brand={activeBrand} brands={brands} setBrands={setBrands} setActiveBrand={setActiveBrand} showToast={showToast}/>:null,
    assets:   <AssetUpload activeBrand={activeBrand} assets={assets} setAssets={setAssets} showToast={showToast}/>,
    studio:   <PromptStudio activeBrand={activeBrand} assets={assets} apiKeySet={apiKeySet} imageModel={imageModel} enhanceModel={enhanceModel} history={history} setHistory={setHistory} setPreview={setPreview} setTab={setActiveTab} showToast={showToast}/>,
    preview:  <PreviewSection item={preview||history[0]||null} history={history} setHistory={setHistory} showToast={showToast}/>,
    history:  <HistorySection history={history} activeBrand={activeBrand} setPreview={setPreview} setTab={setActiveTab} setHistory={setHistory} showToast={showToast}/>,
    webhook:  <WebhookPage apiKeySet={apiKeySet} showToast={showToast}/>,
    settings: <SettingsPage apiKeySet={apiKeySet} setApiKeySet={setApiKeySet} apiKeyMasked={apiKeyMasked} setApiKeyMasked={setApiKeyMasked} imageModel={imageModel} setImageModel={setImageModel} enhanceModel={enhanceModel} setEnhanceModel={setEnhanceModel} showToast={showToast}/>,
  };

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px}
        select option{background:#0e0e0e;color:#eee}
        @keyframes spin{to{transform:rotate(360deg)}}
        input::placeholder,textarea::placeholder{color:#383838;font-family:inherit}
        button{font-family:inherit}
        button:hover{opacity:.92}
        -webkit-tap-highlight-color:transparent
      `}</style>
      <Sidebar active={activeTab==="brandedit"?"brands":activeTab} setActive={setActiveTab}
        brands={brands} activeBrand={activeBrand}
        setActiveBrand={b=>{setActiveBrand(b);if(b)localStorage.setItem("ab",b.id);}}
        histLen={history.length} hasKey={apiKeySet} onLogout={logout}/>
      <main style={{flex:1,overflowY:"auto",background:C.bg,paddingBottom:isMobile?"70px":"0"}}>
        {tabs[activeTab]||tabs.dashboard}
      </main>
      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
