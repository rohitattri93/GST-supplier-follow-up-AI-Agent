/* End-to-end journeys for the prototype. Live AI and downloads are mocked; CDN libraries are served locally. */
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const URL = "file://" + path.resolve(__dirname, "../dist/index.html");
const SHOTS = path.resolve(__dirname, "../shots");
const VENDOR = { "html2canvas.min.js": path.join(__dirname, "vendor/node_modules/html2canvas/dist/html2canvas.min.js"), "jspdf.umd.min.js": path.join(__dirname, "vendor/node_modules/jspdf/dist/jspdf.umd.min.js") };
let pass = 0, fail = 0; const errors = [];
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ✓", msg); } else { fail++; console.log("  ✗", msg); } };
const MOCK = () => {
  window.__calls = []; window.__failQuickOnce = false;
  const refsIn = p => [...p.matchAll(/^- ([A-Z][A-Z0-9\/-]+) \| /gm)].map(m => m[1]);
  window.__answer = (prompt, opts) => {
    if (prompt.startsWith('You write the "Where things stand"')) {
      if (window.__failQuickOnce && opts.modelTier === "quick") { window.__failQuickOnce = false; return JSON.stringify({ summary: "Something with a wrong amount ₹99,999 [1].", points: [] }); }
      return JSON.stringify({ summary: "Live summary: the supplier promised a fix [1].", points: ["Watch the next GSTR-2B [2]."] });
    }
    if (prompt.startsWith("You answer a GST lead's question")) return JSON.stringify({ answer: "Live answer from the records [1].", found: true });
    if (prompt.startsWith("You write a message")) { const refs = refsIn(prompt); return JSON.stringify({ subject: prompt.includes("for Email") ? "Live subject" : "", body: "Dear supplier,\nPlease fix:\n" + refs.map(r => "- " + r).join("\n") + "\n\nAbhishek Attri\nGST team" }); }
    if (prompt.startsWith("You read a supplier's reply")) { const reply = prompt.split('"""\n')[1].split('\n"""')[0]; return JSON.stringify({ intent: "will_fix", summary: "Live reading of the reply.", invoices: [], promised_date: null, date_text: null, arn: null, language: "Hinglish", tone: "cooperative", risk_flags: [], next_step: "verify_in_next_2b", follow_up_on: null, evidence: [reply.slice(0, 12)], confidence: "high", needs_human: false, reason_for_human: null, draft_reply: "Thanks." }); }
    return "{}";
  };
  window.claude = { use: async name => {
    if (name === "sample") return async (prompt, opts = {}) => { window.__calls.push({ kind: prompt.slice(0, 30), tier: opts.modelTier }); await new Promise(r => setTimeout(r, 30)); return { text: window.__answer(prompt, opts), truncated: false, modelTierApplied: opts.modelTier || "default" }; };
    if (name === "downloads") return { save: async ({ filename, data }) => { window.__saved = { filename, size: data.size || data.byteLength || data.length }; return { status: "saved" }; } };
    return null;
  } };
};
(async () => {
  const browser = await chromium.launch((require("fs").existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" } : {}));
  const mk = async (opts = {}, mock = true) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts));
    await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(html2canvas\.min\.js|jspdf\.umd\.min\.js)$/, r => r.fulfill({ path: VENDOR[r.request().url().split("/").pop()], contentType: "application/javascript" }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    if (mock) await page.addInitScript(MOCK);
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error" && !/ERR_FAILED|net::|fonts/.test(m.text())) errors.push("console: " + m.text()); });
    return page;
  };
  const txt = async (p, sel) => (await p.textContent(sel) || "").replace(/\s+/g, " ").trim();
  const rows = p => p.$$eval(".inbox-tbl tbody tr", rs => rs.length);
  const settle = p => p.waitForTimeout(120);

  console.log("J1 sign in");
  let p = await mk();
  await p.goto(URL); await p.fill("#email", ""); await p.click("#loginForm button[type=submit]");
  ok((await txt(p, "#loginError")).includes("Enter the demo email"), "empty fields are rejected");
  await p.fill("#email", "someone@kestrel.demo"); await p.click("#loginForm button[type=submit]");
  ok((await txt(p, "#loginError")).includes("abhishek.attri@kestrel.demo"), "wrong details explain the demo login");
  await p.fill("#email", "abhishek.attri@kestrel.demo"); await p.click("#showPw"); ok(await p.getAttribute("#password", "type") === "text", "show password works");
  await p.click("#loginForm button[type=submit]"); await p.waitForSelector("#inboxTitle");
  ok((await txt(p, "#inboxTitle")) === "11 suppliers need you today", "inbox opens with 11 suppliers needing a decision");

  console.log("J2 inbox filters, chips, search, sort");
  ok(await rows(p) === 16, "16 suppliers listed");
  await p.selectOption("#fOwner", "Priya Menon"); await settle(p); ok(await rows(p) === 5, "owner filter: 5 for Priya Menon");
  await p.click('[data-action="clear-filters"]'); await settle(p);
  await p.click('[data-action="chip"][data-group="promised"]'); await settle(p); ok(await rows(p) === 4, "Promised chip: 4");
  await p.click('[data-action="chip"][data-group=""]'); await p.fill("#inboxQ", "nova"); await p.waitForTimeout(400); ok(await rows(p) === 1, "search finds Nova");
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === "inboxQ", "search keeps focus while typing");
  await p.fill("#inboxQ", ""); await p.waitForTimeout(400);
  await p.selectOption("#fSort", "amount"); await settle(p); ok((await txt(p, ".inbox-tbl tbody tr:first-child .sup-name")) === "Nova Polymers", "sort by credit puts Nova first");
  await p.selectOption("#fSort", "priority"); await settle(p);
  await p.fill("#gsearch", "1182"); await settle(p); ok((await p.$$(".search-res button")).length >= 1, "global search finds invoice 1182");
  await p.fill("#gsearch", ""); await settle(p);

  console.log("J3 bulk approve routine messages");
  await p.click('[data-action="select-routine"]'); await settle(p);
  await p.click('[data-action="bulk-approve"]'); await p.waitForSelector(".modal"); await p.click('[data-action="bulk-confirm"]'); await settle(p);
  let st = await p.evaluate(() => [D.sup.S15.status, D.sup.S16.status]); ok(st[0] === "awaiting" && st[1] === "awaiting", "Delta and Orbit move to Waiting");
  await p.click(".toast button"); await settle(p);
  st = await p.evaluate(() => [D.sup.S15.status, D.sup.S16.status]); ok(st[0] === "new" && st[1] === "new", "undo puts them back to Not contacted");
  ok(await p.evaluate(() => D.sup.S15.history.some(h => h.undone)), "the undone message stays in the history, marked undone");

  console.log("J4 Nova: approve the escalation, undo, approve again");
  await p.click("#row-S04"); await p.waitForSelector("#nextCard");
  ok((await txt(p, "#nextCard")).includes("No payment hold suggested"), "explains why no payment hold is suggested");
  ok((await txt(p, "#checks-X-S04")).includes("142 words"), "length check warns at 142 words but does not block");
  await p.click('[data-action="send-ask"]'); await p.click('[data-action="send-confirm"]'); await settle(p);
  ok(await p.evaluate(() => D.sup.S04.status === "awaiting"), "Nova waits for a reply after sending");
  ok(await p.evaluate(() => D.sup.S04.history.some(h => h.kind === "owner_alert" && /Priya/.test(h.text))), "Priya Menon is alerted and copied");
  await p.click(".toast button"); await settle(p);
  ok(await p.evaluate(() => D.sup.S04.status === "review"), "undo returns Nova to Needs you");
  await p.fill("#body-X-S04", (await p.inputValue("#body-X-S04")).replace("Thanks for your reply. ", ""));
  ok(!(await txt(p, "#checks-X-S04")).includes("Over the length"), "editing below 140 words clears the warning");
  await p.click('[data-action="send-ask"]'); await p.click('[data-action="send-confirm"]'); await settle(p);
  ok(await p.evaluate(() => S.acts["send:X-S04"].edit && D.sup.S04.history.some(h => /edited and approved/.test(h.actor))), "edited message is recorded as edited by Abhishek");
  ok(await p.evaluate(() => Object.keys(S.acts).some(k => k.startsWith("send:X-S04~"))), "the first, undone send is kept in the audit trail");

  console.log("J5 Shree Ganesh: citations, recorded answer, confirm reading");
  await p.goto(URL + "#supplier-S01"); await p.waitForSelector("#sumCard");
  ok((await txt(p, "#sumCard .meta-line")).includes("Recorded answer"), "summary is labelled as a recorded answer");
  ok((await txt(p, "#sumCard")).includes("4 of 4 checks passed"), "summary passed all code checks");
  await p.click("#sumCard .cite"); await settle(p); ok((await p.$$(".hentry.flash")).length === 1, "citation jumps to and highlights the history entry");
  await p.click('[data-action="ask-rec"][data-i="1"]'); await settle(p);
  ok((await txt(p, "#askCard .bubble-a")).toLowerCase().includes("micro"), "recorded answer explains the micro-enterprise payment rule");
  await p.click('[data-action="confirm-reading"]').catch(() => { }); await settle(p);
  ok(await p.evaluate(() => S.reviews.D01 && S.reviews.D01.verdict === "confirmed"), "reading confirmed");

  console.log("J6 correct a reading, then undo");
  await p.goto(URL + "#supplier-S05"); await p.waitForSelector("#replyCard");
  await p.click('[data-action="correct-open"]'); await p.selectOption("#corrIntent", "unclear"); await p.fill("#corrReason", "Test correction"); await p.click('[data-action="correct-save"]'); await settle(p);
  ok(await p.evaluate(() => D.sup.S05.status === "review"), "a correction that needs judgement brings the supplier to Needs you");
  ok((await txt(p, "#sumCard .meta-line")).includes("Facts only"), "summary falls back to facts-only, not stale AI");
  await p.click('[data-action="undo-correction"]'); await settle(p);
  ok(await p.evaluate(() => D.sup.S05.status === "promised"), "undoing the correction restores the promise");

  console.log("J7 our own books: Mehta and Sai Tooling");
  await p.goto(URL + "#supplier-S06"); await p.waitForSelector("#nextCard"); await p.click('[data-action="book"]'); await settle(p);
  ok(await p.evaluate(() => D.sup.S06.status === "recovered"), "Mehta is fixed by correcting our entry");
  await p.goto(URL + "#supplier-S11"); await p.waitForSelector("#nextCard"); await p.click('[data-action="dup"]'); await settle(p);
  ok(await p.evaluate(() => D.inv["ST/2231-B"].st === "removed"), "duplicate removed from our books");

  console.log("J8 rules: change, preview, apply, add, delete");
  await p.goto(URL + "#rules"); await p.waitForSelector("#rulesCard");
  await p.fill("#param-R1", "5"); await p.dispatchEvent("#param-R1", "change"); await p.waitForSelector("#diffPanel");
  ok((await txt(p, "#diffPanel")).includes("Reminder on 6 Nov"), "preview shows reminders moving to 6 Nov");
  ok(await p.inputValue("#param-R1") === "5", "the field keeps the proposed value during preview");
  await p.click('[data-action="rule-apply"]'); await settle(p);
  ok(await p.evaluate(() => D.sup.S01.next.text.includes("6 Nov")), "Shree Ganesh's reminder is now 6 Nov");
  ok(await p.evaluate(() => S.ruleLog.length === 1), "rule change logged in rule history");
  await p.click('[data-action="rule-add-open"]'); await p.click('[data-action="rule-add-pick"][data-rule="R10"]'); await settle(p);
  ok((await txt(p, ".diff")).includes("Apex"), "adding the large-amount rule previews Apex needing approval");
  await p.click('[data-action="rule-add-save"]'); await settle(p);
  ok(await p.evaluate(() => D.routine.includes("S08")), "Apex's follow-up now needs approval");
  await p.click('[data-action="rule-del"][data-rule="R10"]'); await p.click('[data-action="rule-del"][data-rule="R10"]'); await settle(p);
  ok(await p.evaluate(() => !S.rules.R10 && !D.routine.includes("S08")), "deleting the rule needs a second click and then restores automation");

  console.log("J9 company settings");
  await p.click("#set-auto + .track"); await settle(p);
  ok(await p.evaluate(() => D.routine.length >= 6), "automatic reminders off: routine reminders need approval");
  await p.click("#set-auto + .track"); await settle(p);
  await p.click("#set-wa + .track"); await settle(p);
  ok(await p.evaluate(() => D.sup.S01.channel === "Email"), "WhatsApp off: Shree Ganesh is written to by email");
  await p.click("#set-wa + .track"); await settle(p);
  await p.click("#set-holds + .track"); await settle(p);
  ok(await p.evaluate(() => { const f = SFA.freshState(); f.settings = Object.assign({}, S.settings); const h = M.derive(f).sup.S04.next.hold; return JSON.stringify(h && h.refs) === '["NP/2627/0215"]'; }), "hold suggestions on: only the July invoice qualifies (others are past 150 days)");
  ok(await p.evaluate(() => !D.sup.S01.next.hold), "never for a micro enterprise");
  await p.click("#set-holds + .track"); await settle(p);
  await p.click("#set-ai + .track"); await settle(p);
  await p.goto(URL + "#supplier-S01"); await p.waitForSelector("#sumCard");
  ok((await txt(p, "#sumCard .meta-line")).includes("AI is off"), "AI off: summary is facts-only");
  ok((await txt(p, "#replyCard")).includes("AI's reading is hidden"), "AI off: reading hidden, manual mode offered");
  await p.goto(URL + "#rules"); await p.click("#set-ai + .track"); await settle(p);

  console.log("J10 live AI (mocked): summary with retry, ask, redraft, try a reply");
  await p.goto(URL + "#supplier-S12"); await p.waitForSelector("#sumCard");
  await p.evaluate(() => { window.__failQuickOnce = true; });
  await p.click('[data-action="sum-live"]'); await p.waitForFunction(() => document.querySelector("#sumCard .meta-line") && /live/.test(document.querySelector("#sumCard .meta-line").textContent));
  ok((await txt(p, "#sumCard .meta-line")).includes("retried on a larger model"), "a live summary that fails the checks is retried on a larger model");
  ok(await p.evaluate(() => window.__calls.filter(c => c.kind.startsWith("You write the")).map(c => c.tier).join(",") === "quick,default"), "quick tier first, then default");
  await p.fill("#askIn-S12", "What is the Rule 37A risk?"); await p.click('#askCard button[type="submit"]'); await p.waitForFunction(() => /Live answer/.test(document.querySelector("#askCard").textContent));
  ok(true, "typed question answered live with citations");
  await p.click('[data-action="redraft"]'); await p.waitForFunction(() => document.querySelector("#body-X-S12") && /Please fix/.test(document.querySelector("#body-X-S12").value));
  ok((await txt(p, "#draft-X-S12 .meta-line")).includes("live"), "draft rewritten live and labelled");
  await p.click('[data-action="try-tab"][data-tab="live"]'); await p.fill("#tryText-S12", "Sir 11 Nov tak kar denge"); await p.click('[data-action="try-live"]'); await p.waitForFunction(() => /Live reading/.test(document.querySelector("#tryCard").textContent));
  ok(true, "own reply read live and checked");

  console.log("J11 case file PDF");
  await p.goto(URL + "#supplier-S01"); await p.waitForSelector("#sumCard");
  await p.click('[data-action="casefile"]'); await p.waitForSelector("#casePages");
  const pages = await p.$$eval("#casePages .a4", x => x.length); ok(pages >= 2, `case file preview has ${pages} pages`);
  await p.click('[data-action="pdf"]'); await p.waitForFunction(() => window.__saved, null, { timeout: 30000 });
  const saved = await p.evaluate(() => window.__saved); ok(saved.size > 40000 && /\.pdf$/.test(saved.filename), `PDF made through the downloads capability (${Math.round(saved.size / 1024)} KB)`);
  await p.click('[data-action="modal-close"]');

  console.log("J12 time travel and outcomes");
  await p.goto(URL + "#inbox"); await p.waitForSelector("#inboxTitle");
  // act on every 15 Oct decision for a full run
  for (const sid of ["S02", "S03", "S09", "S10", "S12", "S13"]) { await p.goto(URL + "#supplier-" + sid); await p.waitForSelector("#nextCard"); const b = await p.$('[data-action="send-ask"]'); if (b) { await b.click(); await p.click('[data-action="send-confirm"]'); await settle(p); } }
  await p.goto(URL + "#inbox"); await p.click('[data-action="select-routine"]'); await p.click('[data-action="bulk-approve"]'); await p.click('[data-action="bulk-confirm"]'); await settle(p);
  ok(await p.evaluate(() => D.counts.needs === 0), "every 15 Oct decision is taken");
  await p.click('[data-action="time-next"]'); await p.waitForSelector(".modal"); ok((await txt(p, ".modal")).includes("What happened while you were away"), "12 Nov summary appears");
  await p.click('.modal [data-action="modal-close"]'); await settle(p);
  ok(await p.evaluate(() => D.sup.S05.status === "broken"), "Krishna's broken promise is caught on 12 Nov (rule R5)");
  await p.click('[data-action="ims-accept"]'); await settle(p); ok(await p.evaluate(() => S.acts["ims:accept"] && !S.acts["ims:accept"].undone), "IMS records accepted");
  await p.goto(URL + "#supplier-S05"); await p.waitForSelector("#nextCard"); await p.click('[data-action="send-ask"]'); await p.click('[data-action="send-confirm"]'); await settle(p);
  ok(await p.evaluate(() => D.sup.S05.history.some(h => h.msg === "F-S05" && !h.undone)), "firmer message sent on 12 Nov");
  await p.click('[data-action="time-next"]'); await p.waitForSelector(".modal"); await p.click('.modal [data-action="modal-close"]'); await settle(p);
  const res = await p.evaluate(() => ({ rec: D.tot.recovered, lost: D.tot.lost, cf: D.counterfactual }));
  ok(res.lost === 0 && res.rec > res.cf.recovered && res.cf.lost === 625500, `14 Nov: recovered ${res.rec}, lost ${res.lost}; doing nothing would recover ${res.cf.recovered} and lose ${res.cf.lost}`);
  await p.goto(URL + "#dashboard"); await p.waitForSelector("#aiQuality"); await p.screenshot({ path: SHOTS + "/j-dashboard-t2.png", fullPage: true });
  await p.click('[data-action="time-reset"]'); await settle(p); ok(await p.evaluate(() => S.t === 0), "back to 15 Oct");

  console.log("J13 tour");
  await p.goto(URL + "#inbox"); await p.click('[data-action="tour-start"]'); await p.waitForSelector("#tourBox");
  for (let i = 0; i < 5; i++) { await p.click('[data-action="tour-next"]'); await p.waitForTimeout(250); }
  ok((await txt(p, "#tourBox")).includes("6 of 6"), "tour reaches step 6");
  await p.click('[data-action="tour-next"]'); await settle(p); ok(!(await p.$("#tourBox")), "tour finishes");

  console.log("J14 reset");
  await p.click('[data-action="menu"][data-menu="user"]'); await p.click('[data-action="ask-reset"]'); await p.click('[data-action="reset"]'); await settle(p);
  ok(await p.evaluate(() => Object.keys(S.acts).length === 0 && S.t === 0 && S.rules.R1.n === 2), "reset clears decisions, rules and date");

  console.log("J15 phone and dark mode");
  const ph = await mk({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await ph.goto(URL); await ph.click("#loginForm button[type=submit]"); await ph.waitForSelector("#inboxTitle");
  for (const h of ["inbox", "supplier-S04", "supplier-S01", "supplier-S12", "rules", "dashboard", "about"]) {
    await ph.goto(URL + "#" + h); await ph.waitForTimeout(250);
    const w = await ph.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    ok(w[0] <= w[1], `no sideways scroll on ${h} at 390 px (${w[0]})`);
  }
  await ph.goto(URL + "#inbox"); await ph.click('[data-action="side-open"]'); await ph.waitForTimeout(250);
  ok(await ph.evaluate(() => document.querySelector(".side").classList.contains("open")), "menu drawer opens on phone");
  const bg = await ph.evaluate(() => getComputedStyle(document.body).backgroundColor); ok(bg !== "rgb(244, 246, 250)", "dark theme applies (" + bg + ")");
  await ph.click('.side a[href="#dashboard"]'); await ph.waitForTimeout(250); await ph.screenshot({ path: SHOTS + "/j-phone-dark-dashboard.png", fullPage: true });

  console.log("J16 no live AI available (as most viewers see it)");
  const nl = await mk({}, false);
  await nl.goto(URL); await nl.click("#loginForm button[type=submit]"); await nl.goto(URL + "#supplier-S01"); await nl.waitForSelector("#askCard");
  ok(await nl.$eval("#askIn-S01", e => e.disabled), "live question box is disabled with an explanation");
  ok((await txt(nl, "#sumCard .meta-line")).includes("Recorded answer"), "recorded summary still shown");
  await nl.waitForTimeout(400);

  console.log(errors.length ? "\nERRORS:\n" + errors.join("\n") : "\nno page errors");
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error("FAILED", e); process.exit(1); });
