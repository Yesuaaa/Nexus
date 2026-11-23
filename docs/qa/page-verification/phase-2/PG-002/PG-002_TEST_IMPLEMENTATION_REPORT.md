# PG-002 Test Implementation Report

**Status:** Complete for source-supported PG-002 behavior. Contract case T003 remains deferred under C002 and is excluded from the passing-case count.  
**Page:** PG-002 /accounts — Account Management  
**Branch / base:** 293-test-full-system-audit-for-verifying-recent-changes / e983bc46cb8b4e8c71238af3158899ea02efae79  
**Scope:** Add tests and directly required isolated test infrastructure only. No application behavior, API contract, schema, or existing regression assertion was changed.

## Implementation summary

The 14 approved source-supported additions were implemented: one PGlite API test, 12 deterministic mocked browser tests, and one browser-to-API integration test. No new unit tests were needed. T003 was not implemented because its expected 401/403 destinations remain a product-contract question.

| Test artifact                                          | Purpose                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/tests/features/users/account-list.test.ts     | Adds the missing real Express/PGlite list-query contract matrix: auth and role gate, search and role filters, member ordering, page metadata, Trash membership, invalid filters, and passwordHash redaction. Uses the existing startPgliteApp(t) helper. |
| apps/web/e2e/accounts/pg002-account-management.spec.ts | Adds T002, T004–T009, and T011–T015 with real AccountManagementPage behavior and deterministic same-origin API mocks. Existing shared mock fixtures and assertions are untouched.                                                                        |
| apps/api/tests/support/pg002-browser-fixture.ts        | Starts a fresh migrated PGlite database, the real Express app, and a loopback-only read-only state inspector for T010. Seeds only a disposable Superadmin.                                                                                               |
| apps/web/playwright.pg002-integration.config.ts        | Starts the fixture and a production Next build on isolated local ports, setting API_PROXY_TARGET to the fixture API.                                                                                                                                     |
| apps/web/e2e/accounts/pg002-integration.spec.ts        | Uses the browser to log into the fixture through /api/auth/login, creates an account through the same-origin Next rewrite, reloads the directory, and checks PGlite account and audit state.                                                             |

The integration boundary is real browser → Next same-origin rewrite → Express middleware/controller/service/repository → Prisma → PGlite. The browser’s separate read-only fixture inspection request is used only to verify persisted account, account-history, and workforce state. It does not add a production API route. Both fixture servers bind to 127.0.0.1; the PGlite database is created per run and closed by the Playwright web-server lifecycle.

## Proposed-case disposition

| ID   | Atomic area | Result                                                                             |
| ---- | ----------- | ---------------------------------------------------------------------------------- |
| T001 | A001        | Implemented as a PGlite API test.                                                  |
| T002 | A001        | Implemented as a browser route-gate test.                                          |
| T003 | A001        | Deferred; C002 destination contract is unresolved. Excluded from counts.           |
| T004 | A001        | Implemented; active empty, no-match, and Trash empty messages.                     |
| T005 | A002        | Implemented; preserves search/role and resets page/date sort on view changes.      |
| T006 | A002        | Implemented; visible active and Trash sort controls, directions, and page resets.  |
| T007 | A002        | Implemented; holds and releases an older search response after the newer response. |
| T008 | A003        | Implemented for supported 2/100 name boundaries and omitted optional contact.      |
| T009 | A003        | Implemented; pending create cannot be resubmitted with click or Enter.             |
| T010 | A003        | Implemented with isolated browser/Next/Express/PGlite infrastructure.              |
| T011 | A004        | Implemented; full profile and role edit, error display, and retry.                 |
| T012 | A005        | Implemented; pending status confirmation blocks duplicate submission.              |
| T013 | A007        | Implemented; soft-delete error and retry recover the active list.                  |
| T014 | A009        | Implemented; linked-history 409 is shown and the Trash row remains.                |
| T015 | A009        | Implemented; pending permanent delete blocks duplicate submission.                 |

Existing API and browser coverage for password reset (A006) and restore (A008) was retained without duplicative additions.

## Source reconciliation and open contracts

**C001 — create/edit/API validation differences.** The create dialog applies NAME_PATTERN, checks a nonempty contact against the Philippine mobile pattern, and strips non-digits from the contact input. Edit uses HTML name bounds and the generic contact pattern. The API enforces trimmed full-name length 2–100 and a generic contact-number pattern; it does not apply the create dialog’s name-character pattern. T008 verifies only the supported common name-length boundaries and omission of a blank optional contact. It does not assert API rejection for punctuation names or non-Philippine numbers.

**C002 — list 401/403 navigation.** The source currently clears the token and sends a list 401 to /login; list 403 calls window.location.replace("/dashboard"). Shared current-account handling selects /internal/login for workforce roles, while portal route denial sends internal roles to /module. T002 tests direct route denial destinations and confirms the list endpoint is not called. T003 remains deferred because the intended page destination after an API list 401/403 is not established.

**Observed query-serializer detail.** T006 follows the current request contract: descending direction is the API client default and is omitted from query parameters. Selecting Created begins descending; the Trash Deleted header defaults to descending when entering Trash and toggles when selected. When a different sort key is already selected, the page’s current sortBy logic starts the newly selected deletedAt key ascending. No application behavior was changed to alter those observed rules.

## Change and defect summary

Only additive test files, their isolated Playwright configuration/fixture, the four requested reports, and the cumulative ledger were added or updated. No production application source, API validator/controller/service, Prisma schema, migration, shared test helper, package script, or existing regression file was modified. The Next-generated apps/web/next-env.d.ts change from local builds/type generation was restored to its task-entry contents.

No confirmed application defect was found in the implemented cases. The only final limitation is the explicitly deferred C002/T003 contract.
