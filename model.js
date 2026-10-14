/* Supplier Follow-up Agent v2: the case model.
   One file shared by the app (browser) and the generator scripts (Node), so recorded AI answers
   are generated from exactly the facts the app shows.
   Pure functions of: world data (W), recorded AI outputs (B) and the demo state (S). */
(function (root) {
  "use strict";

  /* ---------- formatting ---------- */
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function fd(iso, withYear = true) { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return d + " " + MON[m - 1] + (withYear ? " " + y : ""); }
  function days(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }
  function addDays(iso, n) { const d = new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000); return d.toISOString().slice(0, 10); }
  function wday(iso) { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(iso + "T00:00:00Z").getUTCDay()]; }
  function inr(n) {
    n = Math.round(n); const neg = n < 0; let s = String(Math.abs(n));
    if (s.length > 3) { let head = s.slice(0, -3); const tail = s.slice(-3); const parts = []; while (head.length > 2) { parts.unshift(head.slice(-2)); head = head.slice(0, -2); } if (head) parts.unshift(head); s = parts.join(",") + "," + tail; }
    return (neg ? "-" : "") + "₹" + s;
  }
  function lakh(n) {
    if (Math.abs(n) >= 100000) { const v = Math.abs(n) >= 1000000 ? (Math.round(n / 10000) / 10).toFixed(1) : (Math.round(n / 1000) / 100).toFixed(2); return "₹" + v.replace(/\.?0+$/, "") + " L"; }
    return inr(n);
  }
  const plural = (n, a, b) => n === 1 ? a : (b || a + "s");
  const listAnd = xs => xs.length <= 1 ? (xs[0] || "") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
  function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h.toString(36); }
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();

  /* ---------- fixed vocabulary ---------- */
  const T_DATES = ["2026-10-15", "2026-11-12", "2026-11-14"];
  const T_LABEL = ["15 Oct 2026", "12 Nov 2026", "14 Nov 2026"];
  const ST = {
    review: { label: "Needs you", group: "needs", rank: 0, tone: "amber" },
    broken: { label: "Promise broken", group: "needs", rank: 1, tone: "red" },
    new: { label: "Not contacted", group: "needs", rank: 2, tone: "grey" },
    internal: { label: "Fix in our books", group: "needs", rank: 3, tone: "blue" },
    lost: { label: "Credit lost", group: "lost", rank: 4, tone: "red" },
    missing: { label: "Still missing", group: "lost", rank: 5, tone: "red" },
    awaiting: { label: "Waiting for supplier", group: "waiting", rank: 6, tone: "grey" },
    promised: { label: "Promised", group: "promised", rank: 7, tone: "blue" },
    ims: { label: "Seen in IMS", group: "ims", rank: 8, tone: "indigo" },
    recovered: { label: "Fixed", group: "fixed", rank: 9, tone: "green" },
    removed: { label: "Removed (duplicate)", group: "fixed", rank: 10, tone: "grey" },
  };
  const GROUPS = [
    { id: "needs", label: "Needs you" }, { id: "promised", label: "Promised" }, { id: "waiting", label: "Waiting" },
    { id: "ims", label: "Seen in IMS" }, { id: "fixed", label: "Fixed" }, { id: "lost", label: "Lost or missing" },
  ];
  const INTENTS = ["will_fix", "claims_fixed", "dispute", "needs_info", "conditional", "wrong_contact", "auto_reply", "unclear", "not_related", "mixed"];
  const HUMAN_INTENTS = ["dispute", "conditional", "needs_info", "wrong_contact", "unclear"];
  const INTENT_TEXT = { will_fix: "Will fix", claims_fixed: "Says already fixed", dispute: "Disputes our record", needs_info: "Needs information", conditional: "Conditional", wrong_contact: "Wrong contact", auto_reply: "Auto-reply", unclear: "Unclear", not_related: "Not related", mixed: "Mixed" };
  const STEP_TEXT = { verify_in_next_2b: "Verify in the next GSTR-2B", remind_on_date: "Remind on the promised date", ask_for_date: "Ask for a specific date", send_documents: "Send the documents asked for", update_contact: "Update the contact", follow_up_after_date: "Follow up after a date", escalate_to_owner: "Escalate to the relationship owner", review_dispute: "Review the dispute", no_action: "No action" };
  const PROMPT_VERSIONS = { reader: "reader v1", drafter: "drafter v2", summary: "summary v1", qa: "qa v1" };

  /* ---------- rules ---------- */
  const RULES_META = [
    { id: "R1", name: "Clear date promised", when: "The supplier gives a clear date that is more than a week away", then: "Send one reminder {n} days before that date", param: { key: "n", unit: "days before", min: 1, max: 7 }, kind: "auto" },
    { id: "R2", name: "Out-of-office reply", when: "An automatic out-of-office reply gives a return date", then: "Follow up {n} day(s) after they are back", param: { key: "n", unit: "days after", min: 1, max: 5 }, kind: "auto" },
    { id: "R3", name: "Reply needs judgement", when: "A dispute, a condition, a request for documents, an unclear reply, a wrong contact, a partial answer, a hostile tone or low AI confidence", then: "Send it to you. Never reply automatically", locked: true, kind: "safety" },
    { id: "R4", name: "Angry or frustrated tone", when: "The AI reads the tone as frustrated or hostile", then: "Alert the relationship owner and slow reminders to every {n} days", param: { key: "n", unit: "days", min: 7, max: 30 }, kind: "people" },
    { id: "R5", name: "Promise broken", when: "The promised fix is not in IMS after the GSTR-1 due date it was promised for", then: "Mark it broken, alert the owner and draft a firmer message for your approval", kind: "people" },
    { id: "R6", name: "Supplier wants payment first", when: "The supplier will fix only after a payment", then: "Suggest holding only the GST part of the next payment. Never for micro or small enterprises, never for invoices older than {n} days", param: { key: "n", unit: "days", min: 30, max: 170 }, needs: "holds", kind: "money" },
    { id: "R7", name: "Supplier says it's fixed", when: "The supplier says an invoice is already filed or corrected", then: "Keep it open until it appears in GSTR-2B", locked: true, kind: "safety" },
    { id: "R8", name: "Last year's credit", when: "The invoice is from FY 2025-26", then: "Flag the 30 Nov 2026 claim deadline and put it first", kind: "priority" },
  ];
  const RULE_TEMPLATES = [
    { id: "R9", name: "No reply", when: "No reply {n} days after our message", then: "Send a reminder", param: { key: "n", unit: "days", min: 3, max: 21, def: 7 }, kind: "auto", demo: "Not simulated in this demo: every demo supplier has already replied, so this rule never fires here." },
    { id: "R10", name: "Large amount", when: "Credit stuck with the supplier is above {x}", then: "Every message to them needs your approval", param: { key: "x", unit: "rupees", min: 10000, max: 1000000, def: 200000, money: true }, kind: "money" },
  ];
  const DEFAULT_RULES = { R1: { on: true, n: 2 }, R2: { on: true, n: 1 }, R3: { on: true }, R4: { on: true, n: 14 }, R5: { on: true }, R6: { on: true, n: 150 }, R7: { on: true }, R8: { on: true } };
  const DEFAULT_SETTINGS = { ai: true, autoReminders: true, email: true, whatsapp: true, holds: false };

  function freshState() {
    return { v: 2, t: 0, acts: {}, reviews: {}, feedback: {}, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), rules: JSON.parse(JSON.stringify(DEFAULT_RULES)), ruleLog: [], live: {}, log: [], renewed: null, ui: {} };
  }

  /* ---------- the model ---------- */
  function createModel(W, B) {
    const SUP = {}; W.suppliers.forEach(s => { SUP[s.id] = s; });
    const INV = {}; W.invoices.forEach(x => { INV[x.ref] = x; });
    const REPLY = {}; W.replies.forEach(r => { REPLY[r.id] = r; }); W.post.forEach(r => { REPLY[r.id] = r; });
    const UNITS = W.units;
    const refsOf = sid => W.invoices.filter(x => x.sid === sid).map(x => x.ref);
    const udyamProtected = s => s.udyam === "Micro" || s.udyam === "Small";
    const DRAFT = id => B.drafts[id];
    const DECISION = {
      S02: { id: "X-S02", title: "Ask Patel Steel to correct the recipient GSTIN", type: "send" },
      S03: { id: "X-S03", title: "Send the PO and GRN to Bharat Fasteners", type: "send" },
      S04: { id: "X-S04", title: "Confirm the 28 Oct payment and ask Nova for the October GSTR-1", type: "send" },
      S06: { id: "book", title: "Correct our entry: MC-412 is MC/26-27/0412", type: "book" },
      S09: { id: "X-S09", title: "Update the contact and write to GreenLeaf's finance team", type: "send" },
      S10: { id: "X-S10", title: "Ask Rathi Alloys for a specific date", type: "send" },
      S11: { id: "dup", title: "Remove the duplicate ST/2231-B from our books", type: "dup" },
      S12: { id: "X-S12", title: "Ask Vega Chemicals about the January invoice VC/0512", type: "send" },
      S13: { id: "X-S13", title: "Reply to Jyoti Industrial Gases with the evidence", type: "send" },
      S15: { id: "N-S15", title: "Send the first message to Delta Engineering Works", type: "send", routine: true },
      S16: { id: "N-S16", title: "Send the first message to Orbit Office Supplies", type: "send", routine: true },
    };
    const actKey = sid => { const d = DECISION[sid]; if (!d) return null; return d.type === "send" ? "send:" + d.id : d.type + ":" + sid; };

    /* reading guard: the same checks as the offline test */
    function guard(out, reply, refs, replyDate) {
      const o = Object.assign({}, out || {}); const checks = [];
      if (!INTENTS.includes(o.intent)) { checks.push({ ok: false, t: "Unknown position; treated as unclear" }); o.intent = "unclear"; }
      if (!["cooperative", "neutral", "frustrated", "hostile"].includes(o.tone)) { checks.push({ ok: false, t: "Unknown tone; treated as neutral" }); o.tone = "neutral"; }
      if (!["high", "medium", "low"].includes(o.confidence)) { checks.push({ ok: false, t: "Unknown confidence; treated as low" }); o.confidence = "low"; }
      if (!Object.keys(STEP_TEXT).includes(o.next_step)) { checks.push({ ok: false, t: "Unknown next step; a person decides" }); o.next_step = "escalate_to_owner"; }
      const r = norm(reply); const ev = (o.evidence || []).filter(e => typeof e === "string" && norm(e));
      const evOk = ev.length > 0 && ev.every(e => r.includes(norm(e)));
      checks.push(evOk ? { ok: true, t: "Every quote appears word for word in the message" } : { ok: false, t: "A quote was not found in the message, so a person decides" });
      const good = [], bad = [], badSt = [];
      for (const i of (o.invoices || [])) { const ref = i && i.ref; if (refs.includes(ref)) { if (i.status && !INTENTS.includes(i.status)) badSt.push(ref); good.push(i); } else if (ref) bad.push(ref); }
      o.invoices = good;
      checks.push(bad.length ? { ok: false, t: "Invoice numbers not in our records were ignored (" + bad.join(", ") + "), so a person decides" } : { ok: true, t: "Every invoice number exists in our records" });
      if (badSt.length) checks.push({ ok: false, t: "Unknown status for " + badSt.join(", ") + ", so a person decides" });
      let dateBad = false;
      if (o.promised_date) {
        const pd = String(o.promised_date);
        const real = /^\d{4}-\d{2}-\d{2}$/.test(pd) && !isNaN(Date.parse(pd + "T00:00:00Z")) && new Date(pd + "T00:00:00Z").toISOString().slice(0, 10) === pd; // 30 Feb fails here
        const okd = real && days(replyDate, pd) >= 0 && days(replyDate, pd) <= 120;
        checks.push(okd ? { ok: true, t: "The promised date is a real date after the message" } : { ok: false, t: "The promised date was not a real date after the message, so it was removed and a person decides" });
        if (!okd) { o.promised_date = null; dateBad = true; }
      }
      if (o.intent === "claims_fixed") checks.push({ ok: true, t: "A claim is never counted as fixed; GSTR-2B decides (rule R7)" });
      const st = (o.invoices || []).map(i => i.status);
      const rule = HUMAN_INTENTS.includes(o.intent) || st.some(s => HUMAN_INTENTS.includes(s)) || (o.tone === "hostile" || o.tone === "frustrated") ||
        (o.risk_flags || []).some(f => /^(financial_distress|partial_coverage|unknown_invoice)/.test(f)) || o.confidence === "low" || !evOk ||
        bad.length > 0 || badSt.length > 0 || dateBad; // any failed material check sends the reply to a person
      o._human = !!o.needs_human || rule; o._checks = checks; o._evOk = evOk;
      o._angry = o.tone === "frustrated" || o.tone === "hostile";
      return o;
    }
    function reading(id, override) {
      const r = REPLY[id]; if (!r) return null;
      const out = override || B.readings[id]; if (!out) return null;
      return guard(out, r.text, r.refs, r.date);
    }

    /* ---------- derive the whole world for a state ---------- */
    function derive(S, opt = {}) {
      const t = S.t || 0, today = T_DATES[t];
      const rules = S.rules || DEFAULT_RULES, settings = S.settings || DEFAULT_SETTINGS;
      const R = id => { const m = RULES_META.find(x => x.id === id) || RULE_TEMPLATES.find(x => x.id === id); const r = rules[id]; if (!r || !r.on) return false; if (m && m.needs && !settings[m.needs]) return false; return true; };
      const N = (id, key = "n") => (rules[id] || {})[key];
      const act = k => { const a = (S.acts || {})[k]; return a && !a.undone ? a : null; };
      const sentT0 = id => !!act("send:" + id);
      const out = { t, today, sup: {}, inv: {}, decisions: [], routine: [], updates: [] };

      for (const s of W.suppliers) {
        const sid = s.id, refs = refsOf(sid), sim = W.sim[sid] || {};
        const H = []; let seq = 0;
        const E = (date, kind, actor, text, o = {}) => { H.push(Object.assign({ key: sid + ":" + (o.k || kind + ":" + date + ":" + (seq++)), date, kind, actor, text, refs: o.refs || [], major: o.major !== false, sim: date > T_DATES[0] || !!o.sim }, o)); };
        const st = {}; refs.forEach(r => { st[r] = { st: "awaiting", note: "" }; });
        const set = (rs, v) => (Array.isArray(rs) ? rs : [rs]).forEach(r => { st[r] = Object.assign({}, v); });
        const dec = DECISION[sid]; const aKey = actKey(sid);
        const acted = !!(aKey && act(aKey));
        const skipped = act("skip:" + sid);
        const stuckOpen = () => refs.filter(r => !["recovered", "removed", "lost"].includes(st[r].st)).reduce((a, r) => a + INV[r].stuck, 0);
        const contact = (sid === "S09" && acted) ? { name: s.new_contact.name, email: s.new_contact.email } : { name: s.contact, email: s.email };
        // the channel actually allowed by Company settings (null when both are off)
        const chan = s.channel === "WhatsApp" ? (settings.whatsapp !== false ? "WhatsApp" : settings.email !== false ? "Email" : null)
                                              : (settings.email !== false ? "Email" : settings.whatsapp !== false ? "WhatsApp" : null);
        // a person's correction to a reading that needs judgement stops automatic sends for this supplier,
        // and any approval given before that correction no longer counts
        const humanCorr = Object.keys(S.reviews || {}).filter(k => { const rv = S.reviews[k]; const base = REPLY[k.split("~")[0]]; return rv && !rv.undone && ["corrected", "manual"].includes(rv.verdict) && HUMAN_INTENTS.includes(rv.intent) && base && base.sid === sid; });
        const corrAt = humanCorr.map(k => S.reviews[k].at || "").sort().pop() || "";
        const pending = []; // extra approvals waiting besides the main next step
        const flags = [];
        let next = null;
        const ownerAlert = (date, why, k) => E(date, "owner_alert", "Agent", `${s.owner} (relationship owner) alerted: ${why}`, { k: k || "owner:" + date });

        // R10 blocks automatic messages above the threshold; automatic reminders can be switched off in settings
        const r10Block = () => R("R10") && stuckOpen() > N("R10", "x");
        const autoOK = () => settings.autoReminders && !r10Block();
        const approvedEarly = id => !!act("approve:" + id);
        const approvedAfterCorr = id => { const a = act("approve:" + id); return !!a && (a.at || "") > corrAt; };
        const canAuto = id => !!chan && (humanCorr.length ? approvedAfterCorr(id) : (autoOK() || approvedEarly(id)));
        const routineWhy = () => !chan ? "email and WhatsApp are both switched off" : humanCorr.length ? "you corrected the AI reading to one that needs a person" : !settings.autoReminders ? "automatic reminders are off" : "rule R10: credit above " + inr(N("R10", "x"));

        const readEntry = (rid, extra = "") => {
          const g = reading(rid); const rev = (S.reviews || {})[rid];
          const route = g._human ? "Sent to you: " + (g.reason_for_human || "flagged by the checks") : "Handled automatically.";
          E(REPLY[rid].date, "reading", "AI · Claude Haiku (" + PROMPT_VERSIONS.reader + ")", `AI read the reply: ${g.summary} ${route}${extra}`, { k: "read:" + rid, reading: rid, ai: true, refs: (g.invoices || []).map(i => i.ref) });
          const revs = Object.keys(S.reviews || {}).filter(k => k === rid || k.startsWith(rid + "~")).map(k => [k, S.reviews[k]]).sort((x, y) => (x[1].at || "").localeCompare(y[1].at || ""));
          revs.forEach(([k, rv]) => {
            const tail = rv.undone ? " (undone)" : "";
            if (rv.verdict === "confirmed") E(rv.date || today, "review", W.user.name, "Checked the AI reading and confirmed it." + tail, { k: "rev:" + k, major: false, undone: !!rv.undone });
            else if (rv.verdict === "manual") E(rv.date || today, "review", W.user.name, `Recorded the position by hand (AI off): ${INTENT_TEXT[rv.intent] || rv.intent}.` + tail, { k: "rev:" + k, major: !rv.undone, undone: !!rv.undone });
            else E(rv.date || today, "review", W.user.name, `Corrected the AI reading: ${INTENT_TEXT[g.intent]} → ${INTENT_TEXT[rv.intent] || rv.intent}. Reason: ${rv.reason || "not given"}.` + tail, { k: "rev:" + k, major: !rv.undone, undone: !!rv.undone });
          });
          return g;
        };
        const inEntry = rid => { const r = REPLY[rid]; E(r.date, "message_in", (sid === "S09" && rid.startsWith("P")) ? "Finance team, GreenLeaf" : (rid === "D09" ? "Front office, GreenLeaf" : s.contact), `Reply on ${r.channel}.`, { k: "in:" + rid, msg: rid, refs: r.refs }); };
        const outEntry = (date, mid, opts = {}) => {
          const d = W.draftMeta[mid] || {}; const a = opts.act;
          const edited = a && a.edit; const by = opts.auto ? "Agent (sent automatically" + (opts.rule ? ", rule " + opts.rule : "") + ")" : (a && a.by === "agent") ? "Agent" : (edited ? "Drafted by AI · edited and approved by " : "Drafted by AI · approved by ") + W.user.name;
          const via = opts.channel || ((d.channel === "WhatsApp" && settings.whatsapp === false) || (d.channel === "Email" && settings.email === false) ? chan : d.channel) || chan || "no channel";
          const lang = d.language && d.language !== "English" ? " in " + d.language : "";
          E(date, "message_out", by, `${opts.label || "Message sent"} on ${via}${lang}. ${d.purpose || ""}.`, { k: opts.k || "out:" + mid, msg: mid, refs: d.refs || [], undone: opts.undone, ai: true, major: !opts.undone });
        };
        const imsEntry = (date, rs, extra = "") => { E(date, "ims", "GST portal (IMS)", `Seen in IMS: ${listAnd(rs)} uploaded by the supplier${extra}. GSTR-2B confirms it.`, { k: "ims:" + rs[0], refs: rs }); };
        const r1date = (promise, replyDate) => { if (!R("R1")) return null; if (days(replyDate, promise) <= 7) return null; return addDays(promise, -N("R1")); };

        /* reminder that may be sent between 15 Oct and 12 Nov */
        const reminder = (mid, date, filedOn, rs) => {
          if (!date) return;
          if (filedOn && filedOn <= date) { E(date, "check", "Agent", `Reminder not needed: ${listAnd(rs)} already seen in IMS on ${fd(filedOn, false)}.`, { k: "skiprem:" + mid, major: false }); return; }
          if (canAuto(mid)) outEntry(date, mid, { auto: !approvedEarly(mid), rule: "R1", label: approvedEarly(mid) ? "Reminder sent (approved on 15 Oct)" : "Reminder sent" });
          else E(date, "check", "Agent", `Reminder not sent: ${routineWhy()} and it was not approved.`, { k: "norem:" + mid });
        };
        const twobEntry = (found, lostRs, missRs, notes = {}) => {
          if (found.length) E(T_DATES[2], "gstr2b", "GST portal (GSTR-2B)", `October GSTR-2B: ${listAnd(found)} found. ${inr(found.reduce((a, r) => a + INV[r].stuck, 0))} of credit confirmed.`, { k: "2b:found", refs: found });
          if (lostRs.length) E(T_DATES[2], "gstr2b", "Agent", `Credit lost: ${listAnd(lostRs)} (${inr(lostRs.reduce((a, r) => a + INV[r].stuck, 0))}, FY 2025-26) missed the last GSTR-2B before the 30 Nov 2026 claim deadline.`, { k: "2b:lost", refs: lostRs });
          if (missRs.length) E(T_DATES[2], "gstr2b", "Agent", `Not in the October GSTR-2B: ${listAnd(missRs)}.${notes.miss ? " " + notes.miss : ""}`, { k: "2b:miss", refs: missRs });
        };
        /* outcome on 14 Nov from IMS dates (anything filed by 11 Nov reaches the October GSTR-2B) */
        const settle = (imsMap, notes) => {
          const found = [], lostRs = [], missRs = [];
          refs.forEach(r => {
            if (["recovered", "removed"].includes(st[r].st)) return;
            if (st[r].st === "internal" || (st[r].st === "review" && INV[r].issue === "duplicate")) return;
            if (imsMap[r] && imsMap[r] <= "2026-11-11") { found.push(r); return; }
            if (INV[r].fy === "2025-26") lostRs.push(r); else missRs.push(r);
          });
          if (t >= 2) {
            twobEntry(found, lostRs, missRs, notes);
            found.forEach(r => set(r, { st: "recovered", note: "In the October GSTR-2B", on: T_DATES[2] }));
            lostRs.forEach(r => set(r, { st: "lost", note: "Missed the last GSTR-2B before 30 Nov" }));
            missRs.forEach(r => { if (!["broken", "promised"].includes(st[r].st)) set(r, Object.assign({}, st[r], { st: "missing", note: notes && notes.missNote || "Not in the October GSTR-2B" })); });
          }
          return { found, lostRs, missRs };
        };
        const imsSet = imsMap => Object.entries(imsMap).forEach(([r, d]) => { if (d <= T_DATES[1] && t >= 1) set(r, { st: "ims", note: "Uploaded by the supplier on " + fd(d, false), on: d }); });
        const deadlineGone = rs => { const fyRs = rs.filter(r => INV[r].fy === "2025-26"); if (fyRs.length && t >= 1) E(T_DATES[1], "check", "Agent", `${listAnd(fyRs)} not in IMS after the 11 Nov GSTR-1 due date: this FY 2025-26 credit (${inr(fyRs.reduce((a, r) => a + INV[r].stuck, 0))}) can no longer reach GSTR-2B before 30 Nov.`, { k: "deadline:" + sid, refs: fyRs }); };

        /* the decision waiting on 15 Oct, shared by most suppliers */
        const decisionNext = (extra = {}) => {
          if (!dec) return null;
          if (acted) return null;
          if (skipped) return { kind: "skipped", text: "You skipped this on 15 Oct: " + (skipped.reason || "no reason given") };
          if (t > 0) return { kind: "missed", text: "Not acted on 15 Oct. Next chance: the November GSTR-1, due 11 Dec.", title: dec.title };
          return Object.assign({ kind: "decision", draft: dec.type === "send" ? dec.id : null, action: dec.type, title: dec.title, routine: !!dec.routine }, extra);
        };
        const archived = key => Object.keys(S.acts || {}).filter(k => k.startsWith(key + "~")).map(k => [k, S.acts[k]]);
        const t0ActEntry = () => {
          if (dec.type === "send") archived(aKey).forEach(([k, old]) => outEntry(T_DATES[0], dec.id, { act: old, undone: true, label: "Message cancelled within 10 seconds (never sent)", k: "out:" + k }));
          const a = act(aKey) || (S.acts || {})[aKey];
          if (!a) return;
          if (dec.type === "send") {
            if (sid === "S09") E(T_DATES[0], "contact", W.user.name, `Contact updated: ${s.new_contact.name} (${s.new_contact.email}) replaces ${s.contact}, who has left.`, { k: "contact", undone: !!a.undone, major: !a.undone });
            outEntry(T_DATES[0], dec.id, { act: a, undone: !!a.undone, label: a.undone ? "Message cancelled within 10 seconds (never sent)" : "Message sent" });
            if (sid === "S04" && !a.undone) ownerAlert(T_DATES[0], "copied on the message and asked to call Rakesh Shah this week.", "owner:t0");
          }
        };
        const skipEntry = () => {
          [...archived("skip:" + sid), ["skip:" + sid, (S.acts || {})["skip:" + sid]]].forEach(([k, sk]) => { if (sk) E(T_DATES[0], "decision", W.user.name, `Skipped the recommended step (${dec.title}). Reason: ${sk.reason || "not given"}.${sk.undone ? " Brought back later." : ""}`, { k: k, major: !sk.undone }); });
        };

        switch (sid) {
          case "S01": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: SGP/1182 and SGP/1197 are not in GSTR-2B for the Pune GSTIN.", { refs });
            outEntry("2026-10-01", "N-S01", { label: "First message sent" });
            inEntry("D01"); readEntry("D01");
            E("2026-10-06", "rule", "Agent", "Rule R1: reminder scheduled for 9 Nov, 2 days before the promised date.", { k: "r1" });
            if (!(S.reviews || {}).D01) E("2026-10-07", "review", W.user.name, "Checked the AI reading and confirmed it (spot check).", { k: "rev:D01:seed", major: false });
            E("2026-10-14", "check", "Agent", "September GSTR-2B checked: both invoices still missing, as expected. The promise is for the October GSTR-1.", { k: "sep2b" });
            set(refs, { st: "promised", date: "2026-11-11", note: "Promised for the October GSTR-1" });
            const rd = r1date("2026-11-11", "2026-10-06");
            if (t >= 1) { reminder("R-S01", rd, "2026-11-10", refs); imsEntry("2026-11-10", refs, " in their October GSTR-1"); imsSet(sim.ims); }
            settle(sim.ims);
            if (t === 0) next = rd ? (canAuto("R-S01") ? { kind: "auto", text: `Reminder on ${fd(rd, false)} (rule R1), then check IMS after 11 Nov`, when: rd, rule: "R1", draft: "R-S01" } : { kind: "decision", routine: true, draft: "R-S01", action: "approve", title: `Approve the ${fd(rd, false)} reminder`, why: routineWhy(), when: rd }) : { kind: "auto", text: "Check IMS after 11 Nov and GSTR-2B on 14 Nov" };
            break;
          }
          case "S02": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: PST/26-27/0871, PST/26-27/0874 and PST/26-27/0880 are not in GSTR-2B for the Pune GSTIN.", { refs });
            outEntry("2026-10-01", "N-S02", { label: "First message sent" });
            inEntry("D02"); readEntry("D02");
            E("2026-10-07", "check", "Agent", `Searched the GSTR-2B of all three Kestrel GSTINs: all three invoices are in the Manesar GSTIN's (${UNITS.MAN.gstin}) August GSTR-2B, not Pune's. They were filed to the wrong GSTIN. Sent to you to decide.`, { k: "xgstin", refs });
            set(refs, { st: "review", note: "Filed to your Manesar GSTIN by mistake" });
            t0ActEntry(); skipEntry();
            if (acted) {
              set(refs, { st: "awaiting", note: "Asked to amend the recipient GSTIN" });
              if (t >= 1) { inEntry("P-S02"); readEntry("P-S02"); set(refs, { st: "promised", date: "2026-11-11", note: "Promised for the October GSTR-1" }); imsEntry("2026-11-06", refs, " to the Pune GSTIN (amended in their October GSTR-1)"); E("2026-11-09", "check", "Agent", "Reminder not needed: already seen in IMS on 6 Nov.", { k: "skiprem:P-S02", major: false }); imsSet(sim.ims_if_acted); }
              settle(sim.ims_if_acted);
            } else {
              if (t >= 1) E(T_DATES[1], "check", "Agent", "Not in IMS for the Pune GSTIN after the 11 Nov GSTR-1 due date. The invoices are still under the Manesar GSTIN.", { k: "t1miss" });
              settle({}, { miss: "Still under the Manesar GSTIN; nobody asked them to amend it.", missNote: "Still under the Manesar GSTIN" });
            }
            next = decisionNext({ why: "They did file, but to your Manesar GSTIN. Found by searching all three of your GSTINs." });
            break;
          }
          case "S03": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: BF/26-27/3310 value differs. The supplier reported taxable value ₹3,98,000 (GST ₹71,640); our books show ₹4,12,000 (GST ₹74,160). ₹2,520 of credit is short.", { refs });
            outEntry("2026-10-01", "N-S03", { label: "First message sent" });
            inEntry("D03"); readEntry("D03");
            set(refs, { st: "review", note: "Supplier asked for the PO and GRN" });
            t0ActEntry(); skipEntry();
            if (acted) {
              set(refs, { st: "awaiting", note: "PO and GRN sent" });
              if (t >= 1) { inEntry("P-S03"); readEntry("P-S03"); imsEntry("2026-11-07", refs, " with the corrected value (October GSTR-1)"); imsSet(sim.ims_if_acted); }
              settle(sim.ims_if_acted);
            } else {
              if (t >= 1) E(T_DATES[1], "check", "Agent", "No amendment in IMS: the supplier was waiting for our PO and GRN.", { k: "t1miss" });
              settle({}, { miss: "The supplier was waiting for the PO and GRN.", missNote: "Waiting for our PO and GRN" });
            }
            next = decisionNext({ why: "They asked for documents before amending. The draft attaches both and states your value." });
            break;
          }
          case "S04": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: NP/2526/1450, NP/2526/1502 and NP/2627/0215 are not in GSTR-2B. Two are from FY 2025-26.", { refs });
            E("2026-09-14", "rule", "Agent", "Rule R8: ₹4,00,500 is FY 2025-26 credit. It must be in GSTR-2B by 14 Nov to be claimed before 30 Nov 2026. Marked top priority.", { k: "r8", refs: ["NP/2526/1450", "NP/2526/1502"] });
            outEntry("2026-10-01", "N-S04", { label: "First message sent" });
            inEntry("D04"); readEntry("D04");
            E("2026-10-09", "check", "Agent", "Checked payment options. Nova is not a micro or small enterprise. NP/2526/1450 and NP/2526/1502 are more than 180 days old, so their credit can only be kept once they are paid (Rule 37); holding money would block our own credit. Recommended: confirm the scheduled 28 Oct payment and ask for the October GSTR-1, through Priya Menon.", { k: "paycheck", refs: ["NP/2526/1450", "NP/2526/1502"] });
            set(refs, { st: "review", note: "Supplier wants payment first" });
            t0ActEntry(); skipEntry();
            if (acted) {
              set(refs, { st: "awaiting", note: "Asked for the October GSTR-1; payment date confirmed" });
              if (t >= 1) {
                inEntry("P-S04"); readEntry("P-S04");
                E("2026-10-21", "decision", "Priya Menon", "Called Rakesh Shah: the 28 Oct payment is on schedule; Nova will report all three invoices in the October GSTR-1. (Simulated.)", { k: "priya" });
                E("2026-10-28", "payment", "AP team", "Payment of ₹14,80,000 released to Nova Polymers as scheduled. (Simulated.)", { k: "pay" });
                imsEntry("2026-11-08", refs, " in their October GSTR-1"); imsSet(sim.ims_if_acted);
              }
              settle(sim.ims_if_acted);
            } else {
              if (t >= 1) { E("2026-10-28", "payment", "AP team", "Payment of ₹14,80,000 released to Nova Polymers as scheduled. (Simulated.)", { k: "pay" }); E(T_DATES[1], "check", "Agent", "Not in IMS after the 11 Nov GSTR-1 due date. Nova was paid but nobody asked for the filing by 11 Nov.", { k: "t1miss" }); deadlineGone(refs); }
              settle({}, { miss: "Paid on 28 Oct, but the filing was never requested.", missNote: "Not filed" });
            }
            next = decisionNext({ why: "They will file only after payment. Two invoices are past 180 days, so the right move is to confirm the scheduled payment, not to hold it." });
            if (next && next.kind === "decision") {
              const eligible = refs.filter(r => days(INV[r].date, s.payment.due) <= N("R6"));
              next.hold = R("R6") ? { refs: eligible, amount: eligible.reduce((a, r) => a + INV[r].gst, 0), excluded: refs.filter(r => !eligible.includes(r)) } : null;
            }
            break;
          }
          case "S05": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: KE/219 value differs. The supplier reported GST ₹18,000; our books show ₹21,600. ₹3,600 is short.", { refs });
            outEntry("2026-10-01", "N-S05", { label: "First message sent" });
            inEntry("D05"); readEntry("D05");
            E("2026-10-12", "rule", "Agent", "Rule R1: reminder scheduled for 9 Nov, 2 days before the promised date.", { k: "r1" });
            set(refs, { st: "promised", date: "2026-11-11", note: "Promised for the October GSTR-1" });
            const rd = r1date("2026-11-11", "2026-10-12");
            if (t >= 1) {
              reminder("R-S05", rd, null, refs);
              if (R("R5")) {
                E(T_DATES[1], "check", "Agent", "Rule R5: promise broken. The KE/219 correction is not in IMS after the 11 Nov GSTR-1 due date.", { k: "broken", refs });
                ownerAlert(T_DATES[1], "promise broken on KE/219.", "owner:t1");
                set(refs, { st: "broken", note: "Not in IMS after 11 Nov" });
                const f = act("send:F-S05");
                if (f) { outEntry(T_DATES[1], "F-S05", { act: f, label: "Firmer message sent" }); set(refs, { st: "awaiting", note: "Firmer message sent on 12 Nov" }); }
              } else {
                E(T_DATES[1], "check", "Agent", "KE/219 not in IMS after the 11 Nov GSTR-1 due date.", { k: "broken", refs });
                set(refs, { st: "awaiting", note: "Promised 11 Nov; not in IMS" });
              }
            }
            if (t >= 2) { twobEntry([], [], refs, { miss: "The promise for the October GSTR-1 was not kept." }); if (st["KE/219"].st !== "broken") set(refs, { st: "missing", note: act("send:F-S05") ? "Waiting for a reply to the 12 Nov message" : "Not in the October GSTR-2B" }); }
            if (t === 0) next = rd ? (canAuto("R-S05") ? { kind: "auto", text: `Reminder on ${fd(rd, false)} (rule R1), then check IMS after 11 Nov`, when: rd, rule: "R1", draft: "R-S05" } : { kind: "decision", routine: true, draft: "R-S05", action: "approve", title: `Approve the ${fd(rd, false)} reminder`, why: routineWhy(), when: rd }) : { kind: "auto", text: "Check IMS after 11 Nov" };
            else if (R("R5") && !act("send:F-S05")) next = t === 1 ? { kind: "decision", draft: "F-S05", action: "send", title: "Approve a firmer message for the November GSTR-1", why: "Rule R5: promise broken. Arjun Rao has been alerted." } : { kind: "missed", text: "The firmer message was not sent on 12 Nov. Next chance: the November GSTR-1, due 11 Dec." };
            else if (act("send:F-S05")) next = { kind: "wait", text: "Waiting for a reply to the 12 Nov message (November GSTR-1, due 11 Dec)" };
            else next = { kind: "wait", text: "Check again after the November GSTR-1 (due 11 Dec)" };
            break;
          }
          case "S06": {
            E("2026-10-14", "reco", "Reco job", "September GSTR-2B vs purchase register: MC-412 in our books has no match. GSTR-2B has MC/26-27/0412 from the same supplier with the same date (2 Sep), value (₹3,30,000) and GST (₹59,400). Our entry likely uses a different number format.", { refs });
            E("2026-10-14", "check", "Agent", "No supplier message needed. Sent to you to correct our entry.", { k: "internal" });
            set(refs, { st: "internal", note: "Our invoice number differs in format" });
            archived("book:S06").forEach(([k]) => E(T_DATES[0], "book", W.user.name, "Correction to our entry undone within 10 seconds.", { k: k, undone: true, major: false, refs }));
            const a = act("book:S06") || (S.acts || {})["book:S06"];
            if (a) E(T_DATES[0], "book", W.user.name, a.undone ? "Correction to our entry undone within 10 seconds." : "Purchase register entry corrected from MC-412 to MC/26-27/0412 and force-matched in the reco job. ₹59,400 of credit confirmed in the September GSTR-2B.", { k: "book", undone: !!a.undone, major: !a.undone, refs });
            skipEntry();
            if (acted) set(refs, { st: "recovered", note: "Book entry corrected; matches the September GSTR-2B", on: T_DATES[0] });
            else if (t >= 1) E(T_DATES[1], "check", "Agent", "MC-412 is still unmatched in our books.", { k: "t1miss" });
            next = acted ? { kind: "done", text: "Closed. The credit was already in the September GSTR-2B." } : decisionNext({ why: "Same supplier, date and amount. Nothing to chase: only our entry is different." });
            break;
          }
          case "S07": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: SRW/0933 and SRW/0941 were reported as IGST. These are CGST + SGST supplies (Chennai to Chennai).", { refs });
            outEntry("2026-10-01", "N-S07", { label: "First message sent" });
            inEntry("D07"); readEntry("D07");
            E("2026-10-08", "rule", "Agent", "Rule R1: reminder scheduled for 9 Nov, 2 days before the promised date.", { k: "r1" });
            set(refs, { st: "promised", date: "2026-11-11", note: "Promised for the October GSTR-1" });
            const rd = r1date("2026-11-11", "2026-10-08");
            if (t >= 1) { imsEntry("2026-11-08", refs, " as CGST + SGST (amended in their October GSTR-1)"); reminder("R-S07", rd, "2026-11-08", refs); imsSet(sim.ims); }
            settle(sim.ims);
            if (t === 0) next = rd ? (canAuto("R-S07") ? { kind: "auto", text: `Reminder on ${fd(rd, false)} (rule R1), then check IMS after 11 Nov`, when: rd, rule: "R1" } : { kind: "decision", routine: true, draft: "R-S07", action: "approve", title: `Approve the ${fd(rd, false)} reminder`, why: routineWhy(), when: rd }) : { kind: "auto", text: "Check IMS after 11 Nov" };
            break;
          }
          case "S08": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: AMT/INV/26/4471 is not in GSTR-2B.", { refs });
            outEntry("2026-10-01", "N-S08", { label: "First message sent" });
            inEntry("D08"); readEntry("D08");
            E("2026-10-03", "rule", "Agent", "Rule R2: follow-up scheduled for 21 Oct, the day after Deepa Rao is back.", { k: "r2" });
            set(refs, { st: "awaiting", note: "Out of office until 20 Oct" });
            const fu = R("R2") ? addDays("2026-10-20", N("R2")) : null;
            const fuOK = fu && canAuto("X-S08");
            if (t >= 1) {
              if (fuOK) {
                outEntry(fu, "X-S08", { auto: !approvedEarly("X-S08"), rule: "R2", label: approvedEarly("X-S08") ? "Follow-up sent (approved on 15 Oct)" : "Follow-up sent" });
                inEntry("P-S08"); readEntry("P-S08");
                E("2026-11-09", "check", "Agent", "Reminder not needed: already seen in IMS on 6 Nov.", { k: "skiprem:P-S08", major: false });
                imsEntry("2026-11-06", refs, " in their October GSTR-1"); imsSet(sim.ims_if_acted);
              } else {
                E(fu || "2026-10-21", "check", "Agent", fu ? `Follow-up not sent: ${routineWhy()} and it was not approved.` : "No follow-up: rule R2 is off and nobody followed up.", { k: "nofu" });
                E(T_DATES[1], "check", "Agent", "Not in IMS after the 11 Nov GSTR-1 due date. No follow-up was sent after their leave.", { k: "t1miss" });
              }
            }
            settle(fuOK ? sim.ims_if_acted : {}, { miss: "No follow-up was sent after their leave." });
            if (t === 0) next = fu ? (canAuto("X-S08") ? { kind: "auto", text: `Follow-up on ${fd(fu, false)} (rule R2)`, when: fu, rule: "R2", draft: "X-S08" } : { kind: "decision", routine: true, draft: "X-S08", action: "approve", title: `Approve the ${fd(fu, false)} follow-up`, why: routineWhy(), when: fu }) : { kind: "decision", draft: "X-S08", action: "approve", title: "Approve a follow-up for 21 Oct", why: "Rule R2 is off, so out-of-office replies come to you.", when: "2026-10-21", routine: true };
            break;
          }
          case "S09": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: GLF/0815 is not in GSTR-2B for the Manesar GSTIN.", { refs });
            outEntry("2026-10-01", "N-S09", { label: "First message sent" });
            inEntry("D09"); readEntry("D09");
            set(refs, { st: "review", note: "Contact has left the company" });
            t0ActEntry(); skipEntry();
            if (acted) {
              set(refs, { st: "awaiting", note: "Sent to the new contact" });
              if (t >= 1) {
                inEntry("P-S09"); readEntry("P-S09");
                E("2026-10-20", "rule", "Agent", "Rule R1: reminder scheduled for 9 Dec, 2 days before the promised date.", { k: "r1" });
                set(refs, { st: "promised", date: "2026-12-11", note: "Promised for the November GSTR-1" });
                E(T_DATES[1], "check", "Agent", "Not in IMS, as expected: they promised the November GSTR-1 (due 11 Dec).", { k: "t1exp" });
              }
              if (t >= 2) twobEntry([], [], refs, { miss: "Expected: promised for the November GSTR-1." });
            } else {
              if (t >= 1) E(T_DATES[1], "check", "Agent", "Not in IMS. Our messages went to a contact who has left.", { k: "t1miss" });
              settle({}, { miss: "Our messages went to a contact who has left.", missNote: "Never reached the right person" });
            }
            next = decisionNext({ why: "Anjali Mehra has left. Their office named finance@greenleaf.example for GST matters." }) || (acted && t >= 1 ? { kind: "auto", text: "Reminder on 9 Dec (rule R1); check GSTR-2B on 14 Dec", when: "2026-12-09" } : null);
            break;
          }
          case "S10": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: RA/2526/0388 and RA/2627/0119 are not in GSTR-2B. RA/2526/0388 is from FY 2025-26.", { refs });
            E("2026-09-14", "rule", "Agent", "Rule R8: ₹1,00,800 is FY 2025-26 credit. It must be in GSTR-2B by 14 Nov to be claimed before 30 Nov 2026. Marked top priority.", { k: "r8", refs: ["RA/2526/0388"] });
            outEntry("2026-10-01", "N-S10", { label: "First message sent" });
            inEntry("D10"); readEntry("D10");
            set(refs, { st: "review", note: "\"ok noted\": no commitment" });
            t0ActEntry(); skipEntry();
            if (acted) {
              set(refs, { st: "awaiting", note: "Asked for a date" });
              if (t >= 1) {
                inEntry("P-S10"); readEntry("P-S10");
                const rd = r1date("2026-11-06", "2026-10-16");
                if (rd) E("2026-10-16", "rule", "Agent", `Rule R1: reminder scheduled for ${fd(rd, false)}, ${N("R1")} days before the promised date.`, { k: "r1" });
                reminder("R-S10", rd, "2026-11-05", refs);
                imsEntry("2026-11-05", refs, " in their October GSTR-1"); imsSet(sim.ims_if_acted);
              }
              settle(sim.ims_if_acted);
            } else {
              if (t >= 1) deadlineGone(refs);
              settle({}, { miss: "\"ok noted\" was never followed up.", missNote: "Never followed up" });
            }
            next = decisionNext({ why: "\"ok noted\" is not a commitment, and ₹1,00,800 of this is FY 2025-26 credit." });
            break;
          }
          case "S11": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: ST/2231, ST/2232 and ST/2231-B are not in GSTR-2B. ST/2231-B has the same date and amount as ST/2231.", { refs });
            outEntry("2026-10-01", "N-S11", { label: "First message sent" });
            inEntry("D11"); readEntry("D11");
            E("2026-10-09", "rule", "Agent", "Rule R1: reminder scheduled for 9 Nov for ST/2231 and ST/2232.", { k: "r1" });
            set(["ST/2231", "ST/2232"], { st: "promised", date: "2026-11-11", note: "Promised for the October GSTR-1" });
            set("ST/2231-B", { st: "review", note: "Supplier says it is not their bill" });
            archived("dup:S11").forEach(([k]) => E(T_DATES[0], "book", W.user.name, "Removal of ST/2231-B undone within 10 seconds.", { k: k, undone: true, major: false, refs: ["ST/2231-B"] }));
            const a = act("dup:S11") || (S.acts || {})["dup:S11"];
            if (a) E(T_DATES[0], "book", W.user.name, a.undone ? "Removal of ST/2231-B undone within 10 seconds." : "ST/2231-B removed from our purchase register as a duplicate of ST/2231 (same date and amount; the supplier says it is not their bill). Its ₹13,680 was never real credit.", { k: "dup", undone: !!a.undone, major: !a.undone, refs: ["ST/2231-B"] });
            skipEntry();
            if (acted) set("ST/2231-B", { st: "removed", note: "Duplicate removed from our books", on: T_DATES[0] });
            const rd = r1date("2026-11-11", "2026-10-09");
            if (t >= 1) { reminder("R-S11", rd, "2026-11-10", ["ST/2231", "ST/2232"]); imsEntry("2026-11-10", ["ST/2231", "ST/2232"], " in their October GSTR-1"); imsSet(sim.ims); if (!acted) E(T_DATES[1], "check", "Agent", "ST/2231-B is still in our books as a possible duplicate.", { k: "t1dup" }); }
            settle(sim.ims);
            next = decisionNext({ why: "The supplier says ST/2231-B is not theirs. It has the same date and amount as ST/2231. ST/2231 and ST/2232 are promised for 11 Nov." });
            if (!next && t === 0) next = rd ? { kind: "auto", text: `Reminder on ${fd(rd, false)} for ST/2231 and ST/2232 (rule R1)`, when: rd, rule: "R1" } : { kind: "auto", text: "Check IMS after 11 Nov" };
            if (next && next.kind === "decision" && rd) next.also = canAuto("R-S11") ? `Reminder on ${fd(rd, false)} for ST/2231 and ST/2232 (rule R1)` : `The ${fd(rd, false)} reminder for ST/2231 and ST/2232 needs approval (${routineWhy()})`;
            if (t === 0 && rd && !canAuto("R-S11")) { const item = { kind: "decision", routine: true, draft: "R-S11", action: "approve", title: `Approve the ${fd(rd, false)} reminder (ST/2231, ST/2232)`, why: routineWhy(), when: rd }; if (next && next.kind === "decision") pending.push(item); else next = item; }
            break;
          }
          case "S12": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: VC/0512 and VC/0688 are not in GSTR-2B. VC/0512 is from FY 2025-26.", { refs });
            E("2026-09-14", "rule", "Agent", "Rule R8: ₹1,24,200 is FY 2025-26 credit. It must be in GSTR-2B by 14 Nov to be claimed before 30 Nov 2026. Marked top priority.", { k: "r8", refs: ["VC/0512"] });
            outEntry("2026-10-01", "N-S12", { label: "First message sent" });
            inEntry("D12"); readEntry("D12");
            E("2026-10-11", "check", "Agent", "Supplier's returns on the GST portal: GSTR-1 and GSTR-3B for August not filed; September GSTR-1 not filed. Rule 37A risk: if they never file GSTR-3B, credit we claim on their invoices must be reversed later.", { k: "filing" });
            E("2026-10-11", "rule", "Agent", "Rule R1: reminder scheduled for 29 Oct for VC/0688, 2 days before the date they gave.", { k: "r1" });
            set("VC/0688", { st: "promised", date: "2026-10-31", note: "Promised by 31 Oct; supplier reports a cash crunch" });
            set("VC/0512", { st: "review", note: "Not mentioned in the supplier's reply" });
            flags.push({ id: "37A", text: "GSTR-3B not filed for August: tax on these invoices is not yet paid (Rule 37A risk)." });
            t0ActEntry(); skipEntry();
            const rdA = r1date("2026-10-31", "2026-10-11");
            if (acted) set("VC/0512", { st: "awaiting", note: "Asked about this invoice specifically" });
            if (t >= 1) {
              if (acted) { inEntry("P-S12"); readEntry("P-S12"); set("VC/0512", { st: "promised", date: "2026-11-11", note: "Promised for the October GSTR-1" }); }
              reminder("R-S12a", rdA, "2026-10-30", ["VC/0688"]);
              E("2026-10-30", "check", "GST portal", "Supplier filed its August and September GSTR-1. GSTR-3B for August and September is still not filed.", { k: "filing:t1" });
              imsEntry("2026-10-30", ["VC/0688"], " in their August GSTR-1, filed late");
              if (acted) { const rdB = r1date("2026-11-11", "2026-10-19"); reminder("R-S12b", rdB, "2026-11-10", ["VC/0512"]); imsEntry("2026-11-10", ["VC/0512"], " in their October GSTR-1"); }
              else deadlineGone(["VC/0512"]);
              imsSet(sim.ims); if (acted) imsSet(sim.ims_if_acted);
              flags.length = 0; flags.push({ id: "37A", text: "GSTR-3B for August and September still not filed: the tax on these invoices is not yet paid. If it stays unpaid, credit claimed on them must be reversed later (Rule 37A)." });
            }
            settle(Object.assign({}, sim.ims, acted ? sim.ims_if_acted : {}), { miss: "" });
            next = decisionNext({ why: "Their promise covers August and September. VC/0512 (January, FY 2025-26) is not mentioned, and they report a cash crunch." });
            if (next && next.kind === "decision" && rdA) next.also = canAuto("R-S12a") ? `Reminder on ${fd(rdA, false)} for VC/0688 (rule R1)` : `The ${fd(rdA, false)} reminder for VC/0688 needs approval (${routineWhy()})`;
            if (t === 0 && rdA && !canAuto("R-S12a")) { const item = { kind: "decision", routine: true, draft: "R-S12a", action: "approve", title: `Approve the ${fd(rdA, false)} reminder (VC/0688)`, why: routineWhy(), when: rdA }; if (next && next.kind === "decision") pending.push(item); else next = item; }
            break;
          }
          case "S13": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: JIG/26/1104 and JIG/26/1131 are not in GSTR-2B.", { refs });
            outEntry("2026-10-01", "N-S13", { label: "First message sent" });
            inEntry("D13"); readEntry("D13");
            E("2026-10-09", "rule", "Agent", "Rule R4: hostile tone. Anita Desai alerted; reminders slowed to every 14 days.", { k: "r4" });
            E("2026-10-14", "gstr2b", "GST portal (GSTR-2B)", "September GSTR-2B: JIG/26/1104 found (filed late in their September GSTR-1). ₹52,200 of credit confirmed. JIG/26/1131 is still missing.", { k: "sep2b", refs: ["JIG/26/1104"] });
            set("JIG/26/1104", { st: "recovered", note: "In the September GSTR-2B", on: "2026-10-14" });
            set("JIG/26/1131", { st: "review", note: "Supplier says filed; not in GSTR-2B" });
            t0ActEntry(); skipEntry();
            if (acted) {
              set("JIG/26/1131", { st: "awaiting", note: "Evidence reply sent" });
              if (t >= 1) { inEntry("P-S13"); readEntry("P-S13"); imsEntry("2026-11-07", ["JIG/26/1131"], " in their October GSTR-1"); imsSet(sim.ims_if_acted); }
              settle(sim.ims_if_acted);
            } else {
              if (t >= 1) E(T_DATES[1], "check", "Agent", "JIG/26/1131 is not in IMS. Nobody replied to their message.", { k: "t1miss" });
              settle({}, { miss: "Nobody replied to their message.", missNote: "Nobody replied" });
            }
            next = decisionNext({ why: "Hostile reply. The September GSTR-2B confirms JIG/26/1104 but not JIG/26/1131. The draft says exactly that, calmly." });
            break;
          }
          case "S14": {
            E("2026-09-14", "reco", "Reco job", "August GSTR-2B vs purchase register: KP/0716 and KP/0722 values differ (₹1,620 and ₹1,440 of credit short).", { refs });
            outEntry("2026-10-01", "N-S14", { label: "First message sent" });
            inEntry("D14"); readEntry("D14");
            E("2026-10-12", "rule", "Agent", "Rule R1: no reminder, because the date is less than a week away. Amendments to August invoices appear with the supplier's October GSTR-1, so the agent checks IMS after 11 Nov.", { k: "r1" });
            set(refs, { st: "promised", date: "2026-10-16", note: "Promised by Friday 16 Oct" });
            if (t >= 1) { E("2026-10-17", "check", "Agent", "Promised date passed. Amendments to August invoices go in the October GSTR-1 (due 11 Nov), so this is not a broken promise yet.", { k: "c17" }); imsEntry("2026-11-09", refs, " with the corrected values (October GSTR-1)"); imsSet(sim.ims); }
            settle(sim.ims);
            if (t === 0) next = { kind: "auto", text: "No reminder needed. Check IMS after 11 Nov (amendments come with the October GSTR-1)" };
            break;
          }
          case "S15": case "S16": {
            const label = sid === "S15" ? "DEW/26/0561 and DEW/26/0570 are" : "OOS/0091 is";
            E("2026-10-14", "reco", "Reco job", `September GSTR-2B vs purchase register: ${label} not in GSTR-2B. New this cycle.`, { refs });
            set(refs, { st: "new", note: "New in the September reco job" });
            t0ActEntry(); skipEntry();
            if (acted) {
              set(refs, { st: "awaiting", note: "First message sent" });
              const pid = "P-" + sid;
              if (t >= 1) {
                inEntry(pid); readEntry(pid);
                const g = reading(pid); const rd = g.promised_date ? r1date(g.promised_date, REPLY[pid].date) : null;
                const filed = Object.values(sim.ims_if_acted)[0];
                if (rd) E(REPLY[pid].date, "rule", "Agent", `Rule R1: reminder scheduled for ${fd(rd, false)}, ${N("R1")} days before the promised date.`, { k: "r1" });
                if (rd && filed <= rd) E(rd, "check", "Agent", `Reminder not needed: already seen in IMS on ${fd(filed, false)}.`, { k: "skiprem:" + pid, major: false });
                imsEntry(filed, refs, " in their October GSTR-1"); imsSet(sim.ims_if_acted);
              }
              settle(sim.ims_if_acted);
            } else {
              if (t >= 1) E(T_DATES[1], "check", "Agent", "Not in IMS. The supplier was never contacted.", { k: "t1miss" });
              settle({}, { miss: "The supplier was never contacted.", missNote: "Never contacted" });
            }
            next = decisionNext({ why: sid === "S15" ? "New in your September reconciliation." : "Low value. The agent would normally add it to a routine batch." });
            break;
          }
        }

        /* reading corrections: a corrected position that needs judgement brings the case back to you */
        for (const rid of Object.keys(S.reviews || {})) {
          const rv = S.reviews[rid]; if (!rv || rv.undone || !["corrected", "manual"].includes(rv.verdict) || rid.includes("~")) continue;
          if (!REPLY[rid] || REPLY[rid].sid !== sid) continue;
          if (HUMAN_INTENTS.includes(rv.intent) && t === 0 && (!next || next.kind !== "decision" || next.routine)) { // the correction outranks a routine reminder
            refs.forEach(r => { if (["promised", "awaiting"].includes(st[r].st)) st[r] = { st: "review", note: "You corrected the AI reading" }; });
            next = { kind: "decision", action: "review", title: "Decide the next step yourself", why: "You corrected the AI's reading to \"" + (INTENT_TEXT[rv.intent] || rv.intent) + "\", so the automatic step is paused." };
          }
        }
        /* approvals given in advance on 15 Oct (routine reminders when they are not automatic) */
        Object.keys(S.acts || {}).filter(k => k.startsWith("approve:")).forEach(k => {
          const id = k.slice(8).split("~")[0]; const m = W.draftMeta[id]; if (!m || m.sid !== sid) return; const a = S.acts[k];
          E(T_DATES[0], "decision", W.user.name, `Approved in advance${a.bulk ? " (bulk)" : ""}: the ${fd(m.when, false)} message. ${m.purpose}.${a.undone ? " Undone within 10 seconds." : ""}`, { k: k, major: !a.undone, undone: !!a.undone, msg: id });
        });
        /* T1: optional IMS acceptance */
        const acc = act("ims:accept");
        const seen = refs.filter(r => st[r].st === "ims");
        if (t >= 1 && acc && seen.length) E(T_DATES[1], "ims", W.user.name, `Accepted ${seen.length} ${plural(seen.length, "record")} in IMS (${listAnd(seen)}); they match the purchase register.`, { k: "imsacc", major: false, refs: seen });
        if (t === 1 && !next && seen.length) next = { kind: "auto", text: "Seen in IMS. GSTR-2B on 14 Nov confirms it" + (acc ? "" : "; accept in IMS, or leave it (no action counts as accepted)") };
        if (t === 2 && !next) {
          const lostRs = refs.filter(r => st[r].st === "lost");
          if (lostRs.length) next = { kind: "info", text: `${s.owner} to discuss recovering the lost GST (${inr(lostRs.reduce((a, r) => a + INV[r].stuck, 0))}) with the supplier. A commercial step, outside this tool.` };
          else if (refs.every(r => ["recovered", "removed"].includes(st[r].st))) next = { kind: "done", text: "Closed: everything is in GSTR-2B." };
          else if (refs.some(r => st[r].st === "promised")) next = { kind: "wait", text: "Waiting for the promised date" };
          else next = { kind: "wait", text: "Next cycle: the November GSTR-1 (due 11 Dec)" };
        }
        if (!next && acted && t === 0) next = { kind: "wait", text: sid === "S04" ? "Waiting for Nova's reply. Priya Menon calls Rakesh Shah this week; the 28 Oct payment is on schedule" : sid === "S09" ? "Waiting for the finance team's reply. The agent checks IMS daily and GSTR-2B on 14 Nov" : "Waiting for their reply. The agent checks IMS daily and GSTR-2B on 14 Nov" };
        if (!next) next = refs.every(r => ["recovered", "removed"].includes(st[r].st)) ? { kind: "done", text: "Closed: everything is in GSTR-2B." } : { kind: "wait", text: "Waiting for the supplier" };
        if (next.kind === "decision" && next.routine === undefined) next.routine = false;

        /* sort history: date, then the order written */
        H.forEach((h, i) => { h._i = i; });
        H.sort((a, b) => a.date.localeCompare(b.date) || a._i - b._i);
        H.forEach((h, i) => { h.n = i + 1; delete h._i; });

        /* supplier-level view */
        const inv = refs.map(r => Object.assign({ ref: r }, st[r]));
        inv.forEach(v => { out.inv[v.ref] = v; });
        const worst = inv.slice().sort((a, b) => ST[a.st].rank - ST[b.st].rank)[0];
        const sum = f => refs.filter(r => f(st[r].st)).reduce((a, r) => a + INV[r].stuck, 0);
        const open = sum(x => !["recovered", "removed", "lost"].includes(x));
        const fyOpen = refs.filter(r => INV[r].fy === "2025-26" && !["recovered", "removed", "lost"].includes(st[r].st)).reduce((a, r) => a + INV[r].stuck, 0);
        const promisedDates = inv.filter(v => v.st === "promised" && v.date).map(v => v.date).sort();
        let status = worst.st;
        if ((next.kind === "decision" || pending.length) && ST[status].group !== "needs") status = "review";
        const v = {
          id: sid, s, inv, status, label: status === "promised" && promisedDates[0] ? "Promised " + fd(promisedDates[0], false) : ST[status].label,
          group: ST[status].group, open, fyOpen, recovered: sum(x => x === "recovered"), lost: sum(x => x === "lost"), removed: sum(x => x === "removed"),
          openN: refs.filter(r => !["recovered", "removed", "lost"].includes(st[r].st)).length, n: refs.length,
          promised: promisedDates[0] || null, next, history: H, flags, contact, channel: chan, pending: [],
          filing: t >= 1 && sim.filing_t1 ? sim.filing_t1 : s.filing, acted, decision: dec || null,
          lastActivity: H.filter(h => h.major && h.date <= today).slice(-1)[0] || null,
        };
        v.priority = (R("R8") && fyOpen > 0 ? 0 : 1);
        out.sup[sid] = v;
        v.pending = [next, ...pending].filter(x => x && x.kind === "decision");
        v.routineItems = v.pending.filter(x => x.routine && t === 0);
        if (next.kind === "decision" && !next.routine) out.decisions.push(sid);
        if (v.routineItems.length) out.routine.push(sid);
      }
      /* totals */
      const tot = { flagged: 0, recovered: 0, lost: 0, removed: 0, open: 0, fyOpen: 0, openN: 0 };
      for (const x of W.invoices) {
        const v = out.inv[x.ref]; tot.flagged += x.stuck;
        if (v.st === "recovered") tot.recovered += x.stuck; else if (v.st === "lost") tot.lost += x.stuck; else if (v.st === "removed") tot.removed += x.stuck;
        else { tot.open += x.stuck; tot.openN++; if (x.fy === "2025-26") tot.fyOpen += x.stuck; }
      }
      out.tot = tot;
      const needs = Object.values(out.sup).filter(v => v.group === "needs");
      const needInv = needs.flatMap(v => v.inv.filter(x => ST[x.st].group === "needs"));
      out.needs = { n: needs.length, amount: needInv.reduce((a, x) => a + INV[x.ref].stuck, 0), invoices: needInv.length };
      out.counts = {}; GROUPS.forEach(g => { out.counts[g.id] = Object.values(out.sup).filter(v => v.group === g.id).length; });
      if (!opt.noCounterfactual && t >= 1) {
        const base = derive(Object.assign({}, S, { acts: {}, reviews: {} }), { noCounterfactual: true });
        out.counterfactual = { recovered: base.tot.recovered, lost: base.tot.lost, open: base.tot.open };
      }
      return out;
    }

    /* ---------- order for the inbox ---------- */
    function inboxOrder(D, sortBy = "priority") {
      const gRank = { needs: 0, lost: 1, promised: 2, waiting: 3, ims: 4, fixed: 5 };
      const vs = Object.values(D.sup);
      if (sortBy === "amount") return vs.sort((a, b) => b.open - a.open || a.s.name.localeCompare(b.s.name));
      if (sortBy === "name") return vs.sort((a, b) => a.s.name.localeCompare(b.s.name));
      return vs.sort((a, b) => gRank[a.group] - gRank[b.group] || a.priority - b.priority || (a.group === "promised" ? (a.promised || "").localeCompare(b.promised || "") : 0) || b.open - a.open);
    }

    /* ---------- facts for the AI: one supplier, as the app shows it ---------- */
    function payRule(v, S) {
      const s = v.s, rules = S.rules || DEFAULT_RULES, settings = S.settings || DEFAULT_SETTINGS;
      if (udyamProtected(s)) return `${s.udyam} enterprise: payments are due within 45 days (MSMED Act), so the tool never suggests holding them. Next payment ${inr(s.payment.amount)} due ${fd(s.payment.due)}.`;
      const old = W.invoices.filter(x => x.sid === s.id && days(x.date, s.payment.due) > 180).map(x => x.ref);
      return `Not a micro or small enterprise. Next payment ${inr(s.payment.amount)} due ${fd(s.payment.due)}.` + (old.length ? ` ${listAnd(old)} ${old.length > 1 ? "are" : "is"} more than 180 days old, so their credit can only be kept once paid (Rule 37).` : "") + ` Payment-hold suggestions are ${settings.holds && rules.R6 && rules.R6.on ? "on" : "off"} in Company settings.`;
    }
    function filingLine(f) {
      const one = (k, m) => { const x = f[k][m]; return x === "due" ? `${m} due 20 Oct` : x ? `${m} filed ${fd(x, false)}` : `${m} not filed`; };
      return `GSTR-1: ${one("gstr1", "Aug")}, ${one("gstr1", "Sep")}. GSTR-3B: ${one("gstr3b", "Aug")}, ${one("gstr3b", "Sep").replace("due 20 Oct", "not yet due")}.`;
    }
    function majorHistory(v) { return v.history.filter(h => h.major && !h.undone); }
    function entryLine(h, i) {
      let text = h.text;
      if (h.kind === "message_in" && REPLY[h.msg]) text = `Reply on ${REPLY[h.msg].channel}: "${REPLY[h.msg].text.replace(/\s*\n\s*/g, " / ")}"`;
      return `[${i + 1}] ${fd(h.date)} · ${h.actor} · ${text}`;
    }
    function nextLine(v) {
      const n = v.next; if (!n) return "None.";
      if (n.kind === "decision") return `Waiting for the GST lead's decision: ${n.title}.` + (n.why ? ` Why: ${n.why}` : "") + (n.also ? ` Also: ${n.also}.` : "") + (n.hold && n.hold.refs.length ? ` Rule R6 allows a GST-only hold on ${listAnd(n.hold.refs)} only (${inr(n.hold.amount)}).` : "");
      return n.text.replace(/\.$/, "") + ".";
    }
    function facts(v, D, S) {
      const s = v.s; const lines = [];
      lines.push(`Supplier: ${s.name}, ${s.city} (GSTIN ${s.gstin})${s.udyam ? ", " + s.udyam + " enterprise" : ""}. Supplies our ${UNITS[s.unit].name} unit (GSTIN ${UNITS[s.unit].gstin}). Contact: ${v.contact.name} on ${v.channel} (${s.language}). Relationship owner: ${s.owner}.`);
      lines.push(`Track record: ${s.history}.`);
      lines.push(`Payment rule: ${payRule(v, S)}`);
      lines.push(`Supplier's returns on the GST portal: ${filingLine(v.filing)}`);
      lines.push(`Credit: ${inr(v.open)} open across ${v.openN} ${plural(v.openN, "invoice")}${v.recovered ? "; " + inr(v.recovered) + " recovered" : ""}${v.lost ? "; " + inr(v.lost) + " lost" : ""}${v.removed ? "; " + inr(v.removed) + " removed as a duplicate (never real credit)" : ""}.`);
      lines.push("Invoices:");
      v.inv.forEach(x => { const I = INV[x.ref]; lines.push(`- ${x.ref} · ${fd(I.date)} · FY ${I.fy} · GST ${inr(I.gst)} · ${issueText(I)}${I.stuck !== I.gst ? " · credit short " + inr(I.stuck) : ""} · Status: ${ST[x.st].label}${x.st === "promised" && x.date ? " " + fd(x.date) : ""}${x.note ? " (" + x.note + ")" : ""}`); });
      v.flags.forEach(f => lines.push("Risk: " + f.text));
      lines.push(`Next step (decided by the tool's rules, not by AI): ${nextLine(v)}`);
      lines.push("History:");
      majorHistory(v).forEach((h, i) => lines.push(entryLine(h, i)));
      return lines.join("\n");
    }
    function issueText(x) {
      if (x.issue === "value") return `supplier reported GST ${inr(x.twob.gst)} instead of ${inr(x.gst)}`;
      if (x.issue === "tax_type") return "reported as IGST; should be CGST + SGST";
      if (x.issue === "number") return `GSTR-2B shows it as ${x.twob.ref}`;
      if (x.issue === "duplicate") return "possible duplicate of ST/2231 in our books";
      if (x.sid === "S02") return "missing from Pune's GSTR-2B; found under Manesar";
      return "missing from our GSTR-2B";
    }
    function summaryPrompt(v, D, S) { return W.prompts.summary.replace("{today}", fd(D.today)).replace("{facts}", facts(v, D, S)); }
    function qaPrompt(v, D, S, q) { return W.prompts.qa.replace("{today}", fd(D.today)).replace("{facts}", facts(v, D, S)).replace("{question}", q); }
    /* the state a recorded summary belongs to */
    function signature(v, D, S) {
      /* structural: wording changes do not invalidate a recorded answer, but any change of facts does */
      const n = v.next || {}; const settings = S.settings || DEFAULT_SETTINGS; const rules = S.rules || DEFAULT_RULES;
      const parts = [D.today, v.contact.name, v.channel, "holds:" + (!udyamProtected(v.s) && settings.holds && rules.R6 && rules.R6.on ? 1 : 0),
        ...v.inv.map(x => x.ref + ":" + x.st + ":" + (x.date || "")),
        "next:" + [n.kind, n.when || "", n.draft || "", n.action || "", n.hold ? n.hold.refs.join(",") : "", n.also ? "also" : ""].join(":"),
        ...v.pending.slice(1).map(x => "pend:" + x.draft + ":" + x.when),
        ...majorHistory(v).map(h => h.key + "@" + h.date), ...v.flags.map(f => f.id), v.open, v.recovered, v.lost, v.removed];
      return hash(parts.join("|"));
    }

    /* ---------- checks on AI text that cites the history ---------- */
    function factTokens(text) {
      const amounts = new Set(); const ar = /(?:₹|Rs\.?)\s?(\d[\d,]*(?:\.\d+)?)\s*(lakh|L\b|crore)?/g; let am;
      while ((am = ar.exec(text))) { let n = parseFloat(am[1].replace(/,/g, "")); if (am[2] === "lakh" || am[2] === "L") n *= 100000; if (am[2] === "crore") n *= 10000000; amounts.add(String(Math.round(n))); }
      const dates = new Set(); const re = /\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/g; let m;
      while ((m = re.exec(text))) dates.add(m[1] + " " + m[2]);
      return { amounts, dates };
    }
    function checkCited(textParts, v, D, S, opts = {}) {
      const F = facts(v, D, S) + "\nToday: " + fd(D.today); const ft = factTokens(F); const all = textParts.join(" ");
      const checks = []; const nMax = majorHistory(v).length;
      const cites = []; (all.match(/\[(\d+(?:\s*,\s*\d+)*)\]/g) || []).forEach(c => c.replace(/[\[\]\s]/g, "").split(",").forEach(n => cites.push(+n)));
      const badCite = cites.filter(n => !(n >= 1 && n <= nMax));
      checks.push(!cites.length ? { ok: false, t: "No history entry cited" } : badCite.length ? { ok: false, t: "Cites entries that do not exist: " + badCite.join(", ") } : { ok: true, t: `Every citation points to a real history entry (${new Set(cites).size} cited)` });
      const at = factTokens(all);
      const badAmt = [...at.amounts].filter(a => !ft.amounts.has(a));
      checks.push(badAmt.length ? { ok: false, t: "Amounts not in the records: " + badAmt.map(a => inr(+a)).join(", ") } : { ok: true, t: "Every amount matches the records" });
      const badDate = [...at.dates].filter(d => !ft.dates.has(d));
      checks.push(badDate.length ? { ok: false, t: "Dates not in the records: " + badDate.join(", ") } : { ok: true, t: "Every date matches the records" });
      const refsKnown = new Set(W.invoices.map(x => x.ref));
      const refLike = (all.match(/\b[A-Z]{2,4}[\/-][\w\/-]*\d[\w\/-]*\b/g) || []).filter(r => /\d/.test(r) && /\//.test(r));
      const badRef = refLike.filter(r => !refsKnown.has(r) && !/^(GSTR|FY|AA)/.test(r) && !r.startsWith("MC/26-27/0412") && !/^(PO|GRN)-/.test(r));
      checks.push(badRef.length ? { ok: false, t: "Invoice numbers not in the records: " + badRef.join(", ") } : { ok: true, t: "Every invoice number exists" });
      if (opts.maxWords) { const w = all.replace(/\[[\d,\s]+\]/g, "").split(/\s+/).filter(Boolean).length; checks.push(w <= opts.maxWords ? { ok: true, t: `Length ${w} words (limit ${opts.maxWords})` } : { ok: false, t: `Too long: ${w} words (limit ${opts.maxWords})` }); }
      return { ok: checks.every(c => c.ok), checks, cites: [...new Set(cites)] };
    }
    /* citations [n] in AI text → the entry keys they point to, so they survive later entries */
    function citeKeys(v) { return majorHistory(v).map(h => h.key); }

    /* ---------- the facts-only fallback (written by code, no AI) ---------- */
    function factsOnly(v, D) {
      const hs = majorHistory(v); const idx = k => hs.findIndex(h => h.key === k) + 1;
      const parts = [];
      const lastIn = [...hs].reverse().find(h => h.kind === "reading");
      if (v.open || v.lost) parts.push(`${v.openN} ${plural(v.openN, "invoice")} open with ${inr(v.open)} of credit${v.recovered ? "; " + inr(v.recovered) + " recovered" : ""}${v.lost ? "; " + inr(v.lost) + " lost" : ""} [${idx(hs[0].key)}].`);
      else parts.push(`Nothing open: ${inr(v.recovered)} recovered${v.removed ? ", " + inr(v.removed) + " removed as a duplicate" : ""} [${hs.length}].`);
      if (lastIn) { const g = reading(lastIn.reading); parts.push(`Latest reply (${fd(REPLY[lastIn.reading].date, false)}, read as "${INTENT_TEXT[g.intent].toLowerCase()}"): ${g.summary.replace(/\.$/, "")} [${idx(lastIn.key)}].`); }
      const last = hs[hs.length - 1]; if (last && last !== lastIn) parts.push(`Last event (${fd(last.date, false)}): ${last.text.split(". ")[0].replace(/\.$/, "")} [${hs.length}].`);
      return { summary: parts.join(" "), points: [nextLine(v).replace(/\.$/, "")] };
    }

    /* ---------- draft checks (before a message can be approved) ---------- */
    function checkDraft(id, text, subject) {
      const d = W.draftMeta[id]; const s = SUP[d.sid]; const checks = [];
      const words = String(text || "").split(/\s+/).filter(Boolean).length; const lim = d.channel === "WhatsApp" ? 80 : 140;
      checks.push(words <= lim ? { ok: true, t: `Length ${words} words (limit ${lim})` } : { ok: false, t: `Over the length limit: ${words} words (limit ${lim})` });
      const missingRefs = d.refs.filter(r => !text.includes(r) && !text.includes(r.split("/").pop()));
      checks.push(missingRefs.length ? { ok: false, t: "Invoices not mentioned: " + missingRefs.join(", ") } : { ok: true, t: "Every invoice is listed" });
      const allowed = new Set(); d.refs.forEach(r => { allowed.add(String(INV[r].gst)); allowed.add(String(INV[r].taxable)); allowed.add(String(INV[r].stuck)); if (INV[r].twob && INV[r].twob.gst) { allowed.add(String(INV[r].twob.gst)); allowed.add(String(INV[r].twob.taxable)); } });
      allowed.add(String(s.payment.amount)); allowed.add("412000");
      const amts = (String(text).match(/(?:₹|\bRs\.?|\bINR|\brupees)\s?[\d,]+(?:\.\d+)?/gi) || []).map(a => a.replace(/[^\d.]/g, "").replace(/^\.+/, "").replace(/\.\d*$/, "")).filter(a => !allowed.has(a));
      checks.push(amts.length ? { ok: false, t: "Amounts not in the records: " + amts.map(a => inr(+a)).join(", ") } : { ok: true, t: "Every amount matches the records" });
      const payWords = /\b(hold|holding|withhold|withholding|freez(?:e|ing)|frozen|settlement|stop(?:ped|ping)? (?:the |your )?payment|block(?:ed|ing)? (?:the |your )?payment|delay(?:ed|ing)? (?:the |your )?payment|release .*after|(?:until|unless) you (?:file|upload|fix)|legal action|penalt(?:y|ies)|blacklist)/i.test(text);
      checks.push(payWords ? { ok: false, t: "Mentions holding or delaying payment" } : { ok: true, t: "No payment pressure" });
      checks.push(text.includes(W.user.name) ? { ok: true, t: "Signed by " + W.user.name } : { ok: false, t: "Sender's name missing" });
      if (d.channel === "Email") checks.push(subject ? { ok: true, t: "Has a subject line" } : { ok: false, t: "Subject line missing" });
      return { ok: checks.every(c => c.ok), checks, words, lim };
    }

    return { derive, inboxOrder, facts, summaryPrompt, qaPrompt, signature, checkCited, citeKeys, majorHistory, factsOnly, checkDraft, guard, reading, issueText, payRule, filingLine, nextLine, DECISION, SUP, INV, REPLY, refsOf, udyamProtected };
  }

  const API = { createModel, freshState, fd, days, addDays, wday, inr, lakh, plural, listAnd, hash, norm, MON, MONTH, T_DATES, T_LABEL, ST, GROUPS, INTENTS, HUMAN_INTENTS, INTENT_TEXT, STEP_TEXT, RULES_META, RULE_TEMPLATES, DEFAULT_RULES, DEFAULT_SETTINGS, PROMPT_VERSIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.SFA = API;
})(typeof window !== "undefined" ? window : globalThis);
