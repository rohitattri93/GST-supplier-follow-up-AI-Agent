/* Packs world data, recorded AI outputs and test results into app/bundle.json. */
const fs = require("fs"); const SFA = require("./model.js"); const { load, P, J, jsonl } = require("./load.js");
const { W, B } = load(); const M = SFA.createModel(W, B);
const gold = JSON.parse(fs.readFileSync(require("path").join(__dirname, "eval", "labels.json"), "utf8"));
const items = J("eval/items.json"); const res = J("eval/results.json");
const outs = {}; for (const f of fs.readdirSync(P("out"))) if (/^(sum|qa)\d+[ab]?\.jsonl$/.test(f)) Object.assign(outs, jsonl("out/" + f));
const summaries = {}; for (const j of J("jobs/summary_jobs.json")) summaries[j.sid + "|" + j.sig] = { id: j.id, t: j.t, acted: j.acted, output: outs[j.id], keys: j.keys };
const qa = {}; for (const j of J("jobs/qa_jobs.json")) (qa[j.sid] = qa[j.sid] || []).push({ id: j.id, q: j.q, sig: j.sig, keys: j.keys, output: outs[j.id] });
const mid = {}; ["mid_b1", "mid_q3", "mid_q4"].forEach(f => Object.assign(mid, jsonl("eval/out/" + f + ".jsonl")));
function ctx(prompt) {
  const sup = (prompt.match(/\nSupplier: (.*)\n/) || [])[1] || "";
  const inv = (prompt.split("OPEN INVOICES:\n")[1] || "").split("\nREPLY DATE:")[0].split("\n").filter(Boolean).map(l => { const [ref, date, gst, issue] = l.replace(/^- /, "").split(" | "); return { ref, date, gst: gst.replace("GST ", ""), issue }; });
  const ch = (prompt.match(/REPLY via (\w+):/) || [])[1];
  return { supplier: sup, invoices: inv, channel: ch };
}
const evalItems = items.map(it => ({ id: it.id, reply: it.reply, refs: it.refs, date: it.reply_date, ctx: ctx(it.prompt), gold: gold[it.id], quick: B.small[it.id], prompt: ["E04", "E05", "E18", "E21", "E16", "E08"].includes(it.id) ? it.prompt : undefined }));
const names = { small: "quick", mid: "default", large: "complex" };
const summ = {}; for (const [k, r] of Object.entries(res)) { summ[names[k]] = { n: r.n, intent: r.intent_acc, date: r.date_acc, refs: r.refs_acc, refsN: r.refs_n, evidence: r.evidence_verbatim, human: r.human_recall_final, goldHuman: r.gold_human, auto: r.auto_rate, injection: r.injection_safe, errors: r.errors }; }
const bundle = {
  meta: { recordedOn: "2026-10-11", model: "Claude Haiku", versions: SFA.PROMPT_VERSIONS, builtOn: new Date().toISOString().slice(0, 10),
    method: "Recorded answers were produced on 11 Oct 2026 by Claude Haiku, run through Claude's agent tooling with the same prompts the live mode sends. Each passed the same code checks the app runs." },
  world: W, readings: B.readings, drafts: B.drafts, summaries, qa,
  eval: { summary: summ, items: evalItems, samples: ["E04", "E05", "E18", "E08", "E16", "E21"], run: { date: "2026-10-10", method: "Blind run: each tier answered the 40 test prompts in batches, without seeing the labels. Quick tier = Claude Haiku; default and complex tiers = larger Claude models." }, midD13: mid.D13 },
};
let s = JSON.stringify(bundle); s = s.replace(/<\//g, "<\\/");
fs.writeFileSync(P("app/bundle.json"), s);
console.log("bundle", Math.round(s.length / 1024), "KB · summaries", Object.keys(summaries).length, "· qa", Object.values(qa).flat().length, "· drafts", Object.keys(B.drafts).length, "· readings", Object.keys(B.readings).length);
