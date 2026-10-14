/* Prints the derived world at each time point, with and without the 15 Oct decisions. */
const SFA = require("./model.js"); const { load } = require("./load.js");
const { W, B } = load(); const M = SFA.createModel(W, B);
function allActs() { const a = {}; for (const [sid, d] of Object.entries(M.DECISION)) { a[d.type === "send" ? "send:" + d.id : d.type + ":" + sid] = { at: "2026-10-15T10:00", by: "user" }; } return a; }
for (const [label, acts] of [["no actions", {}], ["all actions", allActs()]]) {
  for (const t of [0, 1, 2]) {
    const S = SFA.freshState(); S.t = t; S.acts = JSON.parse(JSON.stringify(acts));
    if (t >= 1 && label === "all actions") S.acts["send:F-S05"] = { at: "2026-11-12T10:00" };
    const D = M.derive(S);
    console.log(`\n=== ${label} · t${t} (${SFA.T_LABEL[t]}) === flagged ${SFA.inr(D.tot.flagged)} open ${SFA.inr(D.tot.open)} (${D.tot.openN}) recovered ${SFA.inr(D.tot.recovered)} lost ${SFA.inr(D.tot.lost)} removed ${SFA.inr(D.tot.removed)} fyOpen ${SFA.inr(D.tot.fyOpen)}`);
    console.log("needs", D.needs, "counts", JSON.stringify(D.counts), "decisions", D.decisions.join(","), "routine", D.routine.join(","), D.counterfactual ? "cf " + JSON.stringify(D.counterfactual) : "");
    for (const v of M.inboxOrder(D)) console.log(`  ${v.id} ${v.s.name.padEnd(28)} ${v.label.padEnd(22)} open ${SFA.inr(v.open).padStart(10)} fy ${SFA.inr(v.fyOpen).padStart(9)} | ${v.next.kind}: ${v.next.title || v.next.text}`);
  }
}
