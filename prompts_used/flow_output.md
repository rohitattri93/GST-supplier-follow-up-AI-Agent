Run: 11 Oct 2026, about 15:30 IST, Claude Haiku through a helper agent, no other context.
Earlier attempts with a longer version of the prompt (four parts, Claude Sonnet and Claude Haiku) stopped at the output limit; this shorter, two-part version ran.

**(A) States** (open = all except Confirmed and Lost)

- **Flagged**: reconciliation flags the invoice; only the supplier can fix it. FY 2025-26 credit carries the 14 Nov 2026 target and 30 Nov cutoff (R8).
- **Chasing**: request sent; awaiting the supplier's reply.
- **Promised**: supplier has committed to a clear date.
- **Paused**: supplier is out of office; follow-up waits for their return.
- **Needs person**: a person decides the next step (R3).
- **Promise broken**: no fix in IMS after the GSTR-1 due date; firmer message awaits approval (R5).
- **Awaiting GSTR-2B**: filing seen in IMS, or a plain "already fixed" claim; open until GSTR-2B shows it (R7).
- **Confirmed**: credit shows in GSTR-2B. Closed.
- **Lost**: FY 2025-26 credit still missing after 30 Nov 2026. Closed.

**(B) Transitions**

- Flagged → Chasing: first request sent to supplier.
- Chasing → Promised: supplier gives a clear date; reminder set 2 days before it (R1).
- Chasing → Paused: out-of-office reply (R2).
- Paused → Chasing: supplier returns; follow-up sent (R2).
- Promised → Promise broken: GSTR-1 due date (11th) passes with no fix in IMS (R5; IMS can lag by days).
- Promise broken → Chasing: person approves firmer message; it is sent (R5).
- Needs person → Chasing: person decides; flow resumes at Chasing (R3).
- Any open state → Awaiting GSTR-2B: IMS shows the filing, or a plain "already fixed" with no R3 issue (R7).
- Any open state → Needs person: dispute, condition, document request, unclear or wrong contact, hostile tone (R3).
- Any open state → same state: frustrated tone; owner alerted (R4).
- Any open state → Confirmed: GSTR-2B (14th) shows the invoice.
- Any open state → Lost: FY 2025-26 credit still not in GSTR-2B after 30 Nov 2026 (R8).

What I kept and changed
- Kept 7 of the product's 9 states: Flagged, Message sent (its "Chasing"), Promised, Needs you, Promise broken, Fixed, Credit lost.
- Changed: it put a supplier's "already fixed" in the same state as a filing seen in IMS. A claim is not evidence, so only IMS data moves a case to Seen in IMS (R7).
- Added: a "Reply read" step, where the AI reading and its evidence are checked, and "Fix in our books", because my prompt said only the supplier can fix a mismatch and the demo data has two that are ours (a wrong invoice number and a duplicate).
- Dropped: a separate "Paused" state; an out-of-office reply stays under Waiting with a follow-up date (R2).
