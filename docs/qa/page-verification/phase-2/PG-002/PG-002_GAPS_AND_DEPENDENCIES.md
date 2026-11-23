# PG-002 Gaps and Dependencies

**Status:** Design complete with explicit contract questions; no tests executed.  
**Baseline:** e983bc46cb8b4e8c71238af3158899ea02efae79.  
**Scope:** PG-002 only; no application/test code changes.

## Coverage gaps

1. **Users-list server contract:** No direct suite was found for search/role filtering, each supported server sort, pagination metadata, invalid query rejection, active-vs-Trash separation across multiple records, and list DTO redaction. Existing browser coverage inspects selected request parameters; the restore API test only checks a single row's movement between lists. Add PGlite API case A001-T001.
2. **Direct route denial:** Existing unit tests exercise the access predicate and API middleware, but no account-specific browser test proves a denied /accounts navigation avoids the list request and reaches the role-specific destination. Add browser case A001-T002.
3. **List denial responses:** Browser coverage has a direct 503 retry case, but no direct test for list-request 401 or 403 handling. The expected destination is unclear because the page has role-independent hard-coded destinations. Reserve T003 until clarified.
4. **Empty list states:** Source has distinct empty messages for Accounts and Trash; account E2E tests do not directly verify these successful zero-result states. Add A001-T004.
5. **List interaction depth:** Existing E2E covers member ascending, role filter, pagination and a pending search preview, but not all visible sort keys/directions, Trash query defaults, or out-of-order search responses. Add A002-T005 through T007.
6. **Creation boundary/concurrency:** Existing browser tests cover ordinary successful create, required fields, representative invalid fields and API failure/retry. Exact name boundaries, optional contact omission and repeated submission while pending are missing. Add A003-T008 and T009.
7. **Browser profile edit:** PGlite verifies profile+role persistence and rollback; browser coverage verifies role change only. It does not assert the combined fullName/email/contactNumber/role payload or retry after an edit failure. Add A004-T011.
8. **Mutation pending/error gaps:** API suites cover session, lifecycle and transaction contracts; browser coverage lacks pending duplicate status submit, soft-delete API retry, linked-history permanent-delete error display/retained row, and pending permanent-delete duplicate guard. Add A005-T012, A007-T013, A009-T014/T015.
9. **Browser-to-server integration:** Existing account Playwright tests mock /api responses, while the API suite verifies real Express/PGlite independently. No account test was found that traverses Next's same-origin proxy and reads the persisted result back. Add A003-T010 only after an isolated launcher exists.

The proposed cases are deduplicated against the exact tests in [PG-002_EXISTING_TEST_BASELINE.md](PG-002_EXISTING_TEST_BASELINE.md). Fourteen additive cases are counted in the specification; the clarification case is excluded.

## Contract clarifications required

### C1 — Name and contact validation across create, edit and API

- Create UI applies NAME_PATTERN and the Philippine mobile pattern; it strips non-digits from phone input.
- Edit UI uses required/min/max HTML name constraints and the generic contact-number pattern.
- users.service.ts enforces only name length 2–100 and a generic contact-number check for API creation/edit.
- Existing NEX-021 expects a punctuation-containing name to be rejected by the create form, but the API does not apply that name-character pattern.

Clarify whether name characters and phone formats intentionally differ between create UI, edit UI and API, or whether the contracts should align. Preserve the observed create-form regression assertion. Do not add an API acceptance/rejection expectation for punctuation names or non-PH contact values until the rule is decided. This does not block the remaining source-backed design.

### C2 — Account-list 401/403 navigation

- AccountManagementPage currently clears the token and sends a list 401 to /login; it sends list 403 to /dashboard.
- Shared current-account handling uses loginPathForRole; for internal roles this resolves to /internal/login. Portal route denial sends internal roles to /module.

Clarify whether list endpoint failures should keep the current hard-coded destinations or use role-aware login/landing destinations. T003 is marked CONTRACT CLARIFICATION REQUIRED and is not included in the 14 proposed-case total.

## Dependencies and implementation constraints

- Keep the current PG-001 records untouched. The prior cycle remains complete with deferred PG-001-F001-A002-T010, the whitespace-only session-token contract question.
- Use PGlite through apps/api/tests/support/pglite-app.ts for new API persistence tests. account-status.test.ts is a legacy Express test with mocked Prisma delegates, not a live database and not a PGlite persistence test.
- Preserve account-attribution API checks for authenticated actor attribution, rollback, session revocation, role/leadership integrity, stale requests and foreign-key effects.
- T010 needs a separate Playwright startup arrangement that points the Next proxy at an isolated PGlite-backed Express server. The existing browser suite uses mocked endpoints; live mode is not an acceptable substitute.
- Create dialog does not expose position, department or team even though the service/API DTO accepts them. Those fields are NOT APPLICABLE to current PG-002 page tests.
- The page exposes no history viewer and no department sort button. History is a backend side-effect assertion; department sort is API-only.
- Route and current-account tests may need stable restoreSession fixtures with permission overrides. Keep all tests deterministic and avoid real credentials.

## Readiness

Source discovery, atomic mapping, existing test audit, case design, edge matrix and future execution planning are complete. Test implementation is not authorized by the supplied Phase 2.1 scope. Proceed to the next stage only after the user authorizes test implementation; T003 remains separately dependent on the C2 decision.
