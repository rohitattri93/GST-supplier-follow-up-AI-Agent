/* Validates recorded summaries and answers with the same code checks the app runs. */
const fs = require("fs"); const SFA = require("./model.js"); const { load, P, jsonl } = require("./load.js");
const { W, B } = load(); const M = SFA.createModel(W, B);
const sumJobs = require("./jobs/summary_jobs.json"), qaJobs = require("./jobs/qa_jobs.json");
const outs = {}; for (const f of fs.readdirSync(P("out"))) if (/^(sum|qa)\d+[ab]?\.jsonl$/.test(f)) Object.assign(outs, jsonl("out/" + f));
function stateFor(sid, t, acted, fSent) { const S = SFA.freshState(); S.t = t; if (acted) { const d = M.DECISION[sid]; S.acts[d.type === "send" ? "send:" + d.id : d.type + ":" + sid] = { at: "x" }; } if (fSent) S.acts["send:F-S05"] = { at: "x" }; return S; }
const words = s => String(s || "").replace(/\[[\d,\s]+\]/g, "").split(/\s+/).filter(Boolean).length;
let bad = [], missing = [];
for (const j of sumJobs) {
  const o = outs[j.id]; if (!o) { missing.push(j.id); continue; }
  const S = stateFor(j.sid, j.t, j.acted, j.f); const D = M.derive(S); const v = D.sup[j.sid];
  if (M.signature(v, D, S) !== j.sig) { bad.push([j.id, "signature changed"]); continue; }
  const pts = Array.isArray(o.points) ? o.points : [];
  const c = M.checkCited([o.summary, ...pts], v, D, S);
  const extra = [];
  if (words(o.summary) > 60) extra.push("summary " + words(o.summary) + " words");
  if (pts.length > 3) extra.push(pts.length + " points");
  pts.forEach((p, i) => { if (words(p) > 16) extra.push("point" + (i + 1) + " " + words(p) + " words"); if (!/\[\d/.test(p)) extra.push("point" + (i + 1) + " uncited"); });
  if (!c.ok || extra.length) bad.push([j.id, c.checks.filter(x => !x.ok).map(x => x.t).concat(extra).join("; ")]);
}
for (const j of qaJobs) {
  const o = outs[j.id]; if (!o) { missing.push(j.id); continue; }
  const S = stateFor(j.sid, 0, false, false); const D = M.derive(S); const v = D.sup[j.sid];
  const c = M.checkCited([o.answer], v, D, S);
  const extra = []; if (words(o.answer) > 70) extra.push("answer " + words(o.answer) + " words"); if (typeof o.found !== "boolean") extra.push("found not boolean");
  // an answer may legitimately cite nothing if it uses only invoice/payment facts
  const fails = c.checks.filter(x => !x.ok && !(x.t === "No history entry cited")).map(x => x.t);
  if (fails.length || extra.length) bad.push([j.id, fails.concat(extra).join("; ")]);
}
console.log("missing", missing.length, missing.join(" "));
console.log("failing", bad.length); bad.forEach(b => console.log("  ", b[0], "|", b[1]));
module.exports = {};
