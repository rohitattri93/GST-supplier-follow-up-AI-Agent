/* ============ Rules and company settings ============ */
function describeNext(v) { return [v.status, v.next.kind === "decision" ? v.next.title : v.next.text, v.next.also || "", ...v.pending.slice(1).map(p => p.title), v.priority === 0 ? "first in the inbox" : ""].join(" · "); }
function shortNext(v) { const n = v.next; const p = n.kind === "decision" ? (n.routine ? "Needs your approval: " : "Needs you: ") + n.title : n.text; return p + (n.also ? ` · ${n.also}` : "") + (v.pending.length > 1 ? ` (+${v.pending.length - 1} more)` : ""); }
function previewChange(mut) {
  const S2 = JSON.parse(JSON.stringify(S)); mut(S2); const D2 = M.derive(S2); const out = [];
  for (const sid of Object.keys(D.sup)) { const a = D.sup[sid], b = D2.sup[sid]; if (describeNext(a) !== describeNext(b)) out.push({ sid, before: a.priority !== b.priority && shortNext(a) === shortNext(b) ? (a.priority === 0 ? "First in the inbox (last year's credit)" : "Ordered by status and amount") : shortNext(a), after: a.priority !== b.priority && shortNext(a) === shortNext(b) ? (b.priority === 0 ? "First in the inbox (last year's credit)" : "Ordered by status and amount, not first") : shortNext(b) }); }
  return out;
}
function ruleUse(id) {
  const n = new Set();
  for (const v of Object.values(D.sup)) {
    const txt = [v.next && (v.next.text || ""), v.next && (v.next.why || ""), v.next && (v.next.also || ""), ...v.pending.map(p => p.why || ""), ...v.history.filter(h => h.major).map(h => h.text)].join(" ");
    if (new RegExp("\\b" + id + "\\b").test(txt)) n.add(v.id);
    if (id === "R3" && v.history.some(h => h.kind === "reading" && /Sent to you/.test(h.text))) n.add(v.id);
    if (id === "R7" && v.history.some(h => h.kind === "reading" && M.reading(h.reading) && M.reading(h.reading).intent === "claims_fixed")) n.add(v.id);
    if (id === "R8" && S.rules.R8.on && W.invoices.some(x => x.sid === v.id && x.fy === "2025-26")) n.add(v.id);
    if (id === "R6" && v.next && v.next.hold) n.add(v.id);
  }
  return [...n];
}
function ruleParamText(meta, r) {
  const p = meta.param; if (!p) return esc(meta.then);
  const pr = UI.pendingRule; const val = pr && pr.id === meta.id && pr.field === p.key ? pr.val : (r[p.key] ?? p.def);
  const input = `<input type="number" class="param" id="param-${meta.id}" min="${p.min}" max="${p.max}" step="${p.money ? 10000 : 1}" value="${val}" data-change="rule-param" data-rule="${meta.id}" aria-label="${esc(meta.name)}: ${esc(p.unit)}" ${(S.t || 0) > 0 ? "disabled" : ""}>`;
  return esc(meta.then).replace(/\{n\}|\{x\}/, input);
}
function rulesView() {
  const locked = (S.t || 0) > 0; const st = S.settings;
  const autoN = Object.values(D.sup).filter(v => v.next.kind === "auto").length;
  const rows = [...RULES_META, ...RULE_TEMPLATES.filter(t => S.rules[t.id])].map(meta => {
    const r = S.rules[meta.id] || {}; const use = ruleUse(meta.id);
    const gated = meta.needs && !st[meta.needs];
    const when = meta.id === "R10" ? esc(meta.when).replace("{x}", `<input type="number" class="param" style="width:110px" id="param-${meta.id}" min="${meta.param.min}" max="${meta.param.max}" step="10000" value="${r.x}" data-change="rule-param" data-rule="${meta.id}" aria-label="Amount in rupees" ${locked ? "disabled" : ""}>`) : esc(meta.when).replace("{n}", meta.id === "R9" ? `<input type="number" class="param" id="param-${meta.id}" min="3" max="21" value="${r.n}" data-change="rule-param" data-rule="${meta.id}" aria-label="Days" ${locked ? "disabled" : ""}>` : "{n}");
    const then = (meta.id === "R10" || meta.id === "R9" ? esc(meta.then) : ruleParamText(meta, r)) + (meta.demo ? `<div class="sub" style="color:var(--amber-fg)">${esc(meta.demo)}</div>` : "");
    return `<tr class="rule-row" id="rule-${meta.id}"><td><span class="rule-chip">${meta.id}</span></td><td><b>${esc(meta.name)}</b><div class="sub">${when}</div></td><td>${then}${gated ? `<div class="sub" style="color:var(--amber-fg)">Inactive: payment-hold suggestions are off in Company settings</div>` : ""}</td>
      <td>${meta.locked ? `<span class="locked">${ic("lock")} Always on</span>` : sw("ruleon-" + meta.id, r.on, "rule-on", "Rule " + meta.id + " on", locked).replace('data-change="rule-on"', `data-change="rule-on" data-rule="${meta.id}"`)}</td>
      <td class="small">${use.length ? `${use.length} ${plural(use.length, "supplier")}<div class="sub">${esc(use.slice(0, 3).map(s => SUP[s].name.split(" ")[0]).join(", "))}${use.length > 3 ? "…" : ""}</div>` : '<span class="muted">None right now</span>'}</td>
      <td>${RULE_TEMPLATES.some(t => t.id === meta.id) && !locked ? `<button type="button" class="btn ghost sm danger" data-action="rule-del" data-rule="${meta.id}">${ic("trash")}<span class="sr">Delete</span></button>` : ""}</td></tr>`;
  }).join("");
  const pr = UI.pendingRule;
  return `
  <section class="stack-s"><div class="eyebrow">Rules · Kestrel Auto Components</div><h1>You set the rules. The agent follows them.</h1><p class="ink2" style="max-width:780px">Every automatic step names the rule that caused it. Change a value and see which suppliers it affects before you apply it. Two safety rules can't be switched off.</p></section>
  ${locked ? `<div class="banner amber">${ic("lock")}<span class="grow">Rules and most settings can be changed on 15 Oct only, because the simulation replays from that day.</span><button type="button" class="btn sm" data-action="time-reset">Go back to 15 Oct</button></div>` : ""}
  <section class="card stack" id="settingsCard"><div class="card-h" style="margin:0"><h2>Company settings</h2><span class="xs muted">Apply to every supplier</span></div>
    <div>
      ${settingRow("set-ai", st.ai, "AI features", "Reads replies, writes drafts and summaries, answers questions. Off means manual mode: you record positions yourself, drafts use templates and summaries are written by code.", false)}
      ${settingRow("set-auto", st.autoReminders, "Automatic routine reminders", `Reminders and follow-ups that a rule schedules go out without approval. Now: ${autoN} automatic ${plural(autoN, "step")}. Off: each needs your approval, or bulk approval in the inbox.`, locked)}
      ${settingRow("set-email", st.email, "Email", "Send messages by email.", locked)}
      ${settingRow("set-wa", st.whatsapp, "WhatsApp", "Send messages on WhatsApp (pre-approved templates outside the 24-hour reply window). Off: WhatsApp suppliers are written to by email.", locked)}
      ${settingRow("set-holds", st.holds, "Payment-hold suggestions", "Lets rule R6 suggest holding only the GST part of a payment when a supplier wants payment first. Never for micro or small enterprises, never on invoices older than the R6 limit.", locked)}
    </div>
    ${why("Configuration, not customisation", `<p>Every company wants different timing and different limits, but they should not need custom code. Values and switches cover the real differences (how early to remind, which channels, whether money can be used as a lever) while the safety rules stay fixed. <b>Measures:</b> rule changes that are undone within a week, a sign the defaults are wrong.</p>`)}
  </section>
  <section class="card stack" id="rulesCard"><div class="card-h" style="margin:0"><h2>Follow-up rules</h2>${locked ? "" : `<button type="button" class="btn sm" data-action="rule-add-open">${ic("plus")} Add a rule</button>`}</div>
    ${pr ? diffPanel(pr) : ""}
    ${UI.addRule ? addRulePanel() : ""}
    <div class="tbl"><table><thead><tr><th>ID</th><th>When</th><th>Then</th><th>On</th><th>Used for</th><th><span class="sr">Delete</span></th></tr></thead><tbody>${rows}</tbody></table></div>
    ${why("Why preview before apply", `<p>A rule change silently moves dozens of reminders. Showing exactly which suppliers change, and how, turns a risky setting into a reviewable decision. The safety rules (R3 and R7) are locked because they are what makes automatic handling safe.</p>`)}
  </section>
  <section class="card stack"><h2>Rule history</h2>${S.ruleLog.length ? `<div class="history">${S.ruleLog.map((l, i) => `<div class="hentry"><span class="n">${S.ruleLog.length - i}</span><div class="stack-s" style="gap:2px"><div class="who"><b>${esc(l.at.replace("T", " "))}</b><span>${esc(l.by)}</span></div><div class="txt">${esc(l.text)}</div></div></div>`).join("")}</div>` : `<p class="muted small">No changes yet. The rules are the defaults Kestrel started with.</p>`}</section>`;
}
function settingRow(id, on, title, desc, disabled) {
  return `<div class="setting"><div><b>${esc(title)}</b><div class="small ink2">${esc(desc)}</div></div>${sw(id, on, id, title, disabled)}</div>`;
}
function diffPanel(pr) {
  return `<div class="diff" id="diffPanel"><b>${esc(pr.label)}</b>${pr.diffs.length ? `<span class="small">This changes the next step for ${pr.diffs.length} ${plural(pr.diffs.length, "supplier")}:</span><ul class="small">${pr.diffs.map(d => `<li><b>${esc(SUP[d.sid].name)}</b>: ${esc(d.before)} → <b>${esc(d.after)}</b></li>`).join("")}</ul>` : `<span class="small">No supplier's next step changes today. It will apply to future cases.</span>`}
    <div class="row"><button type="button" class="btn primary sm" data-action="rule-apply">Apply the change</button><button type="button" class="btn ghost sm" data-action="rule-cancel">Cancel</button></div></div>`;
}
function addRulePanel() {
  const a = UI.addRule;
  return `<div class="diff"><b>Add a rule from a template</b><div class="row">${RULE_TEMPLATES.filter(t => !S.rules[t.id]).map(t => `<button type="button" class="chip" aria-pressed="${a.id === t.id}" data-action="rule-add-pick" data-rule="${t.id}">${esc(t.name)}</button>`).join("") || '<span class="small muted">Both templates are already added.</span>'}</div>
    ${a.id ? (() => { const t = RULE_TEMPLATES.find(x => x.id === a.id); return `<div class="small">When: ${esc(t.when.replace("{n}", a.value).replace("{x}", inr(a.value)))} · Then: ${esc(t.then)}</div>${t.demo ? `<div class="small" style="color:var(--amber-fg)">${esc(t.demo)}</div>` : ""}<div class="row"><label class="small" for="newRuleVal">${t.param.money ? "Amount (₹)" : "Days"}</label><input type="number" id="newRuleVal" class="param" style="width:120px" min="${t.param.min}" max="${t.param.max}" step="${t.param.money ? 10000 : 1}" value="${a.value}" data-change="rule-add-val"></div>
      ${a.diffs ? (a.diffs.length ? `<span class="small">Adding it changes ${a.diffs.length} ${plural(a.diffs.length, "supplier")}:</span><ul class="small">${a.diffs.map(d => `<li><b>${esc(SUP[d.sid].name)}</b>: ${esc(d.before)} → <b>${esc(d.after)}</b></li>`).join("")}</ul>` : '<span class="small">No supplier changes today.</span>') : ""}
      <div class="row"><button type="button" class="btn primary sm" data-action="rule-add-save">Add the rule</button><button type="button" class="btn ghost sm" data-action="rule-add-cancel">Cancel</button></div>`; })() : `<div class="row"><button type="button" class="btn ghost sm" data-action="rule-add-cancel">Cancel</button></div>`}</div>`;
}

/* ============ Dashboard ============ */
function dashData() {
  const f = UI.dash;
  const pass = x => (!f.unit || x.unit === f.unit) && (!f.owner || SUP[x.sid].owner === f.owner) && (!f.fy || x.fy === f.fy);
  const xs = W.invoices.filter(pass);
  const st = r => D.inv[r].st;
  const sum = arr => arr.reduce((a, x) => a + x.stuck, 0);
  const flagged = sum(xs), removed = sum(xs.filter(x => st(x.ref) === "removed")), rec = sum(xs.filter(x => st(x.ref) === "recovered")), lost = sum(xs.filter(x => st(x.ref) === "lost"));
  const open = flagged - removed - rec - lost;
  return { xs, flagged, removed, rec, lost, open, st };
}
function barChart(id, title, sub, rows, opts = {}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  const table = UI.asTable[id];
  return `<section class="card stack" id="chart-${id}"><div class="row between" style="align-items:flex-start"><div><h2>${esc(title)}</h2><p class="xs muted" style="margin-top:3px">${esc(sub)}</p></div><button type="button" class="btn ghost sm" data-action="as-table" data-id="${id}">${table ? "Show as chart" : "Show as table"}</button></div>
    ${!rows.length ? `<p class="muted small">Nothing to show for these filters.</p>` : table ? `<div class="tbl"><table><thead><tr><th>${esc(opts.label || "Group")}</th><th class="r">${esc(opts.valueLabel || "Credit")}</th>${opts.count ? `<th class="r">${esc(opts.count)}</th>` : ""}</tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td><td class="r num">${opts.money === false ? r.value : inr(r.value)}</td>${opts.count ? `<td class="r num">${r.n}</td>` : ""}</tr>`).join("")}</tbody></table></div>`
      : `<div class="bars">${rows.map(r => `<button type="button" class="bar" ${r.go ? `data-action="${r.go.action}" ${Object.entries(r.go.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}` : ""} data-tip="${esc(r.tip || r.label)}"><span class="lab">${esc(r.label)}</span><span class="track"><span class="fill" style="width:${(r.value / max * 100).toFixed(1)}%;background:${r.color || "var(--blue)"}"></span></span><span class="val">${opts.money === false ? r.value : lakh(r.value)}</span></button>`).join("")}</div>`}
  </section>`;
}
function dashboardView() {
  const dd = dashData(); const t = S.t || 0; const f = UI.dash;
  const owners = [...new Set(W.suppliers.map(s => s.owner))];
  const groupRows = GROUPS.map(g => { const xs = dd.xs.filter(x => ST[dd.st(x.ref)].group === g.id && dd.st(x.ref) !== "removed"); return { id: g.id, label: g.label, value: xs.reduce((a, x) => a + x.stuck, 0), n: xs.length }; }).filter(r => r.value > 0);
  const gColor = { needs: "var(--amber-fg)", promised: "var(--blue)", waiting: "var(--muted)", ims: "var(--indigo-fg)", fixed: "var(--green-fg)", lost: "var(--red-fg)" };
  groupRows.forEach(r => { r.color = gColor[r.id]; r.tip = `${r.label}: ${inr(r.value)} across ${r.n} ${plural(r.n, "invoice")}`; r.go = { action: "drill-group", data: { group: r.id } }; });
  const topG = groupRows.slice().sort((a, b) => b.value - a.value)[0];
  const ownerRows = owners.map(o => { const xs = dd.xs.filter(x => SUP[x.sid].owner === o && !["recovered", "removed", "lost"].includes(dd.st(x.ref))); return { label: o, value: xs.reduce((a, x) => a + x.stuck, 0), n: xs.length, go: { action: "drill-owner", data: { owner: o } } }; }).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  ownerRows.forEach(r => { r.tip = `${r.label}: ${inr(r.value)} open across ${r.n} ${plural(r.n, "invoice")}`; });
  const unitRows = Object.entries(W.units).map(([k, u]) => { const xs = dd.xs.filter(x => x.unit === k && !["recovered", "removed", "lost"].includes(dd.st(x.ref))); return { label: `${u.name} (${u.gstin.slice(0, 2)})`, value: xs.reduce((a, x) => a + x.stuck, 0), n: xs.length, tip: `${u.name} unit, GSTIN ${u.gstin}: ${inr(xs.reduce((a, x) => a + x.stuck, 0))} open` }; }).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  // reply types from readings in the current history
  const reads = Object.values(D.sup).filter(v => (!f.owner || v.s.owner === f.owner) && (!f.unit || v.s.unit === f.unit)).flatMap(v => v.history.filter(h => h.kind === "reading" && !h.undone).map(h => { const g = M.reading(h.reading); const sentByCheck = v.history.some(x => x.kind === "check" && x.date === h.date && x.n > h.n && /Sent to you/.test(x.text)); return { sid: v.id, g, person: g._human || sentByCheck }; }));
  const types = {}; reads.forEach(r => { const k = INTENT_TEXT[r.g.intent]; types[k] = types[k] || { n: 0, auto: 0, sups: [] }; types[k].n++; if (!r.person) types[k].auto++; types[k].sups.push(SUP[r.sid].name); });
  const typeRows = Object.entries(types).map(([k, v]) => ({ label: k, value: v.n, n: v.auto, tip: `${k}: ${v.n} (${v.auto} handled without a person) · ${v.sups.join(", ")}` })).sort((a, b) => b.value - a.value);
  const autoN = reads.filter(r => !r.person).length;
  const rate = dd.flagged - dd.removed ? Math.round(dd.rec / (dd.flagged - dd.removed) * 100) : 0;
  const cf = D.counterfactual;
  const q = B.eval.summary.quick, dflt = B.eval.summary.default;
  const reviews = Object.entries(S.reviews).filter(([k, r]) => !k.includes("~") && !r.undone);
  const confirmed = reviews.filter(([, r]) => r.verdict === "confirmed").length + (S.reviews.D01 ? 0 : 1);
  const corrected = reviews.filter(([, r]) => r.verdict === "corrected" || r.verdict === "manual").length;
  const liveCalls = S.log.filter(l => l.ok); const avgMs = liveCalls.length ? Math.round(liveCalls.reduce((a, l) => a + l.ms, 0) / liveCalls.length) : null;
  const fbs = Object.values(S.feedback); const helpful = fbs.filter(x => x.verdict === "helpful").length;
  const filters = `<div class="toolbar"><label class="sr" for="dUnit">Unit</label><select id="dUnit" data-change="dUnit"><option value="">All 3 GSTINs</option>${Object.entries(W.units).map(([k, u]) => `<option value="${k}" ${f.unit === k ? "selected" : ""}>${esc(u.name)} · ${esc(u.gstin)}</option>`).join("")}</select>
    <label class="sr" for="dOwner">Owner</label><select id="dOwner" data-change="dOwner"><option value="">All owners</option>${owners.map(o => `<option ${f.owner === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>
    <label class="sr" for="dFy">Credit year</label><select id="dFy" data-change="dFy"><option value="">Both financial years</option><option value="2025-26" ${f.fy === "2025-26" ? "selected" : ""}>FY 2025-26 (claim by 30 Nov)</option><option value="2026-27" ${f.fy === "2026-27" ? "selected" : ""}>FY 2026-27</option></select>
    ${f.unit || f.owner || f.fy ? `<button type="button" class="btn ghost sm" data-action="dash-clear">Clear filters</button>` : ""}</div>`;
  return `
  <section class="stack-s"><div class="eyebrow">Dashboard · ${T_LABEL[t]}${t ? " (simulated)" : ""}</div><h1>${t === 2 ? `${rate}% of flagged credit recovered this cycle` : `${lakh(dd.open)} of credit is still open`}</h1><p class="ink2">Credit counts as recovered only when it appears in GSTR-2B. Click a bar to open those suppliers in the inbox.</p></section>
  ${filters}
  <section class="kpis">
    <div class="card kpi good"><span class="k">North Star: credit recovered</span><span class="v">${lakh(dd.rec)}</span><span class="s">${rate}% of ${lakh(dd.flagged - dd.removed)} flagged, confirmed in GSTR-2B</span></div>
    <div class="card kpi"><span class="k">Still open</span><span class="v">${lakh(dd.open)}</span><span class="s">${dd.xs.filter(x => !["recovered", "removed", "lost"].includes(dd.st(x.ref))).length} invoices</span></div>
    <div class="card kpi ${dd.lost ? "alert" : ""}"><span class="k">${t === 2 ? "Lost: not in the last GSTR-2B before 30 Nov" : "FY 2025-26 still open"}</span><span class="v">${lakh(t === 2 ? dd.lost : dd.xs.filter(x => x.fy === "2025-26" && !["recovered", "removed", "lost"].includes(dd.st(x.ref))).reduce((a, x) => a + x.stuck, 0))}</span><span class="s">${t === 2 ? "Guardrail: should be zero" : "Must be in GSTR-2B by 14 Nov"}</span></div>
    <div class="card kpi"><span class="k">Replies handled without a person</span><span class="v">${autoN} of ${reads.length}</span><span class="s">The rest went to a person by rule</span></div>
  </section>
  ${t > 0 && cf ? `<div class="banner ${D.tot.recovered > cf.recovered ? "green" : "blue"}">${ic("chart")}<span class="grow"><b>What your 15 Oct decisions were worth (simulated):</b> ${t === 2 ? `${lakh(D.tot.recovered)} recovered against ${lakh(cf.recovered)} if you had made no decisions (automatic rules still running), and ${lakh(D.tot.lost)} lost against ${lakh(cf.lost)}.` : "the October GSTR-2B on 14 Nov will show the difference. Move to 14 Nov."}</span></div>` : ""}
  ${why("How these numbers map to the OKRs", `<p><b>Objective:</b> supplier-side mismatches get fixed within one filing cycle, without the GST team chasing by hand. <b>KR1</b> 70% of flagged supplier-side credit confirmed in the next GSTR-2B (the North Star above, as a share). <b>KR2</b> half of replies handled without a person, with 95% agreement in a weekly audit. <b>KR3</b> under 15 minutes of GST team time per supplier per cycle. <b>KR4</b> 6 of 10 beta customers agree to pay. <b>Guardrails:</b> no FY 2025-26 credit lost after 30 Nov, no message sent without approval in the beta, complaints and opt-outs under 1%. Input metrics: days from the reco job to the first message, replies within 7 days, promises kept. Targets are proposals for an 8-week beta; baselines come from shadow mode.</p>`)}
  <div class="g2">
    ${barChart("status", topG ? `Most of the flagged credit is “${topG.label}”` : "Where the flagged credit stands", "Flagged credit by status · removed duplicates excluded", groupRows, { label: "Status", count: "Invoices" })}
    ${barChart("owner", ownerRows[0] ? `${ownerRows[0].label} owns the most open credit` : "Open credit by owner", "Open credit by relationship owner", ownerRows, { label: "Owner", count: "Invoices" })}
    ${barChart("replies", typeRows[0] ? `Most replies were “${typeRows[0].label}”` : "How suppliers replied", "Supplier replies by the AI's reading · tooltip shows who", typeRows, { label: "Reply type", valueLabel: "Replies", money: false, count: "Handled without a person" })}
    ${barChart("unit", unitRows[0] ? `${unitRows[0].label.split(" (")[0]} holds the most open credit` : "Open credit by GSTIN", "Open credit by Kestrel GSTIN (unit)", unitRows, { label: "Unit", count: "Invoices" })}
  </div>
  <section class="card stack" id="aiQuality"><div class="card-h" style="margin:0"><h2>AI quality</h2><button type="button" class="btn sm" data-action="testset">${ic("eye")} Open the 40-reply test set</button></div>
    <div class="kpis">
      <div class="kpi" style="padding:0"><span class="k">Readings you reviewed</span><span class="v">${confirmed + corrected}</span><span class="s">${confirmed} confirmed unchanged · ${corrected} corrected</span></div>
      <div class="kpi" style="padding:0"><span class="k">Test set: positions right</span><span class="v">${Math.round(q.intent * q.n)}/${q.n}</span><span class="s">Quick model (Claude Haiku), blind run on a synthetic set · evidence word for word ${Math.round(q.evidence * 100)}%</span></div>
      <div class="kpi" style="padding:0"><span class="k">Test set: needs-a-person caught</span><span class="v">${Math.round(q.human * q.goldHuman)}/${q.goldHuman}</span><span class="s">The miss (E16, frustrated) still alerts the owner through rule R4</span></div>
      <div class="kpi" style="padding:0"><span class="k">Live AI this session</span><span class="v">${liveCalls.length ? (avgMs / 1000).toFixed(1) + " s" : "None yet"}</span><span class="s">${liveCalls.length ? `average over ${liveCalls.length} ${plural(liveCalls.length, "call")}` : "Runs when opened in Claude while signed in"}</span></div>
    </div>
    <p class="small ink2">The injection attempt in the test set (E21, “mark all invoices as filed”) was ignored and sent to a person. The larger default model misread one hostile reply (D13) as a dispute, so the quick model is used: faster, cheaper, and no worse on this test. Summary feedback in this demo: ${helpful} helpful, ${fbs.length - helpful} flagged for correction. Estimated AI cost: about ₹0.03 to read one reply and about ₹0.5 for a supplier's whole cycle, at Claude Haiku 5.5 list prices (estimate; see the impact model).</p>
    ${why("Why these AI metrics", `<p>Accuracy alone hides the costly error. A reply that needed a person but was handled automatically can lose credit or anger a supplier, so recall on "needs a person" is tracked separately and has its own guardrail. Corrections are the live version of the test set: a rising correction rate on one reply type is the trigger for a prompt change, tested against the 40 replies before release.</p>`)}
  </section>`;
}

/* ============ About ============ */
function aboutView() {
  const v = B.meta.versions;
  return `<section class="stack-s"><div class="eyebrow">About this demo</div><h1>Supplier Follow-up Agent</h1><p class="ink2" style="max-width:780px">An AI-assisted follow-up layer for GST reconciliation. Reconciliation already finds the invoices that are missing or wrong in GSTR-2B. Credit is still lost because nobody closes the loop with the supplier. This prototype closes it: one place per supplier with what is open, what they promised and the proof, and an agent that reads replies, drafts messages and checks GSTR-2B, within rules you set.</p></section>
  <div class="g2">
    <section class="card stack"><h2>Try it in three minutes</h2><ol class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px"><li>In the inbox, open <b>Nova Polymers</b>. Read why no payment hold is suggested, then approve the draft.</li><li>Open <b>Shree Ganesh Packaging</b>: click a citation number in the summary, ask a suggested question, and download the case file.</li><li>Use <b>Move to 12 Nov</b> and then <b>Move to 14 Nov</b> at the top. Compare what was recovered with what would have happened if you had done nothing.</li></ol><div class="row"><button type="button" class="btn primary sm" data-action="tour-start">${ic("play")} Or take the guided tour</button></div></section>
    <section class="card stack"><h2>What's real and what's simulated</h2><div class="tbl"><table><tbody>
      <tr><td><b>Real</b></td><td class="small">The AI readings, drafts, summaries and answers: recorded with Claude Haiku (replies up to 15 Oct in the blind test of ${fd(B.eval.run.date)}, everything else on ${fd(B.meta.recordedOn)}), or live in Claude. The code checks on every AI answer. The rules engine, history and case file.</td></tr>
      <tr><td><b>Simulated</b></td><td class="small">The company, suppliers, people, GSTINs and amounts (fictional). Sending messages. The GST portal, IMS and GSTR-2B. What suppliers do after 15 Oct, including the replies after that date.</td></tr>
      <tr><td><b>Not done yet</b></td><td class="small">Talking to real GST teams and suppliers. That is the first step of the rollout plan, before any build.</td></tr></tbody></table></div></section>
  </div>
  <section class="card stack"><h2>Five principles</h2><div class="g2 small">
    <div><b>1. Only GSTR-2B counts.</b> A promise or "already filed" is recorded, never counted as recovered.</div>
    <div><b>2. Protect what can't be undone first.</b> Last year's credit outranks bigger amounts that can still be claimed later.</div>
    <div><b>3. AI reads, code decides, people approve.</b> Rules choose every step; AI reads and writes; anything sent to a supplier is approved until it has earned automation.</div>
    <div><b>4. Never squeeze a small supplier.</b> No payment holds for micro and small enterprises, and none on invoices past the 180-day rule.</div>
    <div><b>5. Every AI sentence shows its evidence.</b> Quotes are checked word for word, citations point to the history, and stale AI text is replaced, not shown.</div></div></section>
  <section class="card stack"><h2>How AI is used</h2><div class="tbl"><table><thead><tr><th>Job</th><th>Prompt</th><th>Checked by code</th><th>If it fails</th></tr></thead><tbody>
    <tr><td>Read a supplier's reply</td><td class="nowrap">${esc(v.reader)}</td><td class="small">Quotes word for word; invoice numbers exist; dates valid; positions from a fixed list; injection text ignored</td><td class="small">Sent to a person (rule R3)</td></tr>
    <tr><td>Draft a message</td><td class="nowrap">${esc(v.drafter)}</td><td class="small">Invoices listed; amounts match records; no payment pressure; length</td><td class="small">Template; you edit before approval</td></tr>
    <tr><td>Summarise a supplier</td><td class="nowrap">${esc(v.summary)}</td><td class="small">Citations exist; amounts, dates and invoice numbers match the records</td><td class="small">Retry on a larger model, then facts-only</td></tr>
    <tr><td>Answer a question</td><td class="nowrap">${esc(v.qa)}</td><td class="small">Same as summaries; "not in the records" allowed</td><td class="small">Retry, then no answer shown</td></tr></tbody></table></div>
    <p class="small ink2">${esc(B.meta.method)} Live mode uses Claude's quick tier (the fastest model on your plan) and your own Claude account. What code can and cannot check: quotes, invoice numbers, amounts, dates and citations are checked against the records, but code cannot check the meaning of a sentence, so AI text stays labelled and every answer can be marked "Needs correction". With AI switched off, the screens hide AI text and use templates, while the demo's scripted timeline still follows the recorded readings.</p></section>
  <section class="card stack"><h2>Credits</h2><p class="small">Made by Rohit Kumar for a product assignment, using Claude to write and test the code and to run the AI features. Fictional data throughout; no user research has been done yet.</p>${LINKS.submission ? `<p class="small"><a href="${LINKS.submission}"${/^https?:/.test(LINKS.submission) ? ' target="_blank" rel="noopener"' : ""}>Read the submission</a>: the write-up, the walkthrough video and the downloads.${LINKS.deck ? ` <a href="${LINKS.deck}"${/^https?:/.test(LINKS.deck) ? ' target="_blank" rel="noopener"' : ""}>Slides</a>.` : ""}${LINKS.doc ? ` <a href="${LINKS.doc}"${/^https?:/.test(LINKS.doc) ? ' target="_blank" rel="noopener"' : ""}>Product document</a>.` : ""}${/^https?:/.test(LINKS.submission) ? "" : ` <a href="build-prompt.html">Build prompt</a>.`}${LINKS.repo ? ` <a href="${LINKS.repo}" target="_blank" rel="noopener">Code</a>.` : ""}</p><div class="row" style="flex-wrap:wrap;gap:10px"><span><button class="btn" type="button" onclick="SFA_dl('Supplier_Follow-up_Agent_Slides.pdf','Supplier Follow-up Agent slides.pdf',this)">Download slides (PDF)</button> <span class="xs muted" role="status"></span></span><span><button class="btn" type="button" onclick="SFA_dl('impact-model.xlsx','Supplier Follow-up Agent impact model.xlsx',this)">Download impact model (.xlsx)</button> <span class="xs muted" role="status"></span></span><span><button class="btn" type="button" onclick="SFA_dl('supplier-follow-up-agent-code.zip','supplier-follow-up-agent-code.zip',this)">Download code (.zip)</button> <span class="xs muted" role="status"></span></span></div>` : ""}</section>`;
}

/* ============ modals ============ */
function modalHTML() {
  const m = UI.modal; if (!m) return "";
  if (m.type === "jump") return jumpModal(m);
  if (m.type === "reset") return `<div class="overlay" data-action="modal-close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><h2 id="mh">Reset the demo?</h2><button type="button" class="btn ghost icon" data-action="modal-close" aria-label="Close">${ic("x")}</button></div><p>This clears your decisions, rule changes, feedback and the date, and starts again on 15 Oct. It only affects this browser.</p><div class="row"><button type="button" class="btn danger" data-action="reset">${ic("reset")} Reset everything</button><button type="button" class="btn ghost" data-action="modal-close">Cancel</button></div></div></div>`;
  if (m.type === "ai") return `<div class="overlay" data-action="modal-close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><h2 id="mh">How AI works in this demo</h2><button type="button" class="btn ghost icon" data-action="modal-close" aria-label="Close">${ic("x")}</button></div>
    <p><b>Status:</b> ${!S.settings.ai ? "AI is switched off in Company settings (manual mode)." : canLive() ? "Live AI is ready. Live calls use your own Claude account; the first one asks your permission." : esc(liveWhy())}</p>
    <p class="small ink2">Everything labelled “Recorded answer” was produced by Claude Haiku on ${fd(B.meta.recordedOn)} with the same prompt the live mode sends, and passed the same code checks. Anything labelled “live” was produced just now. Facts-only text is written by code, with no AI.</p>
    <div class="row">${S.settings.ai ? "" : `<a class="btn" href="#rules" data-action="modal-close">Turn AI on</a>`}<button type="button" class="btn ghost" data-action="modal-close">Close</button></div></div></div>`;
  if (m.type === "testset") return testsetModal();
  if (m.type === "case") return caseModal(m.sid);
  if (m.type === "bulk") return `<div class="overlay" data-action="modal-close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><h2 id="mh">Approve ${m.items.length} routine ${plural(m.items.length, "message")}?</h2><button type="button" class="btn ghost icon" data-action="modal-close" aria-label="Close">${ic("x")}</button></div>
    <ul class="small" style="margin:0;padding-left:18px">${m.items.map(it => `<li><b>${esc(SUP[it.sid].name)}</b>: ${esc(it.title)}</li>`).join("")}</ul><p class="small ink2">Each message is the AI draft shown on the supplier's page, and each passed the code checks. Nothing is actually sent in this demo.</p>
    <div class="row"><button type="button" class="btn primary" data-action="bulk-confirm">${ic("send")} Approve ${m.items.length}</button><button type="button" class="btn ghost" data-action="modal-close">Cancel</button></div></div></div>`;
  return "";
}
function jumpModal(m) {
  if (m.to === 1) {
    const all = Object.values(D.sup).flatMap(v => v.history.filter(h => h.date > T_DATES[0] && h.date <= T_DATES[1] && !h.undone && h.major));
    const c = k => all.filter(h => h.kind === k).length;
    const sentAuto = all.filter(h => h.kind === "message_out" && /Agent/.test(h.actor)).length;
    const broken = Object.values(D.sup).filter(v => v.inv.some(x => x.st === "broken"));
    return `<div class="overlay" data-action="modal-close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><div class="eyebrow">Simulated · 16 Oct to 12 Nov</div><h2 id="mh">What happened while you were away</h2></div><button type="button" class="btn ghost icon" data-action="modal-close" aria-label="Close">${ic("x")}</button></div>
      <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px"><li><b>${c("message_in")}</b> ${plural(c("message_in"), "supplier replied", "suppliers replied")}; the AI read each one (${all.filter(h => h.kind === "reading" && /Handled automatically/.test(h.text)).length} handled without you).</li><li><b>${sentAuto}</b> ${plural(sentAuto, "reminder or follow-up was", "reminders and follow-ups were")} sent by the agent under your rules.</li><li><b>${c("ims")}</b> ${plural(c("ims"), "upload", "uploads")} by suppliers appeared in IMS.</li><li><b>${broken.length}</b> broken ${plural(broken.length, "promise")}${broken.length ? ": " + esc(broken.map(v => v.s.name).join(", ")) : ""}.</li></ul>
      <p class="small ink2">These events follow from what you approved on 15 Oct. Suppliers you didn't act on behave as they would without a follow-up.</p>
      <div class="row"><button type="button" class="btn primary" data-action="modal-close">See the inbox</button></div></div></div>`;
  }
  const cf = D.counterfactual;
  return `<div class="overlay" data-action="modal-close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><div class="eyebrow">Simulated · 14 Nov 2026</div><h2 id="mh">The October GSTR-2B is in</h2></div><button type="button" class="btn ghost icon" data-action="modal-close" aria-label="Close">${ic("x")}</button></div>
    <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="card kpi good"><span class="k">Recovered this cycle</span><span class="v">${lakh(D.tot.recovered)}</span><span class="s">If you had done nothing: ${lakh(cf.recovered)}</span></div><div class="card kpi ${D.tot.lost ? "alert" : "good"}"><span class="k">Last year's credit lost</span><span class="v">${lakh(D.tot.lost)}</span><span class="s">If you had done nothing: ${lakh(cf.lost)}</span></div></div>
    <p class="small ink2">Anything a supplier filed by 11 Nov is in this GSTR-2B. FY 2025-26 invoices that missed it can't be claimed after 30 Nov 2026.</p>
    <div class="row"><button type="button" class="btn primary" data-action="modal-close">See the inbox</button><button type="button" class="btn" data-action="nav-dash">Open the dashboard</button></div></div></div>`;
}
function testsetModal() {
  const rows = B.eval.items.map(it => { const g = M.guard(it.quick, it.reply, it.refs, it.date); const ok = g.intent === it.gold.intent; const hok = g._human === it.gold.human; return `<tr><td class="mono">${it.id}</td><td class="small" style="max-width:340px">${esc(it.reply.length > 140 ? it.reply.slice(0, 138) + "…" : it.reply)}</td><td class="small">${esc(INTENT_TEXT[it.gold.intent])}${it.gold.human ? " · person" : ""}</td><td class="small">${esc(INTENT_TEXT[g.intent])}${g._human ? " · person" : ""}</td><td>${ok && hok ? `<span class="badge green">${ic("check")} Match</span>` : `<span class="badge amber">${ok ? "Missed: needs a person" : "Different"}</span>`}</td></tr>`; }).join("");
  return `<div class="overlay" data-action="modal-close-bg"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><div class="eyebrow">Blind run · ${fd(B.eval.run.date)}</div><h2 id="mh">The 40-reply test set</h2></div><button type="button" class="btn ghost icon" data-action="modal-close" aria-label="Close">${ic("x")}</button></div>
    <p class="small ink2">${esc(B.eval.run.method)} 13 replies come from this demo's suppliers; 27 are standalone cases chosen to be hard: Gujarati, Marathi and Hindi, vague promises, partial answers, a cancelled invoice, an injection attempt and angry replies. The replies and their labels were written with Claude before the run, not by tax experts, so this shows the prompt is consistent; accuracy on real replies needs expert-labelled real data.</p>
    <div class="tbl"><table><thead><tr><th>ID</th><th>Reply</th><th>Expected</th><th>Quick model read</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
}

/* ============ case file (PDF) ============ */
function caseSummary(v) {
  const sig = M.signature(v, D, S); const key = v.id + "|" + sig; const rec = B.summaries[key]; const live = S.live["sum|" + key];
  if (S.settings.ai && (live || rec)) { const o = (live || rec).output || live.out; const keys = (live || rec).keys; return { text: [o.summary, ...(o.points || [])].join(" "), keys, label: live ? "Written by AI (live) · checked against the records" : `Written by AI (recorded, ${B.meta.model}) · checked against the records` }; }
  const o = M.factsOnly(v, D); return { text: [o.summary, ...o.points].join(" "), keys: M.citeKeys(v), label: "Facts only · written by code" };
}
function plainCites(text, keys, v) { return esc(text).replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (m, grp) => "(" + grp.split(",").map(x => { const h = v.history.find(e => e.key === keys[+x.trim() - 1]); return h ? "entry " + h.n : ""; }).filter(Boolean).join(", ") + ")"); }
function casePages(sid) {
  const v = D.sup[sid]; const s = v.s; const u = W.units[s.unit]; const cs = caseSummary(v);
  const head = `<div class="row between" style="align-items:flex-start;border-bottom:2px solid #142338;padding-bottom:12px"><div><div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#52649a">Case file · record of follow-up</div><h1>${esc(s.name)}</h1><div style="font-size:11.5px;color:#42506b">GSTIN ${esc(s.gstin)} · ${esc(s.city)}${s.udyam ? " · " + esc(s.udyam) + " enterprise" : ""}<br>Contact: ${esc(v.contact.name)}, on ${esc(v.channel)}</div></div><div style="text-align:right;font-size:11.5px;color:#42506b"><b style="color:#172b43">Prepared ${fd(clockNow())}</b><br>for Kestrel Auto Components Pvt Ltd<br>${esc(u.name)} unit · GSTIN ${esc(u.gstin)}<br>Owner: ${esc(s.owner)}</div></div>`;
  const status = `<div style="display:flex;flex-wrap:wrap;gap:6px 22px;padding:9px 12px;border-radius:6px;background:#f4f6fa;font-size:12px"><span><b>Status:</b> ${esc(v.label)}</span><span><b>Credit open:</b> ${inr(v.open)}</span>${v.recovered ? `<span><b>Recovered:</b> ${inr(v.recovered)}</span>` : ""}${v.lost ? `<span><b>Lost:</b> ${inr(v.lost)}</span>` : ""}${v.promised ? `<span><b>Promised by:</b> ${fd(v.promised)}</span>` : ""}</div>`;
  const inv = `<div><h2>Invoices</h2><table><thead><tr><th>Invoice</th><th>Date</th><th class="r">GST</th><th class="r">Credit stuck</th><th>Problem</th><th>Status</th></tr></thead><tbody>${v.inv.map(x => { const I = INV[x.ref]; return `<tr><td><b>${esc(x.ref)}</b></td><td>${fd(I.date)}</td><td class="r">${inr(I.gst)}</td><td class="r">${inr(I.stuck)}</td><td>${esc(cap(M.issueText(I)))}</td><td>${esc(ST[x.st].label)}${x.st === "promised" && x.date ? " " + fd(x.date, false) : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
  const sum = `<div><div class="row" style="gap:10px"><h2>Summary</h2><span style="font-size:10.5px;font-weight:650;color:#3e47b5">${esc(cs.label)}</span></div><p style="margin-top:5px">${plainCites(cs.text, cs.keys, v)}</p></div>`;
  const hist = v.history.map(h => `<tr><td>${h.n}</td><td style="white-space:nowrap">${fd(h.date)}</td><td>${esc(h.text)}${h.undone ? " (undone)" : ""}${h.date > T_DATES[0] ? " <i>(simulated)</i>" : ""}</td><td>${esc(h.actor)}</td></tr>`);
  const msgs = v.history.filter(h => (h.kind === "message_in" || h.kind === "message_out") && !h.undone).map(h => { let body = ""; if (h.kind === "message_in") body = REPLY[h.msg].text; else { const d = approvedText(h.msg); body = (d.subject ? d.subject + "\n\n" : "") + d.body; } return `<div><div style="font-size:11px;color:#42506b;margin-bottom:3px"><b>Entry ${h.n} · ${fd(h.date)}</b> · ${esc(h.kind === "message_in" ? "From " + h.actor : "To " + v.contact.name + " · " + h.actor)}</div><div class="msgp">${esc(body)}</div></div>`; });
  const pages = [];
  const foot = (i, n) => `<div class="foot"><span>Made from the append-only activity log. AI-written text is marked. Events after 15 Oct 2026 are simulated. A record of follow-up, not a legal document. Fictional data.</span><span style="white-space:nowrap">Page ${i} of ${n}</span></div>`;
  pages.push([head, status, sum, inv, `<div><h2>History</h2><table><thead><tr><th>#</th><th>Date</th><th>What happened</th><th>By</th></tr></thead><tbody>${hist.slice(0, 9).join("")}</tbody></table></div>`]);
  for (let i = 9; i < hist.length; i += 17) pages.push([`<h2>History (continued)</h2><table><thead><tr><th>#</th><th>Date</th><th>What happened</th><th>By</th></tr></thead><tbody>${hist.slice(i, i + 17).join("")}</tbody></table>`]);
  for (let i = 0; i < msgs.length; i += 3) pages.push([`<h2>Messages${i ? " (continued)" : ""}</h2>`, ...msgs.slice(i, i + 3)]);
  return pages.map((p, i) => `<div class="a4">${p.join("")}${foot(i + 1, pages.length)}</div>`);
}
function caseModal(sid) {
  const pages = casePages(sid);
  return `<div class="overlay" data-action="modal-close-bg"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><div class="eyebrow">Case file · ${pages.length} ${plural(pages.length, "page")}</div><h2 id="mh">${esc(SUP[sid].name)}</h2></div><button type="button" class="btn ghost icon" data-action="modal-close" aria-label="Close">${ic("x")}</button></div>
    <p class="small ink2">For an auditor, the supplier's account manager or your own records: the summary, every invoice, the full history and every message, made from the append-only log.</p>
    <div class="row"><button type="button" class="btn primary" data-action="pdf" data-sid="${sid}" ${UI.busy.pdf ? "disabled" : ""}>${ic("download")} ${UI.busy.pdf ? "Making the PDF…" : "Download PDF"}</button><span class="small muted" id="pdfNote">${esc(UI.pdfNote || "")}</span></div>
    <div class="pages" id="casePages"><div class="scale" id="caseScale">${pages.join('<div style="height:16px"></div>')}</div></div></div></div>`;
}
function loadScript(src) { return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.appendChild(s); }); }
async function makePdf(sid) {
  UI.busy.pdf = true; UI.pdfNote = ""; renderModal();
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const holder = document.createElement("div"); holder.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;";
    holder.innerHTML = casePages(sid).join(""); document.body.appendChild(holder);
    const pdf = new window.jspdf.jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pages = [...holder.querySelectorAll(".a4")];
    for (let i = 0; i < pages.length; i++) {
      const c = await window.html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", logging: false, width: 794, windowWidth: 794 });
      if (i) pdf.addPage();
      const ratio = c.height / c.width; const w = 595.28; const h = Math.min(841.89, w * ratio);
      pdf.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, w, h);
    }
    holder.remove();
    const blob = pdf.output("blob"); const name = `Case file - ${SUP[sid].name} - ${clockNow()}.pdf`;
    let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
    if (dl) { try { await dl.save({ filename: name, data: blob }); UI.pdfNote = "Saved."; } catch (e) { UI.pdfNote = e && e.code === "declined" ? "Download cancelled." : "The download isn't available in this view."; } }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); UI.pdfNote = "Downloaded."; }
  } catch (e) { UI.pdfNote = "Couldn't make the PDF here (" + (e.message || "error") + "). The preview below is the full case file."; }
  UI.busy.pdf = false; renderModal();
}
function renderModal() { const root = $("#modalRoot"); if (root) { root.innerHTML = modalHTML(); fitCase(); } }
function fitCase() { const sc = $("#caseScale"), box = $("#casePages"); if (!sc || !box) return; const w = box.clientWidth - 32; const k = Math.min(1, w / 794); sc.style.transform = `scale(${k})`; sc.style.height = (sc.scrollHeight * k) + "px"; sc.style.width = "794px"; }

/* ============ guided tour ============ */
const TOUR = [
  { route: "inbox", el: "#inboxTitle", title: "Abhishek's morning", text: "Abhishek is GST lead at Kestrel. Yesterday's reco job left 16 suppliers to chase. The inbox ranks them by what would be lost first, not by who shouted loudest." },
  { route: "inbox", el: "#row-S04", alt: ".mcard", title: "Start with the riskiest supplier", text: "Nova Polymers holds ₹4 L of last year's credit. If it isn't in GSTR-2B by 14 Nov, it can't be claimed after 30 Nov. Next opens Nova." },
  { route: "supplier-S04", el: "#nextCard", title: "AI reads, code decides, you approve", text: "Nova replied 'pay us first'. The AI read that; code then checked the payment rules. Two invoices are past 180 days, so holding money would block Kestrel's own credit. The draft confirms the payment date instead." },
  { route: "supplier-S04", el: "#sumCard", title: "Every sentence shows its source", text: "The summary cites the history. Click a number to jump to the entry. Code checks every amount, date and invoice number before it is shown." },
  { route: "supplier-S04", el: "#askCard", title: "Ask about one supplier", text: "Try 'Should we hold Nova's 28 Oct payment until they file?'. Answers come only from this supplier's records, with citations." },
  { route: "supplier-S04", el: ".clock", title: "See what your decisions are worth", text: "Approve the draft, then move the clock to 12 Nov and 14 Nov. The dashboard compares the result with doing nothing." },
];
function tourHTML() {
  if (UI.tour == null) return "";
  const st = TOUR[UI.tour];
  return `<div class="tour-ring" id="tourRing"></div><div class="tour" id="tourBox" role="dialog" aria-labelledby="tourT"><div class="row between"><span class="eyebrow">Tour · ${UI.tour + 1} of ${TOUR.length}</span><button type="button" class="btn ghost icon sm" data-action="tour-end" aria-label="End the tour">${ic("x")}</button></div><h3 id="tourT">${esc(st.title)}</h3><p class="small">${esc(st.text)}</p><div class="row between"><button type="button" class="btn ghost sm" data-action="tour-prev" ${UI.tour ? "" : "disabled"}>Back</button><button type="button" class="btn primary sm" data-action="tour-next">${UI.tour === TOUR.length - 1 ? "Finish" : "Next"}</button></div></div>`;
}
function placeTour() {
  const root = $("#tourRoot"); if (!root) return;
  root.innerHTML = tourHTML(); if (UI.tour == null) return;
  const st = TOUR[UI.tour]; let el = $(st.el); if ((!el || !el.offsetParent) && st.alt) el = $(st.alt);
  const ring = $("#tourRing"), box = $("#tourBox");
  if (!el || !el.offsetParent) { ring.style.display = "none"; box.style.left = "50%"; box.style.top = "30%"; box.style.transform = "translateX(-50%)"; return; }
  el.scrollIntoView({ block: "center", behavior: "instant" in window ? "instant" : "auto" });
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect(); const pad = 6;
    Object.assign(ring.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: Math.min(r.height, window.innerHeight - 20) + pad * 2 + "px" });
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let top = r.bottom + 14; if (top + bh > window.innerHeight - 10) top = Math.max(10, r.top - bh - 14);
    let left = Math.min(Math.max(10, r.left), window.innerWidth - bw - 10);
    Object.assign(box.style, { left: left + "px", top: top + "px", transform: "none" });
  });
}

/* Downloads of the submission files that sit next to this page (used on the About page). */
window.SFA_dl = async function (key, name, btn) {
  const note = btn.nextElementSibling; if (note) note.textContent = "Preparing the file…";
  try {
    let data;
    if (/\.(pdf|mp4)$/.test(key)) { const r = await fetch(key); if (!r.ok) throw { code: "missing" }; data = await r.blob(); }
    else {
      if (!window.SFA_FILES) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "files.js"; s.onload = res; s.onerror = () => rej({ code: "missing" }); document.head.appendChild(s); });
      const bin = atob(window.SFA_FILES[key]); data = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) data[k] = bin.charCodeAt(k);
    }
    let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
    if (dl) { await dl.save({ filename: name, data: data }); if (note) note.textContent = "Saved."; }
    else { const b = data instanceof Blob ? data : new Blob([data]); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); if (note) note.textContent = "Download started."; }
  } catch (e) { if (note) note.textContent = e && e.code === "declined" ? "Download cancelled." : "This view can't save files; the files are also on the submission page."; }
};
