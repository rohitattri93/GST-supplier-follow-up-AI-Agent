"""Renders the drafter prompt (v2) for every message the demo can show, and writes batch files for recording.
Message ids: N-* first message, X-* decision on 15 Oct, R-* routine reminder, F-* firmer message after a broken promise.
"""
import json, os
from data import SUP, INV, UNITS, BUYER, USER, inr, dlabel, issue_line, P

TPL = open(P("prompts", "drafter.txt"), encoding="utf-8").read()
def fill(t, m):
    for k, v in m.items():
        t = t.replace("{" + k + "}", v)
    return t

SENDER = USER["name"]
LANG = {"Hinglish": "Hinglish (Hindi in Latin script, mixed with English)", "Hindi": "Hindi (Devanagari script)", "English": "English"}
OCT11 = "11 Oct 2026, the due date of your September GSTR-1"
NOV11 = "11 Nov 2026, the due date of your October GSTR-1"
FYNOTE_EARLY = " (our credit on the FY 2025-26 invoices can only be claimed until 30 Nov 2026)"
FYNOTE = " (this is also the last filing that keeps our FY 2025-26 credit claimable before 30 Nov 2026)"

def inv_lines(refs):
    return "\n".join(f"- {INV[r]['ref']} | {dlabel(INV[r]['date'])} | GST {inr(INV[r]['gst'])} | {issue_line(INV[r])}" for r in refs)

def need(refs, base, early=False):
    if any(INV[r]["fy"] == "2025-26" for r in refs):
        return base + (FYNOTE_EARLY if early else FYNOTE)
    return base

refs_of = lambda sid: [r for r, x in INV.items() if x["sid"] == sid]
jobs = []
def job(mid, sid, refs, stage_key, stage, when, purpose, need_by, contact=None, cc="none", channel=None):
    s = SUP[sid]; u = UNITS[s["unit"]]
    ch = channel or s["channel"]
    prompt = fill(TPL, dict(language=LANG[s["language"]], channel=ch, stage=stage, sender=SENDER, buyer=BUYER,
                            unit=u["name"], unit_gstin=u["gstin"], contact=contact or s["contact"], supplier=s["name"],
                            supplier_gstin=s["gstin"], cc=cc, invoices=inv_lines(refs), need_by=need_by))
    jobs.append(dict(id=mid, sid=sid, refs=refs, stage=stage_key, when=when, channel=ch, purpose=purpose,
                     language=s["language"], to=contact or s["contact"], cc=None if cc == "none" else cc, prompt=prompt))

FIRST = "First message about these invoices."
# first messages sent on 1 Oct 2026 (13 suppliers; Mehta Castings was never contacted, Delta and Orbit are new)
for sid in ["S01", "S02", "S03", "S04", "S05", "S07", "S08", "S09", "S10", "S11", "S12", "S13", "S14"]:
    refs = refs_of(sid)
    purpose = "Asked them to fix their GST filing for " + (", ".join(refs[:-1]) + " and " + refs[-1] if len(refs) > 1 else refs[0]) + " by 11 Oct"
    job(f"N-{sid}", sid, refs, "first_notice", FIRST, "2026-10-01", purpose, need(refs, OCT11, early=True))
# first messages proposed on 15 Oct (new in the September reconciliation)
for sid in ["S15", "S16"]:
    refs = refs_of(sid)
    job(f"N-{sid}", sid, refs, "first_notice", FIRST, "2026-10-15",
        "Asked them to report " + " and ".join(refs) + " in their October GSTR-1, by 11 Nov", need(refs, NOV11))

MAN, PUN = UNITS["MAN"]["gstin"], UNITS["PUN"]["gstin"]
job("X-S02", "S02", refs_of("S02"), "wrong_gstin",
    f"They replied that all three invoices were filed in their August GSTR-1 (ARN AA240926118734Q). We searched the GSTR-2B of all three of our GSTINs: the invoices are there, but under our Manesar unit's GSTIN {MAN} instead of our Pune unit's GSTIN {PUN}. Thank them for filing, and ask them to amend the recipient GSTIN to {PUN} in their next GSTR-1.",
    "2026-10-15", "Asked them to amend the recipient GSTIN to our Pune GSTIN", NOV11)
job("X-S03", "S03", ["BF/26-27/3310"], "send_documents",
    "They asked for our PO and GRN for invoice BF/26-27/3310. Say the PO (PO-MAN-26-0457) and GRN (GRN-MAN-26-1189) copies are attached, that our books show a taxable value of ₹4,12,000 as per the PO, and ask them to confirm the value or amend it.",
    "2026-10-15", "Sent the PO and GRN and asked them to confirm or amend the value", NOV11)
job("X-S04", "S04", refs_of("S04"), "payment_condition_escalation",
    "Reply to their message that they will upload the invoices only after their outstanding payment of Rs 14.8 lakh is released. "
    "You may mention payment only in exactly these words: 'Your payment of ₹14,80,000 is scheduled for 28 Oct as per our terms.' "
    "Explain that two of the invoices are from FY 2025-26, so they must reach our GSTR-2B through your October GSTR-1 (due 11 Nov); after that the credit cannot be claimed. "
    "Ask them to report all three invoices in the October GSTR-1 by 11 Nov. Say that Priya Menon, who manages the account, is copied and will call them this week.",
    "2026-10-15", "Confirmed the scheduled 28 Oct payment date and asked for all three invoices in the October GSTR-1 by 11 Nov; copied Priya Menon",
    need(refs_of("S04"), NOV11), cc="Priya Menon (account owner, Kestrel)")
job("X-S08", "S08", refs_of("S08"), "follow_up_after_leave",
    "Gentle follow-up: their contact was out of office until 20 Oct. Repeat the request briefly.",
    "2026-10-21", "Repeated the request after their leave", NOV11)
job("X-S09", "S09", refs_of("S09"), "new_contact",
    "The previous contact, Anjali Mehra, has left. This is the first message to the new contact, the finance team at finance@greenleaf.example.",
    "2026-10-15", "Wrote to the new contact (finance@greenleaf.example)", NOV11, contact="Finance team")
job("X-S10", "S10", refs_of("S10"), "ask_date",
    "They replied 'ok noted' without a date. Ask for a specific date by which both invoices will be reported.",
    "2026-10-15", "Asked for a specific date", need(refs_of("S10"), NOV11))
job("X-S12", "S12", ["VC/0512"], "partial_follow_up",
    "They promised to file their August and September returns by 31 Oct but did not mention invoice VC/0512 from January 2026. Thank them, and ask specifically about VC/0512.",
    "2026-10-15", "Asked specifically about VC/0512 (January 2026)", need(["VC/0512"], NOV11))
job("X-S13", "S13", ["JIG/26/1131"], "evidence_reply",
    "They said every invoice was filed and asked us to stop reminders. Our September GSTR-2B now shows JIG/26/1104, so thank them for it and say we will send no more reminders on it. Calmly ask them to check JIG/26/1131, which is still missing.",
    "2026-10-15", "Thanked them for JIG/26/1104 and asked them to check JIG/26/1131", NOV11)

# routine reminders (rule R1: one reminder 2 days before a promised date)
job("R-S01", "S01", refs_of("S01"), "reminder",
    "Friendly reminder two days before their promised date: on 6 Oct they promised to report both invoices in this month's GSTR-1 by 11 Nov. Thank them and remind them briefly.",
    "2026-11-09", "Reminded them to report both invoices by 11 Nov", NOV11)
job("R-S05", "S05", ["KE/219"], "reminder",
    "Friendly reminder two days before their promised date: on 12 Oct they promised to correct invoice KE/219 in this month's GSTR-1, due 11 Nov. Thank them and remind them briefly.",
    "2026-11-09", "Reminded them to correct KE/219 by 11 Nov", NOV11)
job("R-S07", "S07", refs_of("S07"), "reminder",
    "Friendly reminder two days before their promised date: on 8 Oct they promised to amend both invoices in their October GSTR-1, due 11 Nov. Thank them and remind them briefly.",
    "2026-11-09", "Reminded them to amend both invoices by 11 Nov", NOV11)
job("R-S10", "S10", refs_of("S10"), "reminder",
    "Friendly reminder two days before their promised date: on 16 Oct they promised to upload both invoices by 6 Nov. Thank them and remind them briefly.",
    "2026-11-04", "Reminded them to upload both invoices by 6 Nov",
    "6 Nov 2026, the date you gave us (the FY 2025-26 invoice must reach our GSTR-2B before 30 Nov 2026)")
job("R-S11", "S11", ["ST/2231", "ST/2232"], "reminder",
    "Friendly reminder two days before their promised date: on 9 Oct they promised to report ST/2231 and ST/2232 in this month's GSTR-1, due 11 Nov. Thank them and remind them briefly.",
    "2026-11-09", "Reminded them to report ST/2231 and ST/2232 by 11 Nov", NOV11)
job("R-S12a", "S12", ["VC/0688"], "reminder",
    "Friendly reminder two days before the date they gave: on 11 Oct they said they would file their August and September returns by 31 Oct. Invoice VC/0688 belongs in the August return. Remind them briefly and wish them well.",
    "2026-10-29", "Reminded them that VC/0688 belongs in the August return they promised by 31 Oct", "31 Oct 2026, the date you gave us")
job("R-S12b", "S12", ["VC/0512"], "reminder",
    "Friendly reminder two days before their promised date: on 19 Oct they promised to include VC/0512 in their October GSTR-1, due 11 Nov. Remind them briefly that this is the last filing that keeps the FY 2025-26 credit claimable.",
    "2026-11-09", "Reminded them to include VC/0512 in the October GSTR-1, by 11 Nov", need(["VC/0512"], NOV11))
# firmer message after a broken promise (rule R5)
job("F-S05", "S05", ["KE/219"], "promise_broken",
    "Their promise was to correct invoice KE/219 in the October GSTR-1, due 11 Nov. That deadline has passed and the correction is not in our records. Politely but firmly ask them to correct it in the November GSTR-1 and to reply with the date. No blame.",
    "2026-11-12", "Asked them to correct KE/219 in the November GSTR-1, by 11 Dec", "11 Dec 2026, the due date of your November GSTR-1")

os.makedirs(P("jobs"), exist_ok=True)
json.dump(jobs, open(P("jobs", "draft_jobs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
groups = [jobs[i:i + 10] for i in range(0, len(jobs), 10)]
for gi, g in enumerate(groups, 1):
    txt = [f"=== ITEM {j['id']} ===\n{j['prompt']}\n=== END ITEM {j['id']} ===\n" for j in g]
    open(P("jobs", f"drafts{gi}.txt"), "w", encoding="utf-8").write("\n".join(txt))
    print(gi, [j["id"] for j in g])

# reader prompts for the replies that arrive after 15 Oct
post = json.load(open(P("data", "post_items.json"), encoding="utf-8"))
txt = [f"=== ITEM {p['id']} ===\n{p['prompt']}\n=== END ITEM {p['id']} ===\n" for p in post]
open(P("jobs", "post_readings.txt"), "w", encoding="utf-8").write("\n".join(txt))
print("post readings", [p["id"] for p in post])
