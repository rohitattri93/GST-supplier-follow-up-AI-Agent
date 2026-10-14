# Product case study

## Context and hypothesis

This independent assignment explores a B2B tax-operations workflow: once reconciliation identifies a mismatch, someone must get the supplier to act. The target user is a GST team lead handling many supplier cases. The hypothesis is that a shared follow-up queue with evidence, commitments and approval controls reduces repetitive coordination and improves timely resolution.

Discovery in the submission is hypothesis-led and assisted by Claude. No customer interviews or usability sessions have been completed. The proposed problem and solution therefore remain to be validated with actual GST teams.

## Scope

The MVP follows one loop: review a case, prepare or approve outreach, interpret the response, track the promised action, then check filing evidence. The dataset contains 16 fictional suppliers and 29 invoices, with routine promises, disputes, requests for documents, a wrong contact, an out-of-office reply, a duplicate and frustrated responses.

AI handles language; deterministic rules handle state and proposed actions. Recorded outputs make the browser demo repeatable. The planned beta requires human approval for every outbound message, although the supplied demo enables routine auto-reminders by default to illustrate a later autonomy stage.

## Evidence and evaluation

The submission includes 40 synthetic replies, model outputs and a scoring script. The saved evaluations report 19 of 20 human-review cases detected. All three models missed the same frustrated reply. The data and labels were assisted by Claude, so these results demonstrate consistency on this small set rather than accuracy on real supplier messages.

During packaging, the build and recorded-response checks were rerun. Recorded responses passed the implemented checks. Those checks do not establish that every statement is true; citation entailment and draft date validation have confirmed gaps. Fresh live-model evaluation and browser journeys were not rerun.

## Business model

The likely scenario assumes ₹25 lakh of unique monthly credit exposure, a reduction in loss from 6% to 2%, faster resolution, and staff time saved. Its estimated annual value is approximately ₹15.83 lakh per customer, compared with an assumed ₹2 lakh annual price. These are modelled benefits, not achieved results or validated willingness to pay.

Avoided loss accounts for most of the likely value and is the most important assumption to test. Time saved represents staff capacity unless it leads to actual cost reduction. Invoice cohorts must be distinct, and principal recovery must not be double-counted as financing benefit. The AI-cost scenario linkage in the original workbook also needs correction; see the limitations.

## What this project demonstrates

Problem framing, MVP scope, workflow design, deterministic and AI responsibilities, approval controls, synthetic evaluation, scenario modelling and a staged rollout proposal. Claude assisted the implementation and documentation. Rohit Kumar owns the product choices and the responsibility to explain and validate them.

## What comes next

1. Validate the operational problem through interviews and workflow observation.
2. Correct the deadline classification, human routing and output-validation gaps.
3. Have tax experts label a larger, consented and anonymised reply dataset.
4. Run shadow mode before assisted sending, then evaluate supplier-level resolution, staff time and relationship guardrails.
5. Add authenticated integrations, secure storage, delivery controls and monitoring before production use.
