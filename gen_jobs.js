/* Builds the recording jobs for supplier summaries (every canonical state) and suggested questions (15 Oct state). */
const fs = require("fs"); const SFA = require("./model.js"); const { load, P } = require("./load.js");
const { W, B } = load(); const M = SFA.createModel(W, B);
const QUESTIONS = {
  S01: ["What exactly did Mahesh promise, and how will we know it's done?", "Should we hold their 30 Oct payment until this is fixed?", "Is any of this credit at risk of being lost?"],
  S02: ["They say they filed. Why is the credit still stuck?", "What should our message to Hitesh ask for?", "How reliable is Patel Steel at fixing issues?"],
  S03: ["Why is only ₹2,520 stuck when the invoice has ₹74,160 of GST?", "What do they need from us before they amend?", "What exactly differs between our books and their filing?"],
  S04: ["Should we hold Nova's 28 Oct payment until they file?", "How much credit could we lose, and by when?", "What did Rakesh actually say?"],
  S05: ["What did Ramesh say in his Hindi message?", "When will we know if they kept the promise?", "Who handles this supplier on our side?"],
  S06: ["Why is there nothing to chase with Mehta Castings?", "Is the credit actually available to us?", "What should I change in our books?"],
  S07: ["What is wrong with these two invoices?", "When will this be fixed?", "Do I need to do anything now?"],
  S08: ["Why haven't they replied properly?", "What happens next, and when?", "Should I write to the other mailbox they mentioned?"],
  S09: ["Who should we contact now?", "Why is this credit stuck?", "How much is at stake?"],
  S10: ["Is 'ok noted' a commitment?", "How much last-year credit is at risk here?", "How reliable is Rathi Alloys?"],
  S11: ["Is ST/2231-B real credit?", "What did they promise for the other two invoices?", "Should I hold their payment until this is sorted?"],
  S12: ["What is the risk with Vega beyond the missing invoices?", "Did their reply cover all our invoices?", "How much last-year credit is at stake?"],
  S13: ["Anil says everything was filed. Is he right?", "How should we reply to an angry supplier?", "Who has been told about this?"],
  S14: ["They promised by Friday. Why does the tool wait until after 11 Nov?", "How much is stuck?", "Do we need to remind them?"],
  S15: ["Why haven't we contacted Delta yet?", "How much is at stake?", "Can we hold their 10 Nov payment?"],
  S16: ["Is ₹3,330 worth a message?", "Who is our contact there?", "Can we hold their payment?"],
};
function stateFor(sid, t, acted, fSent) {
  const S = SFA.freshState(); S.t = t;
  if (acted) { const d = M.DECISION[sid]; S.acts[d.type === "send" ? "send:" + d.id : d.type + ":" + sid] = { at: "2026-10-15T10:00" }; }
  if (fSent) S.acts["send:F-S05"] = { at: "2026-11-12T10:00" };
  return S;
}
const summaries = [], seen = new Set();
for (const s of W.suppliers) {
  const variants = [];
  for (const t of [0, 1, 2]) {
    variants.push([t, false, false]);
    if (M.DECISION[s.id]) variants.push([t, true, false]);
    if (s.id === "S05" && t >= 1) variants.push([t, false, true]);
  }
  for (const [t, acted, f] of variants) {
    const S = stateFor(s.id, t, acted, f); const D = M.derive(S); const v = D.sup[s.id];
    const sig = M.signature(v, D, S); const key = s.id + "|" + sig;
    if (seen.has(key)) continue; seen.add(key);
    summaries.push({ id: "SUM-" + s.id + "-t" + t + (acted ? "a" : "") + (f ? "f" : ""), sid: s.id, t, acted, f, sig, prompt: M.summaryPrompt(v, D, S), keys: M.citeKeys(v) });
  }
}
const qa = [];
for (const s of W.suppliers) {
  const S = stateFor(s.id, 0, false, false); const D = M.derive(S); const v = D.sup[s.id];
  const sig = M.signature(v, D, S);
  QUESTIONS[s.id].forEach((q, i) => qa.push({ id: "QA-" + s.id + "-" + (i + 1), sid: s.id, q, sig, prompt: M.qaPrompt(v, D, S, q), keys: M.citeKeys(v) }));
}
fs.writeFileSync(P("jobs/summary_jobs.json"), JSON.stringify(summaries, null, 1));
fs.writeFileSync(P("jobs/qa_jobs.json"), JSON.stringify(qa, null, 1));
const write = (list, prefix, per) => { const files = []; for (let i = 0; i < list.length; i += per) { const g = list.slice(i, i + per); const f = `jobs/${prefix}${files.length + 1}.txt`; fs.writeFileSync(P(f), g.map(j => `=== ITEM ${j.id} ===\n${j.prompt}\n=== END ITEM ${j.id} ===\n`).join("\n")); files.push([f, g.length, Math.round(fs.statSync(P(f)).size / 1024) + " KB"]); } return files; };
console.log("summaries", summaries.length, write(summaries, "sum", 9));
console.log("qa", qa.length, write(qa, "qa", 8));
