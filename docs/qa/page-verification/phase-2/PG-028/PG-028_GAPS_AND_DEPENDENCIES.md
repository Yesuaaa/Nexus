# PG-028 — Gaps and Dependencies

Phase 2.1 static discovery for `/messages` at `4cd36ebd9228a6ff150cfc228973d85276af6334`. Proposed execution is **PLANNED — NOT EXECUTED**.

## Open contracts

| Contract    | Question                                                                                                                                                                                                                            | Mapped case                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| PG-028-C001 | What response and recovery policy should internal chat guarantee when simultaneous same-ID sends or participant changes overlap? Unique persistence and ordinary retries already have source-backed bounds.                         | PG-028-F026-A001-T026 · PG-028-ABUSE-026 |
| PG-028-C002 | After project completion, should a lost-response retry of a persisted send return the prior acknowledgment or the now-archived denial? Keep no new message in either outcome.                                                       | PG-028-F027-A001-T027 · PG-028-ABUSE-027 |
| PG-028-C003 | Should service detail reflect archived inbox classification, and should composer availability follow all bookings ending or continuous department chat? The detail currently hardcodes active, and delete uses archive eligibility. | PG-028-F030-A001-T030 · PG-028-ABUSE-030 |

Static source-to-documentation discrepancy: `docs/features/request-messaging.md:5–7,54–55` documents filtered archive reads and per-viewer hiding after deletion. The current service writes the marker but does not use it in list/detail scope. T012 independently tests marker persistence and documented visibility. Keep both assertions even if the latter fails. No runtime defect classification from source alone. T011 mock behavior and T012 persistence checks remain independent of the C003 decision. Retain PG-027 C001/C002, the existing T010 extension and exact Q1–Q6 mapping in the committed reports. Preserve all historical ledger entries, including Attendance Stage 3 and pending PG-001–018 backfill.

## Evidence dependencies

- High priority evidence gaps are cross-actor record/preview/read isolation, guarded persistent mutations, archive markers, real send/reload and overlapping replay. See the [case matrix](PG-028_TEST_CASE_SPECIFICATION.md) and [assessment](PG-028_ADVERSARIAL_AND_ABUSE_CASE_ASSESSMENT.md).
- Environment dependencies are synthetic authentication fixtures, portable Chromium, isolated migrated PGlite, loopback Next/Express for T024 and independent PostgreSQL connections for T025. Availability is unverified in discovery.
- The case matrix names bounded assertions. Executable-event rendering, exact cursor ties under simultaneous insertion, provider failure during commit, accessibility across all controls and project attachment storage behavior are residual boundaries. Record these limits at execution time. Neither high-volume stress nor performance thresholds are established. Service worker/outbox effects are only in scope if attributable to the specific action and source.
