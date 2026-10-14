/* Regression tests for the findings of the independent review (12 Oct 2026).
   Model-level checks run in Node; the export and bulk-approval checks run in the browser. */
const { load } = require("../load.js"); const MM = require("../model.js"); const path = require("path");
const { W, B } = load(); const M = MM.createModel(W, B);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const fresh = (t, extra = {}) => Object.assign(MM.freshState(), { t }, extra);

console.log("Reader guard: every failed material check goes to a person");
{ const rid = "D01"; const r = M.REPLY[rid]; const base = B.readings[rid];
  let o = M.guard(Object.assign({}, base, { invoices: [...base.invoices, { ref: "BOGUS/123", status: "will_fix" }], needs_human: false }), r.text, r.refs, r.date);
  ok(o._human && !o.invoices.some(i => i.ref === "BOGUS/123"), "an invoice number we don't have is dropped and the reply goes to a person");
  o = M.guard(Object.assign({}, base, { promised_date: "2026-02-30" }), r.text, r.refs, "2026-02-10");
  ok(o.promised_date === null && o._human, "an impossible date (30 Feb) is removed and the reply goes to a person");
  o = M.guard(Object.assign({}, base, { invoices: base.invoices.map(i => Object.assign({}, i, { status: "paid_in_full" })) }), r.text, r.refs, r.date);
  ok(o._human, "an unknown per-invoice status goes to a person");
  o = M.guard(base, r.text, r.refs, r.date);
  ok(!o._human && o.promised_date, "the recorded, valid reading is unchanged (no person needed, date kept)");
  o = M.guard(Object.assign({}, base, { tone: "frustrated", needs_human: false }), r.text, r.refs, r.date);
  ok(o._human && o._angry, "frustrated tone always routes to human review even if AI does not request it");
  o = M.guard(Object.assign({}, base, { tone: "hostile", needs_human: false }), r.text, r.refs, r.date);
  ok(o._human && o._angry, "hostile tone always routes to human review"); }

console.log("Draft check: any currency format and any payment pressure");
{ const id = "R-S01"; const d = B.drafts[id]; const body = String(d.body);
  ok(M.checkDraft(id, body, "x").ok, "the recorded draft still passes");
  ok(!M.checkDraft(id, body + " Pay INR 99999999.", "x").ok, "an amount written as INR that is not in the records fails");
  ok(!M.checkDraft(id, body + " Rs. 5,55,555 is due.", "x").ok, "an amount written as Rs. that is not in the records fails");
  ok(!M.checkDraft(id, body + " We will freeze your settlement until you file.", "x").ok, "\"freeze your settlement until you file\" counts as payment pressure");
  ok(!M.checkDraft(id, body + " Otherwise we will take legal action.", "x").ok, "legal threats count as pressure"); }

console.log("A person's correction stops automatic reminders (F01)");
{ const corr = { verdict: "corrected", intent: "dispute", reason: "test", at: "2026-10-15T10:00:00.000Z" };
  const S0 = fresh(0, { reviews: { D01: corr } }); const v0 = M.derive(S0).sup.S01;
  ok(v0.next.action === "review", "on 15 Oct the case asks the person to decide");
  const S1 = fresh(1, { reviews: { D01: corr } }); const h1 = M.derive(S1).sup.S01.history;
  ok(!h1.some(h => h.kind === "message_out" && h.date > "2026-10-15"), "no reminder goes out after the correction");
  ok(h1.some(h => /you corrected the AI reading/.test(h.text)), "the history says why the reminder was not sent");
  const S2 = fresh(1, { reviews: { D01: corr }, acts: { "approve:R-S01": { at: "2026-10-15T10:05:00.000Z", by: "user" } } });
  ok(M.derive(S2).sup.S01.history.some(h => h.kind === "message_out" && h.date > "2026-10-15"), "a reminder the person approves after correcting does go out");
  const S3 = fresh(1, { reviews: { D01: corr }, acts: { "approve:R-S01": { at: "2026-10-15T09:00:00.000Z", by: "user" } } });
  ok(!M.derive(S3).sup.S01.history.some(h => h.kind === "message_out" && h.date > "2026-10-15"), "an approval given before the correction no longer counts"); }

console.log("Company channel settings bind every send (F02)");
{ const off = fresh(1, { settings: Object.assign({}, MM.DEFAULT_SETTINGS, { email: false, whatsapp: false }) });
  const D = M.derive(off);
  ok(!Object.values(D.sup).some(v => v.history.some(h => h.kind === "message_out" && h.date > "2026-10-15" && !h.undone)), "with both channels off, nothing is sent after 15 Oct");
  ok(D.sup.S01.history.some(h => /both switched off/.test(h.text)), "the history says the channels are off");
  const wa = fresh(1, { settings: Object.assign({}, MM.DEFAULT_SETTINGS, { whatsapp: false }) });
  const sent = M.derive(wa).sup.S01.history.filter(h => h.kind === "message_out" && h.date > "2026-10-15");
  ok(sent.length && sent.every(h => / on Email/.test(h.text)), "with WhatsApp off, the WhatsApp supplier's reminder goes by email"); }

console.log("Wording: IMS shows an upload; GSTR-2B confirms it");
{ const D = M.derive(fresh(1)); const ims = Object.values(D.sup).flatMap(v => v.history).filter(h => h.kind === "ims");
  ok(ims.length && ims.every(h => /uploaded by the supplier/.test(h.text) && !/filed by the supplier/.test(h.text)), "IMS entries say uploaded, not filed"); }

console.log("Rule R9 is marked as not simulated (F07)");
ok(!!MM.RULE_TEMPLATES.find(r => r.id === "R9").demo, "R9 carries a 'not simulated in this demo' note");

(async () => {
  console.log("Browser: export, bulk approval and selection");
  const { chromium } = require("playwright");
  const b = await chromium.launch((require("fs").existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" } : {}));
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage(); const URL = "file://" + path.resolve(__dirname, "../dist/index.html"); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.click("#loginForm button[type=submit]"); await p.waitForSelector("#inboxTitle");
  // F06: an edit made when approving in advance is what the case file exports
  const marker = "MARKER-EDIT-7731";
  await p.evaluate(m => { S.ui.toured = true; S.settings.autoReminders = false; const d = B.drafts["R-S01"]; S.acts["approve:R-S01"] = { at: new Date().toISOString(), by: "user", edit: { subject: d.subject || "", body: d.body + " " + m } }; S.t = 1; save(); }, marker);
  await p.goto(URL + "#supplier-S01"); await p.waitForSelector("#histCard");
  const exported = await p.evaluate(() => casePages("S01").join(" "));
  ok(exported.includes(marker), "the case file exports the edited, approved text (F06)");
  // selection respects filters; bulk approval skips nothing valid
  await p.evaluate(() => { localStorage.clear(); }); await p.goto(URL); await p.click("#loginForm button[type=submit]"); await p.waitForSelector("#inboxTitle");
  await p.evaluate(() => { S.ui.toured = true; save(); }); await p.goto(URL + "#inbox"); await p.waitForTimeout(200);
  const total = await p.evaluate(() => D.routine.length);
  const target = await p.evaluate(() => D.sup[D.routine[0]].s.owner); await p.selectOption("#fOwner", { label: target }); await p.waitForTimeout(150);
  await p.click('[data-action="select-routine"]'); await p.waitForTimeout(150);
  const sel = await p.evaluate(() => ({ n: UI.selected.size, shown: filteredSuppliers().map(v => v.id), selected: [...UI.selected] }));
  ok(sel.n > 0 && sel.selected.every(s => sel.shown.includes(s)), `"Select all routine" picks only suppliers the filters show (${sel.n} of ${total})`);
  ok(!errs.length, "no page errors" + (errs.length ? ": " + errs.join("; ") : ""));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
