# Phase 7.5 Historical Preservation Reconciliation

Date: 2026-11-14

This is a read-only comparison against the immutable Phase 4 identity, assertion, and ownership artifacts. It does not approve new deltas or alter the historical ledger.

## Results

| Measure                        | Historical baseline |                                                                                                                                                                                                                                         Phase 7.5 finding | Status                                             |
| ------------------------------ | ------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | -------------------------------------------------- |
| Expanded Playwright identities |                 292 |                                                                                                                                                      291 exact title identities; PW-149 maps to a renamed current case but has no approved identity alias | 1 unresolved mapping                               |
| Historical assertion sites     |               1,630 |                                                                                                                      1,559 exact; 10 Phase 6 approved replacements; 9 Phase 7.4.1 source-verified equivalents; 52 not matched in the mapped target source | 52 unresolved                                      |
| Ownership mappings             |          4,211 rows | Immutable mapping CSV has 4,211 logical data rows. The frozen Phase 6 snapshot reports 4,211 edges, zero CSV mismatches and zero invalid site references at its recorded revision. Phase 7.5 did not rewrite or certify a new current ownership snapshot. | Count retained; current assertion-site gaps remain |
| Current browser discovery      |                   — |                                                                                                                                                                                                       534 cases, 74 spec files, zero duplicate identities | Inventory complete                                 |

The frozen Phase 6 snapshot at `0ec683a8a7c44e5b0160f85042bfb9fbe8177472` previously reported all 1,630 assertions accounted for. The current source comparison identifies 52 historical source expressions that are not present in their mapped target files after applying the earlier 10 approvals and the 9 equivalences documented in the Phase 7.4.1 append-only ledger. This is a newer unresolved gap; the earlier snapshot is not evidence that these current sites remain equivalent.

## Identity reconciliation

| Historical identity        | Original identity                                                 | Current candidate                                                                                        | Execution                              | Reconciliation                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PW-149                     | `duplicate email registration displays inline server error alert` | `apps/web/e2e/auth/regression.spec.ts`: `duplicate email registration displays server conflict feedback` | Passed in the full browser run         | `UNRESOLVED MAPPING — title changed`; source/test behavior was not declared missing, and no title rename or ledger change was made |
| Aggregate execution status | All 292 historical cases                                          | Current cases matched exactly or by the unresolved PW-149 candidate                                      | 285 passed, 2 timed out, and 5 skipped | Aggregate only; per-identity status is in the CSV                                                                                  |

The current suite contains 242 cases beyond the 292 historical identities after the PW-149 candidate is accounted for. Additions are not evidence of historical preservation.

## Assertion reconciliation

| Result                                                 |     Count | Evidence rule                                                                                          |
| ------------------------------------------------------ | --------: | ------------------------------------------------------------------------------------------------------ |
| Exact AST source matches in mapped files               |     1,559 | Expression matches the historical source after TypeScript AST printing                                 |
| Approved replacements from the Phase 6 accepted ledger |        10 | Explicit historical identity/site approvals in `approved-regression-deltas.md` and the frozen snapshot |
| Phase 7.4.1 source-verified equivalent sites           |         9 | The nine suffixes recorded in the append-only ledger and `regression-failure-investigation.md`         |
| Unresolved historical sites                            |        52 | No exact source match in the mapped current file and no accepted replacement in the reviewed records   |
| **Total historical sites**                             | **1,630** | Exact + approved + source-verified + unresolved                                                        |

The 52 unresolved sites are enumerated row by row in `test-results/phase7/phase7.5/preservation/unresolved-assertion-sites.csv` and `historical-assertions.csv`. Grouped by mapped file:

| Mapped file                      | Unresolved sites |
| -------------------------------- | ---------------: |
| `admin.spec.ts`                  |                1 |
| `auth-styles.spec.ts`            |                7 |
| `booked-services.spec.ts`        |                1 |
| `clients.spec.ts`                |                1 |
| `departments.spec.ts`            |                2 |
| `employee-login.spec.ts`         |                1 |
| `internal-conversations.spec.ts` |                4 |
| `messages-topbar.spec.ts`        |                1 |
| `regression.spec.ts`             |                6 |
| `request-conversations.spec.ts`  |                4 |
| `services.spec.ts`               |                1 |
| `staff-workload.spec.ts`         |               12 |
| `staff.spec.ts`                  |               10 |
| `table-interactions.spec.ts`     |                1 |
| **Total**                        |           **52** |

A global exact-expression search found 20 of these expressions elsewhere in the E2E source tree, but not under verified ownership by their historical identity; 32 were not found globally. Finding an expression elsewhere does not prove behavioral equivalence or ownership. All 52 remain unresolved. A separate count found 1,710 current `expect` call sites in mapped files versus 1,632 in the Phase 6 snapshot, a net increase of 78. These current additions do not compensate for missing historical sites and were not approved by this report.

## Ownership mappings

The immutable Phase 4 `preservation-map.csv` has 4,211 logical data records. An earlier diagnostic mistakenly counted physical lines including embedded line breaks as 9,467; the corrected diagnostic counts CSV records and reports 4,211. The stored Phase 6 snapshot also reports 4,211 edges, 0 CSV mismatches, 0 invalid references, and no helper-owner gaps at its own revision. Phase 7.5 did not alter that CSV, the baseline, or the accepted ledger.

Because 52 historical assertion sites are unresolved in current mapped source, the ownership count alone cannot certify that all 4,211 mappings still point to equivalent current behavior. Administrative review must decide each unresolved site and whether the mapping itself needs a new approved delta.

## Historical verifier investigation

The command `node scripts/verify-playwright-migration.mjs discover` validates immutable inputs, creates a new unique discovery output folder, and then stops on an exact identity check:

```text
missing: ["chromium","apps/web/e2e/auth/regression.spec.ts",
  ["Authentication and session regression"],
  "duplicate email registration displays inline server error alert"]
unexpected: []
duplicates: []
```

The verifier compares project, file, describe path, and exact title before its later assertion and ownership checks. It therefore does not reach those checks in this run. The current source has the similarly purposed renamed case noted above, which passed. The title discrepancy is not silently treated as preservation or as a missing behavior.

Prior Page 16 evidence also records PW-001 and PW-037 role-landing discrepancies. Current route policy distinguishes USER `/dashboard` from internal `/module`. The append-only ledger includes several identity-specific role-route replacements, including PW-030, PW-037–PW-039, PW-101–PW-104, and PW-215–PW-218. The precise status of PW-001 must be checked against its exact baseline site before certification; no new approval is inferred here.

The strict verifier should support explicit identity aliases and approved source replacements through a separate reviewed mapping/ledger, while continuing to reject unrecorded changes. That is a proposal only; the verifier and accepted ledger were not modified.

## Administrative actions required

1. Review and explicitly resolve the PW-149 title-to-identity mapping.
2. Review all 52 assertion rows individually, including the 20 expressions found at other locations, and approve only demonstrated one-for-one equivalents.
3. Reconcile PW-001 and related role-route mappings to exact accepted identity/site approvals.
4. Review the additional 78 current assertion sites separately from historical preservation.
5. After approval, update only the append-only delta ledger under explicit authorization, then rerun the strict verifier and full mapping validation.

## Evidence artifacts

- `test-results/phase7/phase7.5/preservation/reconciliation-summary.json`
- `test-results/phase7/phase7.5/preservation/historical-identities.csv`
- `test-results/phase7/phase7.5/preservation/historical-assertions.csv`
- `test-results/phase7/phase7.5/preservation/unresolved-assertion-sites.csv`
- `test-results/phase7/phase7.5/preservation/unresolved-assertion-global-search.csv`
- `test-results/phase7/phase7.5/preservation/current-additions.csv`
- `test-results/phase7/phase7.5/preservation/legacy-verifier-discover.log`
- `test-results/phase4-verification/discovery-zbGivf/` (the fresh unique verifier discovery directory)
