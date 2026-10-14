/* Node loader: world + recorded AI outputs, in the same shape the app bundles. */
const fs = require("fs"), path = require("path");
const P = (...a) => path.join(__dirname, ...a);
const J = f => JSON.parse(fs.readFileSync(P(f), "utf8"));
function jsonl(f) { const o = {}; for (const line of fs.readFileSync(P(f), "utf8").split("\n")) { if (line.trim()) { const d = JSON.parse(line); o[d.id] = d.output; } } return o; }
function load() {
  const W = J("data/world.json");
  const jobs = J("jobs/draft_jobs.json");
  W.draftMeta = {}; jobs.forEach(j => { W.draftMeta[j.id] = { sid: j.sid, refs: j.refs, channel: j.channel, purpose: j.purpose, when: j.when, stage: j.stage, language: j.language, to: j.to, cc: j.cc, prompt: j.prompt }; });
  W.prompts = { reader: fs.readFileSync(P("prompts/reader.txt"), "utf8"), drafter: fs.readFileSync(P("prompts/drafter.txt"), "utf8"), summary: fs.readFileSync(P("prompts/summary.txt"), "utf8"), qa: fs.readFileSync(P("prompts/qa.txt"), "utf8") };
  const small = {}; ["small_q1", "small_q2", "small_q3", "small_q4"].forEach(f => Object.assign(small, jsonl("eval/out/" + f + ".jsonl")));
  const readings = {}; W.replies.forEach(r => { readings[r.id] = small[r.id]; });
  Object.assign(readings, J("out/post_readings_all.json"));
  const drafts = J("out/drafts_all.json");
  return { W, B: { readings, drafts, small } };
}
module.exports = { load, P, J, jsonl };
