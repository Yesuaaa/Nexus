# PG-018 Gaps and Dependencies

Discovery and design complete. No runtime verification is claimed. One contract-blocked record: **PG-018-F001-A016-T002**, KPI reporting window across viewed months. Source counts all filtered returned events; only leave queries are month-windowed. Product should decide whether labels imply visible-month totals or all returned planning events. Existing source-backed count assertions remain implementable; the blocked record adds no invented requirement.

Coverage gaps mapped to the authoritative specification: initial normalization/loading, focus/error refresh, stale scope/month/unmount, remaining grid keyboard/dense markers, upcoming/Join minute boundaries, full project/organization filters, reset semantics, exact metric badges, leave conflict helper, client milestone projection, real page/owner wiring, internal HTTP delegated projection, exclusions, leave privacy/window and query validation. Existing P20 leap/URL/retry and core role/ownership assertions are retained as sufficient. No need to duplicate them.

## Security boundaries and risks

Frontend allows all four active roles, but backend scope is independent. USER ID comes from auth, not query. Ordinary staff cannot request team unless eligible; leadership changes must revoke scope. Org calendar metadata does not imply private chat or Staff workspace access. Delegated consultation approver/verifier may receive href/location under current canOpen; meeting href/location remains current-head only. Clients receive owned conversation/booking events, internal tasks/leave remain excluded. Leave projects no reason/type/decisions. URLs are not protected files; destination authorization must be checked by its own workflow. No elevated-role assumption replaces these source predicates.

## Shared components and historical limitations

PG-018 uses native Calendar buttons, FilterSelect, KpiCards and links. No row-action menu or billing proof dialog is imported. PG-004-D-001 and PG-016-D-001 remain open elsewhere and are not attributed to calendar by source inspection. Generic shared date-picker tests are indirect; page-specific keyboard assertions remain necessary. Calendar specs are not registered through the reconciled Attendance runner. Stage 3's 73 accounted parent declarations, 74 maintained declarations, 90 expanded cases, complete overtime test and single hook registration remain unchanged.

PG-001 through PG-017 findings, PG-006/T024 and PG-011 intermittency, PG-008/PG-012 PostgreSQL blockers and all deferred contracts remain in the ledger. PG-017's 32/32 approved pass is historical focused evidence; its deep-link focus contract, mocked bootstrap, rewrite bypass and optional PostgreSQL concurrency remain unresolved boundaries. It is not evidence of calendar runtime success or production readiness.

## Environment / concurrency decisions

PostgreSQL testing: NOT JUSTIFIED for this read-only, nontransactional aggregator without a specified concurrent-snapshot invariant. Real API/PGlite and one browser/Express/PGlite workflow are planned. No real meeting provider or file-storage service is required. New integration bypasses the Next rewrite; a dedicated proxy-path case is not source-justified. Date tests need deterministic clock and explicit Manila/business timezones. All existing tests remain unverified by execution in this task.

## Readiness and quality gates

Ready for separately authorized Phase 2.2 for 35 implementable records; one KPI-window case awaits product clarification. Gate results and targeted document validation are recorded below. Only seven new design reports and the cumulative ledger may change in this phase.

## Discovery validation and quality gates

| Command / check                                      | Exit | Outcome                                                                                                                                                                       |
| ---------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`                                        | 0    | Repository formatting completed.                                                                                                                                              |
| `pnpm lint`                                          | 0    | ESLint completed with zero warnings.                                                                                                                                          |
| `pnpm typecheck`                                     | 0    | Web and API completed; normal Next typegen/Prisma generation ran.                                                                                                             |
| `git diff --check`                                   | 0    | Passed.                                                                                                                                                                       |
| Targeted documentation structure/ID/count/hash audit | 0    | Seven reports; 22 unique atomic IDs; 36 unique case IDs; dispositions 17+5+13+1=36; 35 implementable (Unit5/API8/Browser21/Integration1). Prior test/report hashes unchanged. |

No unit, API, Playwright or integration tests were executed. No tracked generated file changed. Final worktree contains only the modified cumulative ledger and seven untracked PG-018 reports; index empty and HEAD unchanged. No production, test, fixture, permission, schema or migration source was modified. No incidental source restoration was needed. Phase 2.2 is ready for separate authorization for the 35 implementable records; the KPI-window contract stays deferred.
