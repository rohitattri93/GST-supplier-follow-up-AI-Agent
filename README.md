# GST Supplier Follow-up AI Agent

**From invoice mismatches to supplier action: AI-assisted follow-ups, human oversight and evidence-based resolution tracking.**

Built by Rohit Kumar as an independent product assignment for the Masters India APM hiring process. This is a portfolio case study using fictional companies, suppliers, invoices, messages and outcomes. It is not a Masters India product or a production integration.

![Supplier follow-up prototype](docs/assets/product-preview.jpg)

## Start here

| Explore | Link |
| --- | --- |
| Product story and decisions | [Case study](docs/CASE_STUDY.md) |
| Six-slide overview | [Product deck](docs/files/Product_Deck.pdf) |
| Clickable demo | Download [docs/index.html](docs/index.html), then open it in a browser |
| Recorded walkthrough | [101-second captioned video](docs/files/Walkthrough.mp4) |
| Product requirements and decision log | [Product document](docs/files/Product_Document.pdf) |
| Assumptions and scenario calculations | [Impact workbook](docs/files/Impact_Model.xlsx) |
| Build specification | [Build prompt](docs/files/Build_Prompt.pdf) |
| Evidence, corrections and open issues | [Limitations](docs/LIMITATIONS.md) |

Read the limitations before quoting the attached PDFs or workbook: those files preserve the original submission, including assumptions and claims corrected during a later review.

## The problem

A reconciliation dashboard identifies invoice mismatches. The next task is operational: contact suppliers, interpret replies, track commitments, decide when a person should intervene, and check whether the mismatch was resolved. That follow-up work spans inboxes, calendars and spreadsheets.

The prototype puts the supplier conversation, invoice evidence and next action in one workflow. The product hypothesis is that this reduces manual work and helps teams resolve mismatches sooner. Real-user research and customer outcomes have not been measured.

## What works in this prototype

- Supplier inbox and individual case views, with 16 suppliers and 29 synthetic invoices.
- Rule-driven prioritisation, promises, reminders, approval actions and audit history.
- Four AI tasks: read a reply, draft a message, summarise a case and answer questions about its records.
- Recorded AI outputs for repeatable demos, plus a Claude-hosted live integration path.
- A synthetic 40-reply evaluation set, saved model outputs and scoring scripts.
- An illustrative business-impact workbook with cautious, likely and strong scenarios.

Email, WhatsApp sending, GST portal updates, login and later filing outcomes are simulated. Browser state is stored locally. Outside the Claude host, the demo uses recorded outputs. Some fonts and PDF-export dependencies require internet access.

## My contribution and use of AI

I selected the problem, scoped the workflow, defined product constraints and made product decisions. I used Claude to assist with research, implementation, prompt design, synthetic test data, recorded responses and documentation. This repository demonstrates AI-assisted product development; it does not represent an independently hand-coded production system.

## Product decisions

| Decision | Reason |
| --- | --- |
| Code owns amounts, state and workflow rules | Language generation should not decide financial facts |
| Supplier claims remain unverified until checked against filing evidence | A reply saying “fixed” is not proof of resolution |
| Humans handle judgement-heavy cases | Disputes, conditions, ambiguous replies and relationship risk need review |
| Recorded outputs support the public demo | Reviewers can explore the workflow without supplying API credentials |
| Business impact is a scenario model | Avoided loss, time saved and willingness to pay still require validation |

GSTR-2B appearance is evidence for resolving a supplier-side mismatch; it does not establish full ITC eligibility or prove that credit was claimed. The demo also has a known premature “lost credit” classification and incomplete output checks. See [the review](docs/LIMITATIONS.md).

## Run and inspect

Prerequisite: a current Node.js installation. Building the demo does not require npm packages or an API key.

```bash
node build.js
node check_recorded.js
```

Open `dist/index.html` after building. The committed `docs/index.html` is the same build, ready to download.

The browser journey scripts require Playwright and Chromium. PDF-export checks also require local copies of the two browser libraries:

```bash
npm install
npx playwright install chromium
npm install --prefix test/vendor html2canvas@1.4.1 jspdf@2.5.1
npm run test:journeys
npm run test:regressions
```

These commands describe the supplied test harness. A fresh browser test run was not completed during this portfolio packaging review. Existing scripts and historical counts are not evidence that all known issues are fixed.

To regenerate synthetic inputs or the workbook, install `requirements.txt` and inspect `data.py`, `bundle.js` and `impact/build_model.py`. The generated workbook path differs from the archived submission workbook in `docs/files/`.

## Repository map

| Path | Purpose |
| --- | --- |
| `model.js` | Case state, rules and validation functions |
| `app/` | HTML, CSS, JavaScript and bundled demo data |
| `prompts/` | Reader, drafter, summary and Q&A instructions |
| `data/`, `jobs/`, `out/` | Synthetic world, prompt jobs and recorded responses |
| `eval/` | Synthetic labels, saved responses and scoring |
| `test/` | Supplied browser journey and regression scripts |
| `impact/` | Workbook generation script |
| `docs/` | Demo, case study, original deliverables and limitations |

## Next validation steps

Interview GST teams, observe the existing follow-up workflow, correct the deadline model and routing gaps, obtain expert-labelled real replies, and run shadow mode before permitting real outbound messages. Measure supplier-level resolution and staff time using distinct cohorts rather than repeatedly counting the same open invoices.

**Author:** Rohit Kumar · **Status:** portfolio prototype · **Built with:** JavaScript, HTML/CSS, Python, Claude
