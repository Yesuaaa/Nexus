# PG-003 Test Implementation Report

**Status:** COMPLETE for the authorized source-supported test scope. T010/C001 remains contract-blocked.  
**Branch / HEAD:** `293-test-full-system-audit-for-verifying-recent-changes` / `9335f946dd09a9870a20222034488e82317ca58c` (HEAD unchanged).  
**Scope:** PG-003 `/attendance` route entry only. No PG-004 work was started.

## Implemented tests

| Test ID               | Atomic feature                 | Declaration / path                          | Behavior asserted                                                                                                                                                                                                      |
| --------------------- | ------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-003-F001-A001-T001 | A001 personal destination      | `apps/web/test/attendance.test.mjs:191`     | Calls the real `canAccessPersonalAttendance` helper. Active STAFF and ADMIN without employee-read permission are true; USER and SUPERADMIN (with and without employee-read) are false; inactive STAFF/ADMIN are false. |
| PG-003-F001-A003-T002 | A003 exact route gate          | `apps/web/test/attendance.test.mjs:213`     | Calls the real `canAccessRoute` with `/attendance`. Active STAFF/ADMIN and active SUPERADMIN with `employees:read` are admitted; USER, inactive STAFF/ADMIN, and SUPERADMIN without the grant are denied.              |
| PG-003-F001-A001-T003 | A001 STAFF destination         | `apps/web/e2e/attendance-entry.spec.ts:54`  | Uses a restored STAFF session, loads `/attendance`, waits for `/attendance/check-ins`, and asserts no attendance write occurred.                                                                                       |
| PG-003-F001-A001-T004 | A001 ADMIN destination         | `apps/web/e2e/attendance-entry.spec.ts:67`  | Uses active ADMIN with `employees:read` removed, loads `/attendance`, expects check-ins, and asserts no attendance write.                                                                                              |
| PG-003-F001-A003-T006 | A003 denied account handling   | `apps/web/e2e/attendance-entry.spec.ts:83`  | In isolated pages, active USER reaches `/dashboard`, inactive STAFF reaches `/module`, and SUPERADMIN without `employees:read` reaches `/module`; none remains on an attendance route.                                 |
| PG-003-F001-A003-T007 | A003 unauthenticated handling  | `apps/web/e2e/attendance-entry.spec.ts:128` | A fresh context with no session reaches `/login`; no attendance API request is made.                                                                                                                                   |
| PG-003-F001-A004-T008 | A004 pending status            | `apps/web/e2e/attendance-entry.spec.ts:144` | Installs a pre-hydration MutationObserver, captures the element with `role="status"` and exact “Opening attendance…” text, and asserts the final check-ins destination. No fixed sleep is used.                        |
| PG-003-F001-A001-T009 | A001 replace/history semantics | `apps/web/e2e/attendance-entry.spec.ts:193` | Starts at `/module`, enters `/attendance`, verifies check-ins, then uses Back and expects `/module`; PG-003 does not remain as a history entry.                                                                        |

The eligible Superadmin destination case T005 was not duplicated. The existing direct tests and their assertions remain intact and were executed (see execution results and regression preservation reports).

## Isolation and fixture choices

- Unit tests invoke production helpers; no test-only copy of either policy was introduced.
- Playwright tests use `accountFor`, `restoreSession`, and `configureRegressionTest` with deterministic mocked account data. The new spec is skipped in live-account mode; that skip condition did not activate during execution.
- The personal attendance destination's current/history reads receive minimal response-shaped fixtures. Test request tracking confirms entry does not issue attendance writes.
- Denied-account scenarios use separate browser pages and their own restored session setup. The unauthenticated case uses the test's fresh context without seeding tokens.
- No database, PGlite, API test, live credential, schema, or production behavior change was introduced.

## Deferred contract and implementation limits

T010 remains **BLOCKED — CONTRACT CLARIFICATION REQUIRED**. The Phase 1 mapping mentions query/navigation state, but current `AttendanceEntryPage` does not read it. No query-dependent assertion or route behavior was invented. PG-003 verification does not establish functionality of PG-006, PG-014, or the rest of Workforce Compliance.
