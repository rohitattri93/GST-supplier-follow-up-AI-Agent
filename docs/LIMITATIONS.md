# Evidence and known limitations

This file takes precedence over conflicting claims in the original submission PDFs, video, workbook, UI labels and historical test descriptions. The original deliverables are retained as the assignment record. Packaging did not rewrite the underlying product logic or historical recorded AI outputs.

| Area | Current finding | Required improvement |
| --- | --- | --- |
| Deadline classification | The simulation marks certain FY 2025–26 invoices as credit lost on 14 November. Missing an operational checkpoint alone does not establish irreversible statutory lapse. | Keep these amounts at risk until the applicable legal cutoff and filing facts establish the outcome. Account for IMS recomputation and relevant return status. |
| Outcome terminology | The UI calls GSTR-2B-confirmed amounts “recovered”. | Report supplier-side mismatches resolved in applicable GSTR-2B separately from eligibility, credit claimed in GSTR-3B and realised cash benefit. |
| Citation checks | `checkCited` checks some references, amounts and dates, but can accept a supported-looking citation attached to an unsupported conclusion. | Validate semantic support and add adversarial examples. |
| Draft checks | `checkDraft` does not reliably validate dates or all amount formats and languages. An impossible date and “99 lakh” can pass. | Add deterministic date and amount parsing, supported-fact checks and multilingual tests. |
| Human routing | A frustrated reply can be flagged for tone without forcing human review. | Route frustrated and hostile cases consistently before automatic action, and align application and evaluation guards. |
| Live reader retries | The live reader wrapper reports success while attaching guard checks. A failed material check does not itself trigger the advertised retry. | Make the wrapper honour material validation failures and test fallback behaviour. |
| Automation stage | Routine automatic reminders are enabled in the demo by default; the proposed beta is approval-only. | Default an actual beta to approval-only and make autonomy stage explicit. |
| Undo | Local actions can be undone, but delivered email or WhatsApp messages cannot reliably be recalled. | Use a pre-dispatch cancellation window and clearly distinguish cancellation from recall. |
| Evaluation | Forty synthetic replies, AI-assisted labels and saved model outputs; one shared missed escalation. Null dates are included in date accuracy. | Obtain expert-labelled real data; report sample sizes, non-null date accuracy and language-specific results. |
| Impact workbook | AI-cost calculations reuse likely annual supplier volume across scenarios. | Apply cautious volume 480, likely 720 and strong 1,200 supplier-cycles/year. At the original per-cycle assumptions, annual AI costs are approximately ₹1,026.55, ₹355.35 and ₹592.24 respectively. Recheck current model pricing before use. |
| Commercial impact | Avoided loss and acceleration can overlap; open-stock exposure can be counted again monthly; time saved is not automatically cash saved. Operating costs are incomplete. | Use distinct invoice cohorts, separate principal and financing benefits, validate baseline loss and include service/integration costs. |
| Experiment design | Repeated supplier cycles are not independent observations. | Randomise at an appropriate supplier/customer level, account for clustering and delayed outcomes, and predefine stopping rules. |
| Production readiness | No production authentication, backend, secure portal integration or real message dispatch. Browser state uses localStorage. | Add access controls, secure integrations, retention, auditability and operational monitoring. |
| Offline behaviour | Recorded workflow can run locally; fonts and browser PDF export use external resources. | Bundle dependencies for a fully offline distribution. |

## Verification performed during packaging

- Rebuilt the standalone HTML from source.
- Reran `check_recorded.js` against saved outputs; this is a consistency check with the existing validators.
- Checked selected documents and repository links, scanned text for obvious credential patterns, and excluded interview-preparation material and redundant archives.
- Did not rerun browser automation, make live model calls, verify deployment, or validate real-user outcomes.

## Primary references for deadline and outcome review

- [CBIC CGST Act, section 16](https://taxinformation.cbic.gov.in/content-page/explore-act/1000285/1000001)
- [CBIC Circular 237/31/2024-GST](https://cbic-gst.gov.in/pdf/circular-237-31-2024-GST.pdf)
- [GSTN revised IMS advisory](https://tutorial.gst.gov.in/downloads/news/revised_advisory_on_ims.pdf)
- [GSTN GSTR-2B FAQ](https://tutorial.gst.gov.in/userguide/returns/FAQ_gstr2b.htm)

Tax handling must be checked against the applicable facts and current official guidance before a production implementation.
