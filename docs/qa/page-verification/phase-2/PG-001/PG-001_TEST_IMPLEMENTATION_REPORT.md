# PG-001 Test Implementation Report

**Status:** Implementation complete for source-supported cases; one noncritical contract question remains blocked.  
**Page:** `PG-001` — `/`, Entry / authentication.  
**Repository baseline:** Branch `293-test-full-system-audit-for-verifying-recent-changes`, base commit `552b0cd65d814aa82cf2e6a9d666d82864fad230`.  
**Design record:** [Phase 2.1 test specification](PG-001_TEST_CASE_SPECIFICATION.md).

The source recheck matches the Phase 2.1 description: `HomeRedirect` still branches on `getToken()` truthiness and replaces to `/dashboard` or `/login`; no source/documentation discrepancy was found. The implementation changed no production source.

## Changes made

At task entry, the branch was at the stated base commit with no tracked modifications; the seven Phase 2.1 design files were present as untracked work from the preceding handoff. Existing test declarations were reviewed before adding coverage.

1. Added the `getToken()` storage-exception unit assertion in [`apps/web/test/auth-api.test.mjs`](../../../../../apps/web/test/auth-api.test.mjs#L17). It invokes the exported production helper and restores the original global storage descriptor in test cleanup.
2. Added mocked browser coverage in [`apps/web/e2e/auth/home-redirect.spec.ts`](../../../../../apps/web/e2e/auth/home-redirect.spec.ts). The tests exercise root navigation, portal handoff, downstream session handling, role landing, history replacement, and repeated visits without mocking `HomeRedirect`.
3. Added no production application changes, API tests, or database integration tests.

## Implemented case IDs

| Case ID                 | Implemented behavior                                           |                Test declarations |
| ----------------------- | -------------------------------------------------------------- | -------------------------------: |
| `PG-001-F001-A001-T001` | `getToken()` returns `null` if session storage access throws   |                           1 unit |
| `PG-001-F001-A001-T002` | Empty stored token follows anonymous redirect                  |                        1 browser |
| `PG-001-F001-A001-T003` | Persistent-only token does not satisfy root check              |                        1 browser |
| `PG-001-F001-A002-T004` | USER session enters `/dashboard` from root                     |                        1 browser |
| `PG-001-F001-A002-T005` | STAFF, ADMIN, and SUPERADMIN finish handoff at `/module`       | 3 isolated browser role examples |
| `PG-001-F001-A002-T006` | Rejected session is cleared after root handoff                 |                        1 browser |
| `PG-001-F001-A002-T007` | Portal displays account-service error and retains token on 503 |                        1 browser |
| `PG-001-F001-A002-T009` | Expired access token refreshes after root handoff              |                        1 browser |
| `PG-001-F001-A003-T008` | Redirect replaces root browser-history entry                   |                        1 browser |
| `PG-001-F001-A001-T011` | Repeated anonymous visits continue to resolve to login         |                        1 browser |

The new work therefore has **10 logical test IDs**: one unit case and nine browser case IDs, represented by eleven Playwright declarations because T005 has three independent role examples. The Phase 2.1 proposal count remains unchanged in its design document. T011 was added to address the explicit Phase 2.2 repeat-navigation requirement.

## Plan reconciliation

- The existing anonymous `/` assertion was preserved and executed; no duplicate missing-token case was added.
- The proposed unit case was implemented because `getToken()` is exported production logic and catches the storage exception directly.
- No standalone API or database test was added because `HomeRedirect` has no endpoint or persistence behavior.
- Whitespace-only token case `PG-001-F001-A002-T010` remains **BLOCKED — CONTRACT CLARIFICATION**. Source treats whitespace as truthy, but product intent is unspecified. No acceptance test was added for that unresolved rule.
- The storage-failure unit case validates the helper result (`null`); the existing and new browser cases separately exercise the root’s observable anonymous navigation branch.

## Test execution summary

- Web auth unit files: 13 passed, including T001 and the existing auth-portal tests.
- New PG-001 browser file: 11 passed across the nine browser case IDs and three T005 role examples.
- Combined focused browser run: 24 passed, comprising the 11 new declarations and 13 selected existing authentication regressions.
- Quality gates: `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed. Final results are recorded in [final verification](PG-001_FINAL_VERIFICATION.md).

The first browser run exposed two test-fixture defects: an alert locator also matched Next’s route announcer, and the refresh mock retained its initial bearer-token expectation. Both test-only issues were corrected; the subsequent focused runs passed. No application defect was found.
