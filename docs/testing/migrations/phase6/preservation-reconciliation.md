# Phase 6.2.5 Historical Preservation Reconciliation

**Result:** COMPLETE — READY TO COMMIT. **Scope:** the original 292 Phase 4 Playwright identities only. The Phase 4 baseline, assertion inventory, preservation map, and verifier were not modified.

## Reconciliation totals

| Evidence                   | Accounted for | Breakdown                                                                          |
| -------------------------- | ------------: | ---------------------------------------------------------------------------------- |
| Original identities        |     292 / 292 | 285 unchanged; 7 have exact, approved deltas; 0 missing or unexpected              |
| Historical assertion sites | 1,630 / 1,630 | 1,623 preserved exactly; 7 explicitly superseded; 0 unapproved missing or extra    |
| Preservation mappings      | 4,211 / 4,211 | 4,199 unchanged; 12 identity-to-site edges tied to the 7 approved superseded sites |

The merged mapped source contains 1,632 assertions: 1,607 direct assertions (1,598 preserved plus 9 approved additions) and 25 unchanged helper/hook assertions. No unapproved current assertion additions were found.

## Exact approved deltas

| Identities     | Historical sites superseded | Current assertion change                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PW-120         |                           2 | The client milestone/service-conversation expectations are replaced by absence of the obsolete milestone, visibility and deliverable link for the shared deliverable, and link to the project conversation. The original identity and title remain traceable.                                         |
| PW-195, PW-200 |                           1 | The shared conversation is asserted absent in Archived and visible in Active.                                                                                                                                                                                                                         |
| PW-237, PW-238 |                           1 | The activation action assertion includes the optional supplied project name, `Website launch`.                                                                                                                                                                                                        |
| PW-281, PW-282 |                           3 | Obsolete sidebar expansion assertions become a visible direct workspace link; the old status button assertion becomes the current combobox label assertion. Workspace table behavior assertions remain. This is the task-authorized, source-verified control adaptation recorded in the delta ledger. |

The approved replacement expressions and immutable original site references are recorded in [approved-regression-deltas.md](approved-regression-deltas.md). No other original identity or assertion deviation was found.

## Mapping and inventory checks

- All 157 source declaration groups and all 292 expanded original identities reconcile; all 36 mapped original files resolve after relocation.
- The 4,211 mapping CSV rows match the baseline ownership edges. There are 0 CSV mismatches, invalid site references, missing helper owners, or direct/helper scope overlaps.
- The current browser inventory has 308 identities: 292 originals plus 16 new identities, kept outside original-only reconciliation. Those additional browser cases are in the account-creation, calendar, and project-conversations specs. NEX-001 and NEX-003 remain API-test identities outside this browser inventory.

## Method and limits

This is a one-time static reconciliation, not a Phase 4 verifier redesign. It reused the Phase 4 baseline and mapping data, the existing verifier input/parsing utilities, and TypeScript AST assertion-site comparison. Approved changes were matched to exact original source sites and exact current replacement assertions; no wildcard or global exemption was applied. The verifier and historical artifacts remain unchanged.

Static source reconciliation establishes identity, assertion-site, and ownership traceability. It does not independently prove runtime semantic equivalence, API persistence, or authorization. The previously reported targeted integration execution was 33 browser tests and 27 isolated API tests passing; no regression tests were rerun for this reconciliation.

The machine-readable evidence contains every identity row, assertion site, ownership edge, exact exception, added browser identity, and reconciliation metric: [preservation-reconciliation.json](preservation-reconciliation.json).
