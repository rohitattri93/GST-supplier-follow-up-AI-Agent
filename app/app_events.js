/* ============ live AI features ============ */
async function liveSummary(sid) {
  const v = D.sup[sid]; const sig = M.signature(v, D, S); const key = sid + "|" + sig;
  UI.busy["sum|" + sid] = true; UI.sumErr = null; UI.keepScroll = true; render();
  try {
    const r = await askChecked("summary", M.summaryPrompt(v, D, S), out => { const c = M.checkCited([String(out.summary || ""), ...(Array.isArray(out.points) ? out.points.map(String) : [])], v, D, S); c.ok = c.ok && typeof out.summary === "string"; return c; });
    S.live["sum|" + key] = { out: { summary: r.out.summary, points: Array.isArray(r.out.points) ? r.out.points : [] }, keys: M.citeKeys(v), ms: r.ms, tier: r.tier, retried: r.retried, at: new Date().toISOString() }; save();
  } catch (e) { UI.sumErr = sid; UI.sumErrText = errText(e); }
  UI.busy["sum|" + sid] = false; UI.keepScroll = true; render();
}
function qaCheck(v) { return out => { const c = M.checkCited([String(out.answer || "")], v, D, S); c.checks = c.checks.filter(x => x.t !== "No history entry cited"); c.ok = typeof out.answer === "string" && out.answer.length > 0 && c.checks.every(x => x.ok); return c; }; }
async function liveAsk(sid, q) {
  const v = D.sup[sid]; const chat = UI.chat[sid] = UI.chat[sid] || [];
  const m = { q, pending: true }; chat.push(m); UI.busy["ask|" + sid] = true; UI.keepScroll = true; render();
  try { const r = await askChecked("qa", M.qaPrompt(v, D, S, q), qaCheck(v)); Object.assign(m, { pending: false, a: { answer: r.out.answer, found: r.out.found !== false }, keys: M.citeKeys(v), mode: "live", ms: r.ms, tier: r.tier, checks: r.checks }); }
  catch (e) { Object.assign(m, { pending: false, error: errText(e) }); }
  UI.busy["ask|" + sid] = false; UI.keepScroll = true; render();
}
async function liveDraft(id, sid) {
  const v = D.sup[sid]; UI.busy["draft|" + id] = true; UI.draftErr = null; UI.keepScroll = true; render();
  try {
    const r = await askChecked("draft", W.draftMeta[id].prompt, out => { const c = M.checkDraft(id, String(out.body || ""), v.channel === "Email" ? String(out.subject || "") : "x"); const hard = c.checks.filter(x => !x.ok && !/length/i.test(x.t)); return { ok: !hard.length && typeof out.body === "string", checks: c.checks }; });
    UI.drafts[id] = { subject: r.out.subject || "", body: r.out.body, mode: "live", ms: r.ms, tier: r.tier };
  } catch (e) { UI.draftErr = id; UI.draftErrText = errText(e); }
  UI.busy["draft|" + id] = false; UI.keepScroll = true; render();
}
function readerPromptFor(v, text) {
  const s = v.s; const lastOut = [...v.history].reverse().find(h => h.kind === "message_out" && !h.undone);
  const ourDate = lastOut ? lastOut.date : "2026-10-01"; const our = lastOut ? ((W.draftMeta[lastOut.msg] || {}).purpose || "Asked them to fix their GST filing") : "Asked them to fix their GST filing";
  const open = v.inv.filter(x => !["recovered", "removed", "lost"].includes(x.st)).map(x => INV[x.ref]);
  const lines = open.map(x => `- ${x.ref} | ${fd(x.date)} | GST ${inr(x.gst)} | ${x.issue === "value" ? `Supplier reported GST ${inr(x.twob.gst)} instead of ${inr(x.gst)}` : x.issue === "tax_type" ? "Reported as IGST; should be CGST + SGST" : "Missing from our GSTR-2B"}`).join("\n");
  const today = clockNow(); const map = { buyer: W.buyer, supplier: `${s.name}, ${s.city} (GSTIN ${s.gstin})`, our_date: fd(ourDate), our_message: our + ".", open_invoices: lines || "- none", reply_date: today, reply_weekday: wday(today), channel: v.channel, reply: text };
  return W.prompts.reader.replace(/\{(buyer|supplier|our_date|our_message|open_invoices|reply_date|reply_weekday|channel|reply)\}/g, (m, k) => map[k]);
}
async function liveTry(sid) {
  const v = D.sup[sid]; const ta = $("#tryText-" + sid); const text = (ta && ta.value || "").trim();
  if (!text) { UI.tryOut[sid] = { error: "Write a reply first." }; render(); return; }
  UI.tryText = text; UI.busy["try|" + sid] = true; UI.keepScroll = true; render();
  const refs = v.inv.map(x => x.ref); const today = clockNow();
  try { const r = await askChecked("reader", readerPromptFor(v, text), out => { const g = M.guard(out, text, refs, today); return { ok: g._checks.every(c => c.ok), checks: g._checks }; }); UI.tryOut[sid] = { text, g: M.guard(r.out, text, refs, today), ms: r.ms, tier: r.tier }; }
  catch (e) { UI.tryOut[sid] = { error: errText(e) }; }
  UI.busy["try|" + sid] = false; UI.keepScroll = true; render();
}

/* ============ rules ============ */
function proposeRule(id, field, val) {
  const meta = RULES_META.find(r => r.id === id) || RULE_TEMPLATES.find(r => r.id === id);
  const old = S.rules[id][field];
  if (field !== "on") { const p = meta.param; val = Math.max(p.min, Math.min(p.max, Math.round(+val || p.def || old))); if (val === old) { UI.pendingRule = null; render(); return; } }
  const label = field === "on" ? `${id} ${meta.name}: turn ${val ? "on" : "off"}` : `${id} ${meta.name}: ${meta.param.money ? inr(old) : old} → ${meta.param.money ? inr(val) : val} ${meta.param.money ? "" : meta.param.unit}`.trim();
  UI.pendingRule = { id, field, val, old, label, diffs: previewChange(S2 => { S2.rules[id][field] = val; }) };
  UI.keepScroll = true; render();
}
function applySetting(key, on, label) {
  const diffs = previewChange(S2 => { S2.settings[key] = on; });
  S.settings[key] = on; S.ruleLog.unshift({ at: stamp(), by: USER.name, text: `Company setting “${label}” turned ${on ? "on" : "off"}${diffs.length ? ` (${diffs.length} ${plural(diffs.length, "supplier")}' next steps changed)` : ""}` });
  save(); UI.keepScroll = true; render();
  toast(`${label} ${on ? "on" : "off"}.${diffs.length ? ` ${diffs.length} ${plural(diffs.length, "supplier")} changed.` : ""}`);
}

/* ============ events ============ */
function afterRender(r) {
  const mr = $("#modalRoot"); if (mr) { mr.innerHTML = modalHTML(); fitCase(); }
  placeTour();
  if (UI.focusId) { const el = document.getElementById(UI.focusId); if (el) { el.focus(); try { const n = el.value.length; el.setSelectionRange(n, n); } catch (e) { } } UI.focusId = null; }
  if (UI.flashKey) { const el = $$(".hentry").find(x => x.dataset.key === UI.flashKey); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } UI.flashKey = null; }
  if (UI.scrollTo) { const el = document.getElementById(UI.scrollTo); if (el) el.scrollIntoView({ block: "start" }); UI.scrollTo = null; }
}
function closeMenus() { if (UI.menu || UI.search) { UI.menu = null; return true; } return false; }
document.addEventListener("click", e => {
  const a = e.target.closest("[data-action]");
  if (UI.menu && !e.target.closest(".dropdown") && !(a && a.dataset.action === "menu")) { UI.menu = null; if (!a) { UI.keepScroll = true; render(); return; } }
  if (UI.search && !e.target.closest(".searchbox")) { UI.search = ""; if (!a) { UI.keepScroll = true; render(); return; } }
  if (!a) return;
  if (e.target.closest("[data-stop]") && a.dataset.action === "open-sup" && a.tagName !== "BUTTON") return;
  const d = a.dataset; const act = d.action;
  const keep = () => { UI.keepScroll = true; render(); };
  switch (act) {
    case "nav": UI.sideOpen = false; UI.menu = null; if (a.getAttribute("href") === location.hash) { e.preventDefault(); render(); } return;
    case "nav-dash": UI.modal = null; go("dashboard"); return;
    case "open-sup": e.preventDefault(); UI.search = ""; UI.menu = null; UI.sideOpen = false; if (d.inv) UI.histFilter[d.sid] = d.inv; window.scrollTo(0, 0); go("supplier-" + d.sid); return;
    case "open-entry": UI.menu = null; UI.histFilter[d.sid] = "all"; UI.flashKey = d.key; go("supplier-" + d.sid); return;
    case "side-open": UI.sideOpen = true; render(); return;
    case "collapse": S.ui.collapsed = !S.ui.collapsed; save(); render(); return;
    case "toggle-thinking": S.ui.thinking = !S.ui.thinking; UI.menu = null; save(); keep(); return;
    case "menu": UI.menu = UI.menu === d.menu ? null : d.menu; keep(); return;
    case "tour-start": UI.menu = null; UI.tour = 0; S.ui.toured = true; save(); go("inbox"); return;
    case "tour-next": if (UI.tour >= TOUR.length - 1) { UI.tour = null; placeTour(); return; } UI.tour++; if (TOUR[UI.tour].route !== (location.hash.slice(1) || "inbox")) go(TOUR[UI.tour].route); else placeTour(); return;
    case "tour-prev": if (UI.tour > 0) { UI.tour--; if (TOUR[UI.tour].route !== (location.hash.slice(1) || "inbox")) go(TOUR[UI.tour].route); else placeTour(); } return;
    case "tour-end": UI.tour = null; placeTour(); return;
    case "ask-reset": UI.menu = null; UI.modal = { type: "reset" }; render(); return;
    case "reset": { const keepIn = S.ui.signedIn; S = SFA.freshState(); S.ui.signedIn = keepIn; S.ui.toured = true; save(); Object.assign(UI, { modal: null, drafts: {}, chat: {}, tryOut: {}, selected: new Set(), pendingRule: null, addRule: null, histFilter: {}, readSel: {}, q: "", owner: "", channel: "", group: "" }); go("inbox"); toast("The demo is reset to 15 Oct."); return; }
    case "logout": S.ui.signedIn = false; UI.menu = null; save(); render(); return;
    case "ai-status": UI.modal = { type: "ai" }; render(); return;
    case "time-next": $("#toastRoot").replaceChildren(); S.t = Math.min(2, (S.t || 0) + 1); UI.modal = { type: "jump", to: S.t }; UI.pendingRule = null; UI.addRule = null; UI.confirm = null; save(); window.scrollTo(0, 0); render(); return;
    case "time-reset": $("#toastRoot").replaceChildren(); S.t = 0; UI.modal = null; save(); window.scrollTo(0, 0); render(); toast("Back to 15 Oct. Your decisions are kept; the simulation replays from here."); return;
    case "renew": S.renewed = stamp(); save(); keep(); toast("GST portal access renewed until 12 Dec (simulated OTP)."); return;
    case "ims-accept": { const n = Object.values(D.inv).filter(x => x.st === "ims").length; doAct("ims:accept", {}, `Accepted ${n} records in IMS.`, "Acceptance undone."); return; }
    case "clear-filters": Object.assign(UI, { q: "", owner: "", channel: "", group: "" }); keep(); return;
    case "chip": UI.group = d.group || ""; keep(); return;
    case "select-routine": { const shown = new Set(filteredSuppliers().map(v => v.id)); UI.selected = new Set(D.routine.filter(sid => shown.has(sid))); keep(); return; } // only the rows the filters show
    case "bulk-approve": { const items = [...UI.selected].filter(sid => D.routine.includes(sid)).flatMap(sid => D.sup[sid].routineItems.map(it => Object.assign({ sid }, it))); if (items.length) { UI.modal = { type: "bulk", items }; render(); } return; }
    case "bulk-confirm": { if (noChannel()) { UI.modal = null; render(); toast("Email and WhatsApp are both off in Company settings, so nothing can be approved for sending."); return; }
      // same gate as a single approval: a draft with a failed check (other than length) is left for the person to open
      const all = UI.modal.items; const items = all.filter(it => { const dd = B.drafts[it.draft] || {}; const c = M.checkDraft(it.draft, String(dd.body || ""), dd.subject || "x"); return !c.checks.some(x => !x.ok && !/length/i.test(x.t)); }); const keys = []; for (const it of items) { const k = (it.action === "approve" ? "approve:" : "send:") + it.draft; archiveIfUndone(S.acts, k); S.acts[k] = { at: stamp(), by: "user", bulk: true }; keys.push(k); } UI.modal = null; UI.selected = new Set(); save(); render(); toast(`Approved ${items.length} routine ${plural(items.length, "message")}${all.length > items.length ? `; ${all.length - items.length} left for you to open (a check failed)` : ""}.`, { undo: () => { keys.forEach(k => { if (S.acts[k] && !S.acts[k].undone) S.acts[k].undone = stamp(); }); save(); render(); toast("Undone. Nothing was sent."); } }); return; }
    case "scroll": { const el = document.getElementById(d.target); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    case "cite": UI.histFilter[d.sid] = "all"; UI.flashKey = d.key; keep(); return;
    case "casefile": UI.modal = { type: "case", sid: d.sid }; UI.pdfNote = ""; render(); return;
    case "pdf": makePdf(d.sid); return;
    case "fb": { const note = ($("#fbNote") || {}).value || ""; S.feedback[d.key] = { verdict: d.v, note, at: stamp() }; UI.fbOpen = null; save(); keep(); toast(d.v === "helpful" ? "Thanks. Counted on the dashboard." : "Thanks. Logged for the next prompt review."); return; }
    case "fb-open": UI.fbOpen = d.key; keep(); return;
    case "fb-cancel": UI.fbOpen = null; keep(); return;
    case "sum-live": liveSummary(route().sid); return;
    case "send-ask": { const id = d.id; captureDraft(id); UI.confirm = id; keep(); return; }
    case "send-cancel": UI.confirm = null; keep(); return;
    case "send-confirm": {
      const id = d.id; const m = W.draftMeta[id]; const ed = UI.drafts[id]; const orig = B.drafts[id] || {};
      const edited = ed && (ed.body !== orig.body || (ed.subject || "") !== (orig.subject || "")) ? { subject: ed.subject || "", body: ed.body } : null;
      const v = D.sup[d.sid]; UI.confirm = null;
      if (noChannel()) { keep(); toast("Email and WhatsApp are both off in Company settings. Turn one on to send."); return; }
      if (d.kind === "approve") doAct("approve:" + id, { edit: edited }, `Approved. The message goes to ${m.to} on ${fd(m.when, false)}.`, "Approval undone.");
      else doAct("send:" + id, { edit: edited, channel: v.channel }, `Sent to ${m.to} at ${v.s.name} by ${v.channel} (simulated).`, "Undone. The message was never sent.");
      delete UI.drafts[id]; return;
    }
    case "skip-open": UI.skipFor = d.sid; keep(); return;
    case "skip-cancel": UI.skipFor = null; keep(); return;
    case "skip": { const reason = ($("#skipReason") || {}).value; const note = ($("#skipNote") || {}).value; UI.skipFor = null; doAct("skip:" + d.sid, { reason: reason + (note ? ": " + note : "") }, "Skipped. It stays in the history with your reason.", "Skip undone."); return; }
    case "unskip": { const k = "skip:" + d.sid; if (S.acts[k] && !S.acts[k].undone) { S.acts[k].undone = stamp(); save(); keep(); toast("The step is back in your decisions."); } return; }
    case "redraft": liveDraft(d.id, d.sid); return;
    case "draft-reset": delete UI.drafts[d.id]; keep(); return;
    case "book": doAct("book:" + d.sid, {}, "Our entry is corrected and matched. ₹59,400 confirmed.", "Correction undone."); return;
    case "dup": doAct("dup:" + d.sid, {}, "ST/2231-B removed from our books as a duplicate.", "Removal undone."); return;
    case "read-sel": UI.readSel[d.sid] = d.rid; keep(); return;
    case "confirm-reading": doReview(d.rid, { verdict: "confirmed" }, "Reading confirmed. Counted on the dashboard."); return;
    case "correct-open": UI.correctFor = d.rid; keep(); return;
    case "correct-cancel": UI.correctFor = null; keep(); return;
    case "correct-save": { const intent = $("#corrIntent").value; const reason = $("#corrReason").value.trim(); UI.correctFor = null; doReview(d.rid, { verdict: "corrected", intent, reason }, "Correction saved. It feeds the next prompt review."); return; }
    case "manual-pos": { const intent = $("#manualPos").value; doReview(d.rid, { verdict: "manual", intent, reason: "Recorded by hand while AI was off" }, "Position recorded."); return; }
    case "undo-correction": { const rid = Object.keys(S.reviews).find(k => REPLY[k] && REPLY[k].sid === d.sid && S.reviews[k].verdict === "corrected" && !S.reviews[k].undone); if (rid) { S.reviews[rid].undone = stamp(); save(); keep(); toast("Correction undone. The automatic step is back."); } return; }
    case "hist-inv": UI.histFilter[d.sid] = d.ref; UI.scrollTo = "histCard"; keep(); return;
    case "hist-f": UI.histFilter[d.sid] = d.f; keep(); return;
    case "ask-rec": { const v = D.sup[d.sid]; const rec = B.qa[d.sid][+d.i]; const chat = UI.chat[d.sid] = UI.chat[d.sid] || []; const fresh = rec.sig === M.signature(v, D, S); chat.push({ q: rec.q, a: rec.output, keys: rec.keys, mode: "recorded", sig: rec.sig, checks: fresh ? qaCheck(v)(rec.output).checks : null }); keep(); return; }
    case "ask-live-again": liveAsk(d.sid, d.q); return;
    case "try-tab": UI.tryTab[d.sid] = d.tab; keep(); return;
    case "try-sample": UI.trySample = d.id; keep(); return;
    case "try-eg": { const ta = $("#tryText-" + d.sid); if (ta) { ta.value = d.text; UI.tryText = d.text; ta.focus(); } return; }
    case "try-live": liveTry(d.sid); return;
    case "goto-rule": UI.scrollTo = "rule-" + d.rule; go("rules"); return;
    case "rule-apply": { const p = UI.pendingRule; if (!p) return; S.rules[p.id][p.field] = p.val; S.ruleLog.unshift({ at: stamp(), by: USER.name, text: `${p.label}${p.diffs.length ? ` (${p.diffs.length} ${plural(p.diffs.length, "supplier")} changed)` : ""}` }); UI.pendingRule = null; save(); keep(); toast(`Rule ${p.id} updated.${p.diffs.length ? ` ${p.diffs.length} ${plural(p.diffs.length, "supplier")} changed.` : ""}`); return; }
    case "rule-cancel": UI.pendingRule = null; keep(); return;
    case "rule-add-open": UI.addRule = { id: null }; UI.pendingRule = null; keep(); return;
    case "rule-add-pick": { const t = RULE_TEMPLATES.find(x => x.id === d.rule); const val = t.param.def; UI.addRule = { id: t.id, value: val, diffs: previewChange(S2 => { S2.rules[t.id] = { on: true, [t.param.key]: val }; }) }; keep(); return; }
    case "rule-add-save": { const a = UI.addRule; const t = RULE_TEMPLATES.find(x => x.id === a.id); S.rules[t.id] = { on: true, [t.param.key]: a.value }; S.ruleLog.unshift({ at: stamp(), by: USER.name, text: `Added ${t.id} ${t.name}: ${t.when.replace("{n}", a.value).replace("{x}", inr(a.value))} → ${t.then}${a.diffs.length ? ` (${a.diffs.length} ${plural(a.diffs.length, "supplier")} changed)` : ""}` }); UI.addRule = null; save(); keep(); toast(`Rule ${t.id} added.`); return; }
    case "rule-add-cancel": UI.addRule = null; keep(); return;
    case "rule-del": { const id = d.rule; if (UI.delRule !== id) { UI.delRule = id; toast(`Select delete again to remove rule ${id}.`); setTimeout(() => { if (UI.delRule === id) UI.delRule = null; }, 5000); return; } const t = RULE_TEMPLATES.find(x => x.id === id); delete S.rules[id]; S.ruleLog.unshift({ at: stamp(), by: USER.name, text: `Deleted ${id} ${t.name}` }); UI.delRule = null; save(); keep(); toast(`Rule ${id} deleted.`); return; }
    case "testset": UI.modal = { type: "testset" }; render(); return;
    case "drill-group": Object.assign(UI, { group: d.group, owner: "", channel: "", q: "" }); go("inbox"); return;
    case "drill-owner": Object.assign(UI, { owner: d.owner, group: "", channel: "", q: "" }); go("inbox"); return;
    case "as-table": UI.asTable[d.id] = !UI.asTable[d.id]; keep(); return;
    case "dash-clear": UI.dash = { unit: "", owner: "", fy: "" }; keep(); return;
    case "modal-close": UI.modal = null; render(); return;
    case "modal-close-bg": if (e.target === a) { UI.modal = null; render(); } return;
  }
});
function captureDraft(id) {
  const b = $("#body-" + id), s = $("#subj-" + id);
  if (b) { const prev = UI.drafts[id]; const orig = B.drafts[id] || {}; const changed = b.value !== (prev ? prev.body : orig.body) || (s && s.value !== (prev ? prev.subject : orig.subject)); if (changed || prev) UI.drafts[id] = Object.assign({}, prev || {}, { body: b.value, subject: s ? s.value : (prev || orig).subject || "", mode: prev && prev.mode === "live" && !changed ? "live" : "edited" }); }
}
document.addEventListener("change", e => {
  const el = e.target; const k = el.dataset && el.dataset.change; if (!k) return;
  const keep = () => { UI.keepScroll = true; render(); };
  switch (k) {
    case "thinking": S.ui.thinking = el.checked; save(); keep(); return;
    case "showpw": { const p = $("#password"); if (p) p.type = el.checked ? "text" : "password"; return; }
    case "fOwner": UI.owner = el.value; keep(); return;
    case "fChan": UI.channel = el.value; keep(); return;
    case "fSort": UI.sort = el.value; keep(); return;
    case "sel": if (el.checked) UI.selected.add(el.dataset.sid); else UI.selected.delete(el.dataset.sid); keep(); return;
    case "set-ai": applySetting("ai", el.checked, "AI features"); return;
    case "set-auto": applySetting("autoReminders", el.checked, "Automatic routine reminders"); return;
    case "set-email": applySetting("email", el.checked, "Email"); return;
    case "set-wa": applySetting("whatsapp", el.checked, "WhatsApp"); return;
    case "set-holds": applySetting("holds", el.checked, "Payment-hold suggestions"); return;
    case "rule-on": proposeRule(el.dataset.rule, "on", el.checked); return;
    case "rule-param": { const id = el.dataset.rule; const meta = RULES_META.find(r => r.id === id) || RULE_TEMPLATES.find(r => r.id === id); proposeRule(id, meta.param.key, el.value); return; }
    case "rule-add-val": { const a = UI.addRule; const t = RULE_TEMPLATES.find(x => x.id === a.id); a.value = Math.max(t.param.min, Math.min(t.param.max, Math.round(+el.value || t.param.def))); a.diffs = previewChange(S2 => { S2.rules[t.id] = { on: true, [t.param.key]: a.value }; }); keep(); return; }
    case "dUnit": UI.dash.unit = el.value; keep(); return;
    case "dOwner": UI.dash.owner = el.value; keep(); return;
    case "dFy": UI.dash.fy = el.value; keep(); return;
  }
});
let searchTimer = null;
document.addEventListener("input", e => {
  const el = e.target; const k = el.dataset && el.dataset.input; if (!k) return;
  if (k === "gsearch") { UI.search = el.value; const box = el.closest(".searchbox"); const old = box.querySelector(".search-res"); if (old) old.remove(); if (UI.search) box.insertAdjacentHTML("beforeend", searchResults()); return; }
  if (k === "inboxQ") { UI.q = el.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { UI.focusId = "inboxQ"; UI.keepScroll = true; render(); }, 180); return; }
  if (k === "draft") { const id = el.dataset.id; captureDraft(id); const d = UI.drafts[id]; const v = D.sup[W.draftMeta[id].sid]; const c = M.checkDraft(id, d.body, v.channel === "Email" ? d.subject : "x"); const box = $("#checks-" + id); if (box) box.innerHTML = draftChecksHTML(c); const btn = $(`[data-action="send-ask"][data-id="${id}"]`); if (btn) btn.disabled = c.checks.some(x => !x.ok && !/length/i.test(x.t)); return; }
});
document.addEventListener("submit", e => {
  const f = e.target;
  if (f.id === "loginForm") {
    e.preventDefault(); const em = $("#email").value.trim().toLowerCase(), pw = $("#password").value; const err = $("#loginError");
    if (!em || !pw) { err.textContent = "Enter the demo email and password."; return; }
    if (em !== USER.email || pw !== "demo123") { err.textContent = `Use the demo details: ${USER.email} and demo123.`; return; }
    S.ui.signedIn = true; save(); if (!location.hash) location.hash = "inbox"; render(); return;
  }
  if (f.dataset.form === "ask") { e.preventDefault(); const sid = f.dataset.sid; const inp = $("#askIn-" + sid); const q = inp.value.trim(); if (!q || !canLive()) return; inp.value = ""; liveAsk(sid, q); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if (UI.modal) { UI.modal = null; render(); } else if (UI.tour != null) { UI.tour = null; placeTour(); } else if (closeMenus() || UI.sideOpen) { UI.sideOpen = false; UI.keepScroll = true; render(); } }
  if (e.key === "Enter" && e.target.classList && e.target.classList.contains("mcard")) e.target.click();
});
window.addEventListener("hashchange", () => { UI.menu = null; UI.sideOpen = false; UI.confirm = null; UI.skipFor = null; window.scrollTo(0, 0); render(); });
window.addEventListener("resize", () => { fitCase(); if (UI.tour != null) placeTour(); });
let tipEl = null;
document.addEventListener("mousemove", e => {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (!t) { if (tipEl) { tipEl.remove(); tipEl = null; } return; }
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); }
  tipEl.textContent = t.dataset.tip; tipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 270) + "px"; tipEl.style.top = e.clientY + 14 + "px";
});
document.addEventListener("click", e => { if (UI.sideOpen && !e.target.closest(".side") && !e.target.closest("[data-action='side-open']")) { UI.sideOpen = false; UI.keepScroll = true; render(); } }, true);

/* ============ start ============ */
render();
initLive();
