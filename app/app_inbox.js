/* ============ Follow-up Inbox ============ */
const KIND_LABEL = { reco: "Reco job", message_out: "Message sent", message_in: "Reply received", reading: "Reply read by AI", rule: "Rule applied", check: "Agent check", owner_alert: "Owner alerted", contact: "Contact updated", book: "Books corrected", ims: "Seen in IMS", gstr2b: "GSTR-2B result", payment: "Payment", decision: "Decision", review: "Reading reviewed" };
function nextText(v) {
  const n = v.next;
  if (!n) return "";
  if (n.kind === "decision") return n.title;
  if (n.kind === "missed") return "Missed on 15 Oct. Next chance: November GSTR-1 (11 Dec)";
  if (/^Seen in IMS/.test(n.text)) return "Uploaded by the supplier. GSTR-2B on 14 Nov confirms it";
  return n.text;
}
/* last year's credit that can no longer make it: not in IMS after the 11 Nov GSTR-1 due date */
function fyGone(v) { return (S.t || 0) === 1 ? v.inv.filter(x => INV[x.ref].fy === "2025-26" && !["ims", "recovered", "removed", "lost"].includes(x.st)).reduce((a, x) => a + INV[x.ref].stuck, 0) : 0; }
function filteredSuppliers() {
  const q = UI.q.trim().toLowerCase();
  return M.inboxOrder(D, UI.sort).filter(v => {
    if (UI.owner && v.s.owner !== UI.owner) return false;
    if (UI.channel && v.channel !== UI.channel) return false;
    if (UI.group && v.group !== UI.group) return false;
    if (q) { const hay = (v.s.name + " " + v.s.city + " " + v.s.gstin + " " + v.s.contact + " " + v.inv.map(x => x.ref).join(" ")).toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
}
function inboxHeadline() {
  const t = S.t || 0;
  if (t === 0) {
    const fy = D.tot.fyOpen;
    return { eyebrow: "Thursday 15 Oct 2026 · Kestrel Auto Components", h: `${D.counts.needs} ${plural(D.counts.needs, "supplier needs", "suppliers need")} you today`, p: fy ? `${lakh(fy)} of last year's credit (FY 2025-26) must reach GSTR-2B by 14 Nov, or it can't be claimed after 30 Nov 2026.` : "Last year's credit is safe: everything due by 30 Nov is in progress or fixed." };
  }
  if (t === 1) {
    const ims = Object.values(D.inv).filter(x => x.st === "ims").length;
    return { eyebrow: "Thursday 12 Nov 2026 · the day after the GSTR-1 due date (simulated)", h: `${ims} ${plural(ims, "invoice")} uploaded by suppliers and seen in IMS`, p: "IMS shows the invoices suppliers have uploaded for October. The October GSTR-2B on 14 Nov confirms what you can claim." };
  }
  return { eyebrow: "Saturday 14 Nov 2026 · October GSTR-2B (simulated)", h: `${lakh(D.tot.recovered)} recovered this cycle`, p: D.tot.lost ? `${lakh(D.tot.lost)} of last year's credit was lost: it missed the last GSTR-2B before the 30 Nov deadline.` : "No credit was lost. Everything from FY 2025-26 reached GSTR-2B in time." };
}
function inboxView() {
  const hd = inboxHeadline(); const t = S.t || 0;
  const vs = filteredSuppliers();
  const owners = [...new Set(W.suppliers.map(s => s.owner))];
  const routineSids = D.routine.filter(sid => vs.some(v => v.id === sid));
  const selN = [...UI.selected].filter(sid => D.routine.includes(sid)).length;
  const first = !S.ui.toured && t === 0 && !Object.keys(S.acts).length;
  const portal = t < 2 ? portalLine() : "";
  return `
  <section class="row between" style="align-items:flex-end">
    <div class="stack-s"><div class="eyebrow">${esc(hd.eyebrow)}</div><h1 id="inboxTitle">${esc(hd.h)}</h1><p class="ink2" style="max-width:760px">${esc(hd.p)}</p></div>
    <div class="row">${first ? `<button type="button" class="btn primary" data-action="tour-start">${ic("play")} Take the 2-minute tour</button>` : ""}<button type="button" class="btn" data-action="nav-dash">${ic("chart")} Dashboard</button></div>
  </section>
  ${first ? `<div class="banner blue">${ic("info")}<span class="grow">Welcome. This demo starts on <b>15 Oct 2026</b>, the day after the September reconciliation. Suppliers were first contacted on 1 Oct and 13 have replied. Act on a few suppliers, then use <b>Move to 12 Nov</b> at the top to see what happens.</span><button type="button" class="btn sm" data-action="open-sup" data-sid="S04">Start with Nova Polymers ${ic("arrow")}</button></div>` : ""}
  ${timeBanner()}
  ${why("Why the inbox looks like this", `<p>One row per <b>supplier</b>, not per invoice: the person you chase is the supplier, and one message can fix several invoices. Suppliers that need a decision come first; within each group, last year's credit leads (rule R8) because it is lost for good after 30 Nov, then the largest amounts; promises sort by date. <b>Measures:</b> days from the reco job to the first message, and credit recovered per supplier.</p>`)}
  <section class="kpis" id="kpis">
    <div class="card kpi"><span class="k">Credit stuck</span><span class="v">${lakh(D.tot.open)}</span><span class="s">${D.tot.openN} ${plural(D.tot.openN, "invoice")} with ${Object.values(D.sup).filter(v => v.open).length} suppliers</span></div>
    <div class="card kpi ${D.counts.needs ? "" : "good"}"><span class="k">Needs you</span><span class="v">${D.counts.needs} ${plural(D.counts.needs, "supplier")}</span><span class="s">${D.needs.amount ? lakh(D.needs.amount) + " waiting on your decisions" : "Nothing waiting on you"}</span></div>
    ${t === 0 ? `<div class="card kpi ${D.tot.fyOpen ? "alert" : "good"}"><span class="k">Last year's credit, due 30 Nov</span><span class="v">${lakh(D.tot.fyOpen)}</span><span class="s">FY 2025-26 · last chance is the October GSTR-1</span></div>`
      : t === 1 ? (() => { const gone = Object.values(D.sup).reduce((a, v) => a + fyGone(v), 0); return `<div class="card kpi ${gone ? "alert" : "good"}"><span class="k">Last year's credit</span><span class="v">${lakh(D.tot.fyOpen)}</span><span class="s">${gone ? lakh(gone) + " missed the 11 Nov GSTR-1 and will be lost" : "All of it is in IMS, on track for GSTR-2B"}</span></div>`; })()
      : `<div class="card kpi ${D.tot.lost ? "alert" : "good"}"><span class="k">Credit lost</span><span class="v">${lakh(D.tot.lost)}</span><span class="s">FY 2025-26 that missed the 30 Nov deadline</span></div>`}
    <div class="card kpi good"><span class="k">Recovered this cycle</span><span class="v">${lakh(D.tot.recovered)}</span><span class="s">Counted only when it is in GSTR-2B</span></div>
  </section>
  ${why("North Star", `<p>The number that matters is <b>credit recovered and confirmed in GSTR-2B</b>, not messages sent or replies read. A supplier's promise never counts as recovered (rule R7).</p>`)}
  <section class="card stack" style="padding:16px">
    <div class="toolbar">
      <label class="sr" for="inboxQ">Filter suppliers</label><input type="search" id="inboxQ" class="searchf" placeholder="Filter by supplier, city or invoice" value="${esc(UI.q)}" data-input="inboxQ">
      <label class="sr" for="fOwner">Owner</label><select id="fOwner" data-change="fOwner"><option value="">All owners</option>${owners.map(o => `<option ${UI.owner === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>
      <label class="sr" for="fChan">Channel</label><select id="fChan" data-change="fChan"><option value="">All channels</option>${["Email", "WhatsApp"].map(c => `<option ${UI.channel === c ? "selected" : ""}>${c}</option>`).join("")}</select>
      <label class="sr" for="fSort">Sort</label><select id="fSort" data-change="fSort">${[["priority", "Sort: what to do first"], ["amount", "Sort: credit stuck"], ["name", "Sort: name"]].map(([k, l]) => `<option value="${k}" ${UI.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      ${(UI.q || UI.owner || UI.channel || UI.group) ? `<button type="button" class="btn ghost sm" data-action="clear-filters">Clear filters</button>` : ""}
    </div>
    <div class="chips" role="group" aria-label="Filter by status">
      <button type="button" class="chip" data-action="chip" data-group="" aria-pressed="${!UI.group}">All<span class="c">${W.suppliers.length}</span></button>
      ${GROUPS.filter(g => D.counts[g.id]).map(g => `<button type="button" class="chip" data-action="chip" data-group="${g.id}" aria-pressed="${UI.group === g.id}">${esc(g.label)}<span class="c">${D.counts[g.id]}</span></button>`).join("")}
    </div>
    ${D.routine.length && t === 0 ? `<div class="banner blue" id="bulkBar">${ic("send")}<span class="grow"><b>${D.routine.length} routine ${plural(D.routine.length, "message")} ready</b> to approve together: first messages and reminders that follow your rules. Anything involving money, disputes or tone is reviewed one supplier at a time.</span>
      <button type="button" class="btn sm" data-action="select-routine">Select all routine</button>
      <button type="button" class="btn primary sm" data-action="bulk-approve" ${selN ? "" : "disabled"}>Approve selected (${selN})</button></div>` : ""}
    ${why("Why bulk approval is limited", `<p>Bulk approval covers only first messages and rule-driven reminders. They are low-risk and identical in shape, so reviewing them one by one wastes time. <b>Measures:</b> how often routine drafts are approved without edits. A high rate is the evidence for letting them send automatically in the next stage of the rollout.</p>`)}
    ${vs.length ? inboxTable(vs) + inboxCards(vs) : `<div class="callout">No suppliers match these filters. <button type="button" class="btn ghost sm" data-action="clear-filters">Clear filters</button></div>`}
    <p class="xs muted">${portal}</p>
  </section>`;
}
function portalLine() {
  const renewed = !!S.renewed; const t = S.t || 0;
  const src = t === 0 ? "From your reco job of 14 Oct (September GSTR-2B vs purchase register, all 3 GSTINs)." : "IMS checked daily for all 3 GSTINs.";
  return `${src} GST portal access for the agent: ${renewed ? "renewed until 12 Dec (OTP entered by you, simulated)." : `active until 12 Nov, 10:00 ${t === 1 ? "<b style='color:var(--amber-fg)'>(expires today)</b>" : ""}. Renew before 14 Nov so the October GSTR-2B can be pulled.`} ${renewed ? "" : `<button type="button" class="btn ghost sm" data-action="renew">${ic("shield")} Renew access</button>`}`;
}
function timeBanner() {
  const t = S.t || 0;
  if (t === 1) {
    const ims = Object.entries(D.inv).filter(([, x]) => x.st === "ims").map(([r]) => r);
    const broken = Object.values(D.sup).filter(v => v.inv.some(x => x.st === "broken"));
    const acc = S.acts["ims:accept"] && !S.acts["ims:accept"].undone;
    return `<div class="banner ${acc ? "green" : "blue"}">${ic("portal")}<span class="grow"><b>${ims.length} ${plural(ims.length, "record")} in IMS match your purchase register.</b> ${acc ? "You accepted them in IMS." : "Accept them in IMS now, or leave them: records with no action count as accepted when GSTR-2B is generated on 14 Nov."}</span>${acc ? "" : `<button type="button" class="btn primary sm" data-action="ims-accept">Accept ${ims.length} in IMS</button>`}</div>
    ${broken.length ? `<div class="banner red">${ic("alert")}<span class="grow"><b>${broken.length} broken ${plural(broken.length, "promise")}:</b> ${broken.map(v => esc(v.s.name)).join(", ")} did not file by 11 Nov. The owner has been alerted (rule R5).</span><button type="button" class="btn sm" data-action="open-sup" data-sid="${broken[0].id}">Open</button></div>` : ""}`;
  }
  if (t === 2) {
    const cf = D.counterfactual; const gain = D.tot.recovered - cf.recovered; const saved = cf.lost - D.tot.lost;
    return `<div class="banner green">${ic("check")}<span class="grow"><b>October GSTR-2B is in.</b> ${lakh(D.tot.recovered)} recovered and confirmed. ${gain > 0 ? `Your decisions on 15 Oct added <b>${lakh(gain)}</b>${saved > 0 ? ` and saved <b>${lakh(saved)}</b> of last year's credit` : ""} compared with doing nothing.` : "You took no decisions on 15 Oct. Go back to 15 Oct, act on a few suppliers and move forward again to compare."}</span><button type="button" class="btn sm" data-action="nav-dash">See the dashboard</button></div>`;
  }
  return "";
}
function lastAct(v) {
  const h = v.lastActivity; if (!h) return "";
  return `<span class="small">${fd(h.date, false)}</span><div class="sub">${esc(KIND_LABEL[h.kind] || "Update")}</div>`;
}
function inboxTable(vs) {
  const t = S.t || 0;
  return `<div class="tbl inbox-tbl"><table><thead><tr>${t === 0 && D.routine.length ? '<th style="width:30px"><span class="sr">Select</span></th>' : ""}<th>Supplier</th><th class="r">Open</th><th class="r">Credit stuck</th><th>Status</th><th>Last activity</th><th>Next step</th><th>Owner</th><th><span class="sr">Open</span></th></tr></thead><tbody>
  ${vs.map(v => {
    const routine = D.routine.includes(v.id);
    return `<tr class="click" data-action="open-sup" data-sid="${v.id}" id="row-${v.id}">
      ${t === 0 && D.routine.length ? `<td data-stop="1">${routine ? `<input type="checkbox" aria-label="Select the routine message for ${esc(v.s.name)}" data-change="sel" data-sid="${v.id}" ${UI.selected.has(v.id) ? "checked" : ""}>` : ""}</td>` : ""}
      <td><div class="sup-name">${esc(v.s.name)}</div><div class="sub">${esc(v.s.city)} ${udyamTag(v.s)}</div></td>
      <td class="r num">${v.openN}${v.openN !== v.n ? `<span class="sub"> of ${v.n}</span>` : ""}</td>
      <td class="r num"><b>${v.open ? lakh(v.open) : "₹0"}</b>${fyGone(v) ? `<div class="fy-tag">${lakh(fyGone(v))} will be lost</div>` : v.fyOpen && S.rules.R8.on ? `<div class="fy-tag">${lakh(v.fyOpen)} due 30 Nov</div>` : ""}${v.lost ? `<div class="fy-tag">${lakh(v.lost)} lost</div>` : ""}</td>
      <td>${supBadge(v)}</td>
      <td>${lastAct(v)}</td>
      <td style="max-width:300px"><span class="small">${esc(nextText(v))}</span>${routine ? ` <span class="badge outline">routine</span>` : ""}${v.pending.length > 1 ? `<div class="sub">+${v.pending.length - 1} more to approve</div>` : ""}</td>
      <td class="small">${esc(v.s.owner)}</td>
      <td><button type="button" class="btn sm" data-action="open-sup" data-sid="${v.id}">Open</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function inboxCards(vs) {
  return `<div class="cards-mobile">${vs.map(v => `<div class="mcard" data-action="open-sup" data-sid="${v.id}" role="button" tabindex="0">
    <div class="row between"><b>${esc(v.s.name)}</b>${supBadge(v)}</div>
    <div class="row between small"><span class="muted">${esc(v.s.city)} · ${esc(v.s.owner)}</span><span class="num"><b>${v.open ? lakh(v.open) : "₹0"}</b>${v.fyOpen && S.rules.R8.on ? ` <span class="fy-tag">${lakh(v.fyOpen)} due 30 Nov</span>` : ""}</span></div>
    <div class="small ink2">${esc(nextText(v))}</div>
    ${D.routine.includes(v.id) && (S.t || 0) === 0 ? `<label class="row small" data-stop="1" style="gap:7px"><input type="checkbox" data-change="sel" data-sid="${v.id}" ${UI.selected.has(v.id) ? "checked" : ""}> Select the routine message</label>` : ""}
  </div>`).join("")}</div>`;
}
