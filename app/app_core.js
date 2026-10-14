"use strict";
/* ============ boot ============ */
const B = JSON.parse(document.getElementById("bundle").textContent);
const W = B.world;
const M = SFA.createModel(W, { readings: B.readings, drafts: B.drafts });
const { fd, inr, lakh, days, addDays, wday, plural, listAnd, ST, GROUPS, T_DATES, T_LABEL, INTENT_TEXT, INTENTS, HUMAN_INTENTS, STEP_TEXT, RULES_META, RULE_TEMPLATES, DEFAULT_RULES, DEFAULT_SETTINGS, PROMPT_VERSIONS } = SFA;
const SUP = M.SUP, INV = M.INV, REPLY = M.REPLY;
const USER = W.user;
const LINKS = { submission: "", deck: "", doc: "", repo: "" }; // filled in at publish time
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const words = s => String(s || "").split(/\s+/).filter(Boolean).length;

/* ============ icons (inline SVG, no emoji) ============ */
const IC = {
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
  rules: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.6 1.6 1.6.6-1.6.6L19 20.4l-.6-1.6-1.6-.6 1.6-.6z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevr: '<path d="M9 6l6 6-6 6"/>',
  chevl: '<path d="M15 6l-6 6 6 6"/>',
  chevd: '<path d="M6 9l6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5M12 7.5v4.5l3 2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  wa: '<path d="M4.5 20l1.4-4a8 8 0 1 1 3 2.8z"/><path d="M9 9.5c.3 2 2.2 4 4.5 4.5l1.3-1.2 1.7.8"/>',
  alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.4v.4"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M9 4H5v16h4M15 8l4 4-4 4M19 12H9"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  agent: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M3 13v2M21 13v2"/>',
  portal: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 9h10M7 13h6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
};
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ""}</svg>`;

/* ============ state ============ */
const KEY = "sfa2-demo-v1";
function loadState() {
  try { const x = JSON.parse(localStorage.getItem(KEY) || "null"); if (x && x.v === 2) { const f = SFA.freshState(); return Object.assign(f, x, { settings: Object.assign(f.settings, x.settings), rules: Object.assign(f.rules, x.rules), ui: Object.assign({}, x.ui) }); } } catch (e) { }
  return SFA.freshState();
}
let S = loadState();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
const UI = { q: "", owner: "", channel: "", group: "", sort: "priority", selected: new Set(), menu: null, search: "", modal: null, drafts: {}, chat: {}, tryTab: {}, tryOut: {}, histFilter: {}, tour: null, sideOpen: false, readSel: {}, pendingRule: null, addRule: null, dash: { unit: "", owner: "", fy: "" }, asTable: {}, liveSum: {}, busy: {}, skipFor: null, correctFor: null };
let D = M.derive(S);
const clockNow = () => T_DATES[S.t || 0];
function stamp() { const n = new Date(); return clockNow() + "T" + String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0"); }

/* every action is stored, never deleted: undo marks it undone and keeps it in the history */
function archiveIfUndone(store, key) { const old = store[key]; if (old && old.undone) { let i = 1; while (store[key + "~" + i]) i++; store[key + "~" + i] = old; } }
function doAct(key, data, msg, undoMsg) {
  archiveIfUndone(S.acts, key);
  S.acts[key] = Object.assign({ at: stamp(), by: "user" }, data || {}); save(); render();
  toast(msg, { undo: () => { if (S.acts[key] && !S.acts[key].undone) { S.acts[key].undone = stamp(); save(); render(); toast(undoMsg || "Undone. Nothing was sent."); } } });
}
function doReview(rid, data, msg) {
  archiveIfUndone(S.reviews, rid);
  S.reviews[rid] = Object.assign({ date: clockNow(), at: stamp() }, data); save(); render();
  toast(msg, { undo: () => { if (S.reviews[rid] && !S.reviews[rid].undone) { S.reviews[rid].undone = stamp(); save(); render(); toast("Undone."); } } });
}

/* ============ live AI through Claude (viewer's own account) ============ */
let SAMPLE = null, LIVE = "checking";
async function initLive() {
  try { SAMPLE = (window.claude && typeof window.claude.use === "function") ? await window.claude.use("sample") : null; } catch (e) { SAMPLE = null; }
  LIVE = SAMPLE ? "ready" : "off"; render();
}
const canLive = () => !!SAMPLE && S.settings.ai && !["declined", "limited"].includes(LIVE);
const liveWhy = () => !S.settings.ai ? "AI is off in Company settings." : LIVE === "declined" ? "Live AI was not allowed for this page." : LIVE === "limited" ? "Your Claude usage limit was reached. Try again later." : "Live AI works when this page is opened in Claude while signed in. Recorded answers from the same prompts are shown instead.";
function parseJSON(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch (e) { }
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (e) { } }
  const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { } }
  throw { code: "invalid_json", message: "The answer was not valid JSON" };
}
async function callClaude(feature, prompt, tier = "quick", cache = true) {
  if (!canLive()) throw { code: "not_available" };
  const t0 = performance.now();
  try {
    const r = await SAMPLE(prompt, { modelTier: tier, cache: cache ? true : false });
    const ms = Math.round(performance.now() - t0); LIVE = "on";
    S.log.unshift({ at: new Date().toISOString(), feature, tier: r.modelTierApplied || tier, ms, ok: true }); S.log = S.log.slice(0, 80); save();
    return { text: r.text, ms, tier: r.modelTierApplied || tier };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    if (e && e.code === "not_granted") LIVE = "declined";
    if (e && e.code === "rate_limited") LIVE = "limited";
    S.log.unshift({ at: new Date().toISOString(), feature, tier, ms, ok: false, note: e && e.code }); save();
    throw e;
  }
}
/* ask, check with code, retry once on a larger tier, else fall back */
async function askChecked(feature, prompt, check) {
  let last = null;
  for (const tier of ["quick", "default"]) {
    try {
      const r = await callClaude(feature, prompt, tier, tier === "quick");
      const out = parseJSON(r.text); const c = check(out);
      if (c.ok) return { out, ms: r.ms, tier: r.tier, checks: c.checks, retried: tier !== "quick" };
      last = { out, checks: c.checks, ms: r.ms, tier: r.tier };
    } catch (e) { if (e && ["not_granted", "rate_limited", "not_available", "session_expired", "sampling_disabled"].includes(e.code)) throw e; last = { error: e }; }
  }
  throw { code: "checks_failed", last };
}
function errText(e) {
  const c = e && e.code;
  return ({ not_available: liveWhy(), not_granted: "Live AI was not allowed for this page, so recorded answers are shown.", rate_limited: "Your Claude usage limit was reached. Try again later.", invalid_json: "The AI's answer could not be read as structured data. Try again.", checks_failed: "The live answer failed the code checks twice, so it is not shown. The facts-only version stays on screen.", session_expired: "Please sign in to Claude again.", refused: "The AI declined this input. Try different wording." })[c] || "The live AI call failed. Try again in a moment.";
}

/* ============ small UI helpers ============ */
let toastTimer = null;
function toast(msg, opt = {}) {
  const root = $("#toastRoot"); if (!root) return;
  const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status");
  el.innerHTML = `<span class="grow">${esc(msg)}</span>${opt.undo ? `<button type="button">${ic("undo")} Undo</button>` : ""}`;
  if (opt.undo) el.querySelector("button").onclick = () => { el.remove(); opt.undo(); };
  root.replaceChildren(el);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), opt.undo ? 10000 : 3800);
}
function badgeFor(st, extra) { const m = ST[st]; return `<span class="badge ${m.tone}">${esc(m.label)}${extra ? " " + esc(extra) : ""}</span>`; }
function supBadge(v) { return v.status === "promised" && v.promised ? badgeFor("promised", fd(v.promised, false)) : badgeFor(v.status); }
const udyamTag = s => s.udyam === "Micro" || s.udyam === "Small" ? `<span class="badge outline" title="MSMED Act: pay within 45 days">${esc(s.udyam)}</span>` : "";
const chanIcon = ch => ch === "WhatsApp" ? ic("wa") : ic("mail");
/* the exact message a person approved or sent: an edit made at approval or at sending wins over the AI draft */
function approvedText(id) { for (const k of ["send:" + id, "approve:" + id]) { const a = S.acts[k]; if (a && !a.undone && a.edit) return a.edit; } return B.drafts[id]; }
const noChannel = () => S.settings && S.settings.email === false && S.settings.whatsapp === false;
const ruleChip = id => `<button type="button" class="rule-chip" data-action="goto-rule" data-rule="${id}" title="${esc((RULES_META.find(r => r.id === id) || RULE_TEMPLATES.find(r => r.id === id) || {}).name || "")}">${id}</button>`;
function ruleChips(text) { return esc(text).replace(/\b(rule )?(R(?:10|[1-9]))\b/g, (m, a, id) => (a || "") + ruleChip(id)); }
function why(title, body) { return `<div class="why"><div class="wl">${ic("bulb")} ${esc(title)}</div>${body}</div>`; }
const sw = (id, on, action, label, disabled) => `<label class="switch"><input type="checkbox" id="${id}" data-change="${action}" ${on ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="track"></span><span class="sr">${esc(label)}</span></label>`;
function route() { const h = (location.hash || "").slice(1); if (/^supplier-S\d\d$/.test(h)) return { name: "supplier", sid: h.slice(9) }; if (["inbox", "rules", "dashboard", "about"].includes(h)) return { name: h }; return { name: "inbox" }; }
function go(hash) { if (location.hash === "#" + hash) render(); else location.hash = hash; }
function aiMeta(kind, extra = "") {
  if (kind === "recorded") return `<span class="ai-pill">${ic("spark")} AI</span><span>Recorded answer · ${esc(B.meta.model)} · ${fd(B.meta.recordedOn)}${extra}</span>`;
  if (kind === "live") return `<span class="ai-pill">${ic("spark")} AI · live</span><span>${extra}</span>`;
  return `<span class="badge grey">Facts only</span><span>Written by code from the records, no AI${extra}</span>`;
}
function liveChip() {
  const st = !S.settings.ai ? ["off", "AI off"] : LIVE === "checking" ? ["wait", "Checking live AI"] : canLive() ? ["on", "Live AI ready"] : ["rec", "Recorded AI"];
  return `<button type="button" class="badge ${st[0] === "on" ? "green" : st[0] === "off" ? "red" : "grey"} hide-sm" data-action="ai-status" title="${esc(canLive() ? "Live AI uses your Claude account. Your first live call asks your permission." : liveWhy())}">${ic("spark")} ${st[1]}</button>`;
}

/* ============ frame ============ */
let rendering = false, renderAgain = false;
function render() {
  if (rendering) { renderAgain = true; return; }
  rendering = true;
  try { renderNow(); } finally { rendering = false; if (renderAgain) { renderAgain = false; setTimeout(render, 0); } }
}
function renderNow() {
  D = M.derive(S);
  document.documentElement.classList.toggle("thinking", !!S.ui.thinking);
  const app = $("#app");
  if (!S.ui.signedIn) { app.innerHTML = loginView(); return; }
  const r = route();
  const sx = window.scrollX, sy = window.scrollY;
  app.innerHTML = frame(r);
  if (UI.keepScroll) window.scrollTo(sx, sy); UI.keepScroll = false;
  afterRender(r);
}
function frame(r) {
  const nav = [["inbox", "Follow-up Inbox", "inbox"], ["rules", "Rules", "rules"], ["dashboard", "Dashboard", "chart"], ["about", "About this demo", "info"]];
  const cur = r.name === "supplier" ? "inbox" : r.name;
  const needN = D.counts.needs;
  const title = r.name === "supplier" ? `<a href="#inbox">Follow-up Inbox</a> <span class="muted">/</span> ${esc(SUP[r.sid].name)}` : esc({ inbox: "Follow-up Inbox", rules: "Rules", dashboard: "Dashboard", about: "About this demo" }[r.name]);
  const body = r.name === "inbox" ? inboxView() : r.name === "supplier" ? supplierView(r.sid) : r.name === "rules" ? rulesView() : r.name === "dashboard" ? dashboardView() : aboutView();
  return `<div class="app ${S.ui.collapsed ? "collapsed" : ""}">
    <aside class="side ${UI.sideOpen ? "open" : ""}" aria-label="Main navigation">
      <div class="brand"><span class="logo">${ic("send")}</span><span class="brandname">Supplier Follow-up</span></div>
      ${nav.map(([h, l, i]) => `<a class="nav" href="#${h}" ${cur === h ? 'aria-current="page"' : ""} data-action="nav">${ic(i)}<span class="navlabel">${l}</span>${h === "inbox" && needN ? `<span class="count" title="Suppliers that need you">${needN}</span>` : ""}</a>`).join("")}
      <button type="button" class="nav" data-action="tour-start">${ic("play")}<span class="navlabel">2-minute tour</span></button>
      <div class="foot"><b>ROHIT KUMAR</b><br>Product assignment<br>Fictional company and data</div>
      <button type="button" class="nav collapse-btn" data-action="collapse" title="${S.ui.collapsed ? "Expand" : "Collapse"} the sidebar">${ic("sidebar")}<span class="navlabel">${S.ui.collapsed ? "Expand" : "Collapse"} sidebar</span></button>
    </aside>
    <div class="main">
      <header class="top">
        <button type="button" class="btn icon ghost menu-btn" data-action="side-open" aria-label="Open the menu">${ic("menu")}</button>
        <div class="title">${title}</div>
        <div class="tools">
          <div class="searchbox rel"><label class="sr" for="gsearch">Search suppliers, invoices or GSTINs</label>${ic("search")}<input type="search" id="gsearch" placeholder="Search supplier, invoice, GSTIN" value="${esc(UI.search)}" autocomplete="off" data-input="gsearch">${UI.search ? searchResults() : ""}</div>
          ${clockHTML()}
          ${liveChip()}
          <label class="switch hide-sm" title="Show why each part is built this way, and what it measures"><input type="checkbox" id="thinkingSw" data-change="thinking" ${S.ui.thinking ? "checked" : ""}><span class="track"></span><span class="small" style="font-weight:600">Product thinking</span></label>
          <div class="rel"><button type="button" class="btn ghost icon" data-action="menu" data-menu="updates" aria-label="Updates" title="Updates">${ic("bell")}${updates().length ? `<span class="badge amber" style="padding:0 5px;margin-left:-4px">${updates().length}</span>` : ""}</button>${UI.menu === "updates" ? updatesMenu() : ""}</div>
          <div class="rel"><button type="button" class="btn ghost" data-action="menu" data-menu="user" aria-label="Account menu" style="padding:4px 6px"><span class="avatar">AA</span><span class="hide-sm small" style="font-weight:600">${esc(USER.name)}</span>${ic("chevd")}</button>${UI.menu === "user" ? userMenu() : ""}</div>
        </div>
      </header>
      <main class="content" id="main">${body}</main>
      <div class="foot-note">Fictional company, suppliers and amounts. Recorded AI answers are labelled; live AI runs only when this page is opened in Claude while signed in. No messages are sent and nothing is filed. Made by Rohit Kumar for a product assignment.</div>
    </div>
  </div>`;
}
function clockHTML() {
  const t = S.t || 0;
  const nextLbl = t === 0 ? "Move to 12 Nov" : t === 1 ? "Move to 14 Nov" : null;
  const shortD = ["15 Oct", "12 Nov", "14 Nov"][t];
  return `<div class="clock" title="Simulated date. Moving forward replays what suppliers do after your decisions."><span class="today">${ic("calendar")} <span class="hide-sm">${T_LABEL[t]}</span><span class="show-sm">${shortD}</span></span>${nextLbl ? `<button type="button" data-action="time-next"><span class="hide-sm">${nextLbl}</span><span class="show-sm">${nextLbl.replace("Move to ", "")}</span> ${ic("chevr")}</button>` : ""}${t > 0 ? `<button type="button" data-action="time-reset" title="Back to 15 Oct. Your decisions stay; the simulation replays." aria-label="Back to 15 Oct">${ic("reset")}</button>` : ""}</div>`;
}
function userMenu() {
  return `<div class="dropdown" role="menu">
    <div style="padding:8px 10px"><b>${esc(USER.name)}</b><div class="xs muted">${esc(USER.role)} · Kestrel Auto Components (fictional)</div></div><div class="sep"></div>
    <button type="button" data-action="tour-start">${ic("play")} Start the 2-minute tour</button>
    <button type="button" data-action="toggle-thinking">${ic("bulb")} ${S.ui.thinking ? "Hide" : "Show"} product thinking notes</button>
    <a href="#about" data-action="nav">${ic("info")} About this demo</a>
    <button type="button" data-action="ask-reset">${ic("reset")} Reset the demo</button>
    <div class="sep"></div><button type="button" data-action="logout">${ic("logout")} Sign out</button></div>`;
}
/* what changed recently, for the bell */
function updates() {
  const t = S.t || 0; const today = clockNow();
  const from = t === 0 ? "2026-10-11" : t === 1 ? "2026-10-16" : "2026-11-13";
  const list = [];
  const keep = h => ["message_in", "ims", "gstr2b", "owner_alert", "reco", "payment"].includes(h.kind) || (h.kind === "reading" && /Sent to you/.test(h.text)) || (h.kind === "check" && /broken|can no longer|Sent to you/.test(h.text));
  for (const v of Object.values(D.sup)) for (const h of v.history) if (h.date >= from && h.date <= today && h.major && !h.undone && keep(h)) list.push({ sid: v.id, h });
  return list.sort((a, b) => b.h.date.localeCompare(a.h.date) || b.h.n - a.h.n);
}
function updatesMenu() {
  const u = updates();
  return `<div class="dropdown" style="width:380px;max-width:88vw" role="menu"><div style="padding:8px 10px"><b>Updates</b><div class="xs muted">${S.t === 0 ? "Since 11 Oct" : S.t === 1 ? "Since 15 Oct (simulated)" : "On 14 Nov (simulated)"}</div></div><div class="sep"></div>
    <div style="max-height:360px;overflow:auto">${u.slice(0, 40).map(x => `<button type="button" data-action="open-entry" data-sid="${x.sid}" data-key="${esc(x.h.key)}"><span class="stack-s" style="gap:2px"><span class="small"><b>${esc(SUP[x.sid].name)}</b> · ${fd(x.h.date, false)}</span><span class="xs muted">${esc(x.h.text.length > 110 ? x.h.text.slice(0, 108) + "…" : x.h.text)}</span></span></button>`).join("") || '<p class="small muted" style="padding:8px 10px">Nothing new.</p>'}</div></div>`;
}
function searchResults() {
  const q = UI.search.trim().toLowerCase(); if (!q) return "";
  const sups = W.suppliers.filter(s => (s.name + " " + s.city + " " + s.gstin + " " + s.contact).toLowerCase().includes(q)).slice(0, 6);
  const invs = W.invoices.filter(x => x.ref.toLowerCase().includes(q)).slice(0, 6);
  if (!sups.length && !invs.length) return `<div class="search-res"><p class="small muted" style="padding:8px">No supplier, invoice or GSTIN matches “${esc(UI.search)}”.</p></div>`;
  return `<div class="search-res">${sups.map(s => `<button type="button" data-action="open-sup" data-sid="${s.id}"><b>${esc(s.name)}</b> <span class="xs muted">${esc(s.city)} · ${esc(s.gstin)}</span></button>`).join("")}${invs.map(x => `<button type="button" data-action="open-sup" data-sid="${x.sid}" data-inv="${esc(x.ref)}"><span class="mono">${esc(x.ref)}</span> <span class="xs muted">${esc(SUP[x.sid].name)} · GST ${inr(x.gst)}</span></button>`).join("")}</div>`;
}

/* ============ sign in ============ */
function loginView() {
  return `<div class="login">
    <section class="loginart">
      <div class="brand"><span class="logo">${ic("send")}</span> Supplier Follow-up</div>
      <div class="eyebrow">Credit recovery for GST teams</div>
      <h1>Reconciliation finds the mismatch.<br>This closes the loop with the supplier.</h1>
      <p>Every supplier who owes you a GST fix, what they promised, and the proof. AI reads their replies and drafts the messages; code checks every answer against your records; you approve what matters.</p>
      <p class="cred">Rohit Kumar · Product assignment<br>Fictional company (Kestrel Auto Components), suppliers and amounts · no GST portal connection</p>
    </section>
    <section class="loginform">
      <form class="card stack" id="loginForm" novalidate>
        <div><h1>Welcome back</h1><p class="muted" style="margin-top:6px">Sign in as Abhishek Attri, GST lead at Kestrel.</p></div>
        <div><label class="lbl" for="email">Demo email</label><input type="email" id="email" value="${esc(USER.email)}" autocomplete="username"></div>
        <div><label class="lbl" for="password">Demo password</label><input type="password" id="password" value="demo123" autocomplete="current-password">
          <label class="row small" style="margin-top:8px;gap:7px;font-weight:500"><input type="checkbox" id="showPw" data-change="showpw"> Show password</label></div>
        <button class="btn primary" type="submit" style="justify-content:center">Open the inbox ${ic("arrow")}</button>
        <div id="loginError" class="small" role="alert" style="color:var(--red-fg)"></div>
        <p class="xs muted">The demo details are filled in. This is not real sign-in; don't enter a real password. Your changes stay in this browser only.</p>
        ${LINKS.submission ? `<a class="btn" href="${LINKS.submission}"${/^https?:/.test(LINKS.submission) ? ' target="_blank" rel="noopener"' : ""} style="justify-content:center">Read the assignment: write-up, slides and document</a>` : ""}
      </form>
    </section></div>`;
}
