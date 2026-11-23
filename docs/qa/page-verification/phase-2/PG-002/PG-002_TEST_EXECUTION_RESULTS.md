# PG-002 Test Execution Results

**Final result:** 14/14 implemented additive cases passed. T003 is contract-blocked and was not executed.  
**Repository:** 293-test-full-system-audit-for-verifying-recent-changes at e983bc46cb8b4e8c71238af3158899ea02efae79.

## Final focused commands

| Label       | Exact command                                                                                                                                                                                                                                                                                                                                                                                      | Final outcome                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| API         | pnpm --filter @nexus/api test -- tests/features/users/account-edit.test.ts tests/features/users/account-password.test.ts tests/features/users/account-restore.test.ts tests/features/users/account-status.test.ts tests/features/users/account-attribution.test.ts tests/features/users/role-policy.test.ts tests/features/users/role-leadership.test.ts tests/features/users/account-list.test.ts | 23 passed, 0 failed, 0 skipped. This includes 22 retained API declarations and T001. |
| Web unit    | pnpm --filter @nexus/web exec node --experimental-strip-types --test test/account-management-access.test.mjs                                                                                                                                                                                                                                                                                       | 3 passed, 0 failed, 0 skipped. No new unit declarations.                             |
| Browser     | pnpm --filter @nexus/web test:e2e -- accounts/account-creation.spec.ts accounts/account-management-regression.spec.ts accounts/superadmin.spec.ts accounts/pg002-account-management.spec.ts --workers=3                                                                                                                                                                                            | 26 passed, 0 failed, 0 skipped: 14 retained cases and 12 additions.                  |
| Integration | pnpm --filter @nexus/web exec playwright test --config=playwright.pg002-integration.config.ts e2e/accounts/pg002-integration.spec.ts                                                                                                                                                                                                                                                               | 1 passed, 0 failed, 0 skipped: T010.                                                 |

The independent pre-edit preservation run passed 22 API, 3 web unit, and 14 instantiated account Playwright cases. The final counts preserve those suites and add 14 passing cases.

## Implemented case results

### T001 — A001 — API list contract

- **File / declaration:** apps/api/tests/features/users/account-list.test.ts — [PG-002-F001-A001-T001] users list filters, sorts, paginates and redacts credentials.
- **Preconditions / input:** startPgliteApp(t) migrates an isolated database and starts the real Express app. Seeded a Superadmin, an Admin, 12 active matching USER records, a matching STAFF record, and one matching trashed USER. Queried search, role, member sort, direction, pages 1/2, deleted=true, and invalid search/role/sort/direction/page values.
- **Expected / actual:** Superadmin list returns 200 with 12 USER rows in stable member order over two pages; Trash returns only the trashed match; public rows omit passwordHash; missing session returns 401, Admin returns 403, and each invalid filter returns 400 Invalid account filters. All assertions passed.
- **Command / status / defect:** API command above — PASS; no defect reference.

### T002 — A001 — Browser route access

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A001-T002] direct route access requires SUPERADMIN and accounts:read.
- **Preconditions / input:** Four fresh browser contexts: Superadmin without accounts:read, Admin with that permission, USER, and anonymous. Current-account API responses are mocked; the actual route, layout, and page code run.
- **Expected / actual:** The first three are redirected to /module, /module, and /dashboard; anonymous goes to /login. No context sends GET /api/users. All passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T004 — A001 — Empty states

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A001-T004] active, no-match and Trash empty states are distinct.
- **Preconditions / input:** Authorized Superadmin; mocked successful zero-row responses for active, searched, and Trash requests.
- **Expected / actual:** Accounts shows “No accounts match your search.”; Trash shows “No soft-deleted accounts match your search.”; no pagination button or stale row is shown. All passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T005 — A002 — Accounts/Trash filter preservation

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A002-T005] Accounts and Trash preserve search and role while resetting query defaults.
- **Preconditions / input:** 12 matching active USER records and one matching trashed USER; search Target, role USER, member ascending, then page 2 and both view switches.
- **Expected / actual:** Search and role survive both switches; each switch requests page 1 and the view’s default date sort; Trash sends deleted=true; returning to Accounts omits deleted, explicit sort, and direction defaults. All passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T006 — A002 — Visible sorting

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A002-T006] visible sort controls request supported keys and direction changes from page one.
- **Preconditions / input:** Twelve active and twelve trashed accounts; start on page 2, select and reselect Member, Role, Status, Created, Deletion status, and Deleted.
- **Expected / actual:** Each new selection requests page 1 with the supported sort; each selected key reverses direction. Direction desc is omitted because it is the API client default. All passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T007 — A002 — Stale search response

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A002-T007] a superseded search response cannot replace the newer result.
- **Preconditions / input:** Authorized context; hold the Old search response, resolve New, then release the old route.
- **Expected / actual:** The New result remains visible and Old never replaces it; superseded request cancellation is tolerated by the held route. Passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T008 — A003 — Create boundaries and optional contact

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A003-T008] create enforces supported name lengths and omits a blank optional contact.
- **Preconditions / input:** Authorized Superadmin; valid email/password; names of 1, 2, and 100 characters; blank optional contact for successful submits.
- **Expected / actual:** One character is rejected without a POST; 2 and 100 characters submit successfully; contactNumber is absent from both request bodies. Passed. No ambiguous server character rule is asserted.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T009 — A003 — Pending duplicate create

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A003-T009] a pending create submission cannot be triggered twice.
- **Preconditions / input:** Authorized Superadmin; valid create body; first POST is held while the test repeats Enter.
- **Expected / actual:** The pending submit control is disabled and exactly one POST is sent; release of the single success closes the dialog once and renders one account. Passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T010 — A003 — Browser-to-PGlite integration

- **File / declaration:** apps/web/e2e/accounts/pg002-integration.spec.ts — [PG-002-F001-A003-T010] create persists through the browser, Next proxy, Express and PGlite.
- **Preconditions / input:** Dedicated Playwright config starts the PGlite/Express fixture and production Next server; the browser logs in as the seeded fixture Superadmin and creates pg002-browser-created@example.test as USER.
- **Expected / actual:** The same-origin /api/users POST returns 201; the directory shows the account before and after reload; PGlite contains one active USER and one CREATED account-history event attributed to the fixture Superadmin. No Employee or workforce-history event is created for this unassigned USER. All assertions passed.
- **Command / status / defect:** Integration command above — PASS; no defect reference.

### T011 — A004 — Profile and role edit retry

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A004-T011] profile and role edits recover after an API failure.
- **Preconditions / input:** Authorized Superadmin editing a USER’s full name, email, contact number, and role together; first PATCH returns 503, second succeeds.
- **Expected / actual:** The request body contains the four supported values; the error is shown without closing the panel; Save remains available; retry updates the visible row. Two PATCH attempts. Passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T012 — A005 — Pending status change

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A005-T012] a pending status change disables duplicate confirmation.
- **Preconditions / input:** Authorized Superadmin deactivating one active USER; PATCH response is held.
- **Expected / actual:** Confirmation becomes disabled while pending; Enter does not produce a second PATCH; the single success closes the dialog. Passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T013 — A007 — Move-to-Trash retry

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A007-T013] a failed move to Trash stays retryable and removes the account after success.
- **Preconditions / input:** Authorized Superadmin; inactive active-list account; first DELETE returns 503 and second succeeds.
- **Expected / actual:** Error remains visible and retry is enabled; on retry the account leaves Accounts and appears in Trash. Two DELETE attempts. Passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T014 — A009 — Permanent-delete linked-history conflict

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A009-T014] permanent-delete conflict is visible and the trashed account remains.
- **Preconditions / input:** Authorized Superadmin in Trash; mock returns the source-supported 409 linked-record message for a trashed target.
- **Expected / actual:** The exact conflict message is displayed in the open dialog and the target row remains in Trash. One DELETE. Passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

### T015 — A009 — Pending permanent deletion

- **File / declaration:** apps/web/e2e/accounts/pg002-account-management.spec.ts — [PG-002-F001-A009-T015] a pending permanent deletion disables duplicate confirmation.
- **Preconditions / input:** Authorized Superadmin in Trash; permanent DELETE is held until after repeated Enter.
- **Expected / actual:** Confirm is disabled while pending; exactly one DELETE occurs; after success the dialog and row disappear. Passed.
- **Command / status / defect:** Browser command above — PASS; no defect reference.

## Baseline, transient attempts, and gates

Before edits, the exact focused commands in PG-002_REGRESSION_PRESERVATION.md passed 22 API, 3 unit, and 14 browser cases. During development, early runs found test-only expectation/selector issues in T005/T006/T009 and a T010 run made before navigating from about:blank; those fixtures/assertions were corrected and final runs pass. One combined 6-worker browser run produced 25/26 because the pre-existing password toast assertion did not become visible in its timeout. That same assertion passed when rerun alone, and the final 3-worker focused run passed 26/26. No existing assertion was changed or skipped.

Final mandatory gates: pnpm format — exit 0; pnpm lint — exit 0; pnpm typecheck — exit 0 for web and API. No final focused command skipped a test. T003 is deferred rather than skipped.
