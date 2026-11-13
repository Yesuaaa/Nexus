# Phase 7.4.1 — Page 5: Client Management

**Route:** `/clients`  
**Status:** COMPLETE — WITH VERIFIED DEFECTS OR ACCEPTED LIMITATIONS  
**Scope:** source and regression audit; new Playwright tests; focused PGlite API verification; evidence and report. No application changes.

## 1. Executive Summary

The current page supports an Admin client directory, Admin client creation, read-only client details, and read-only service-request/project tabs. Search, status filtering, sorting, and pagination are API-backed. Editing and deletion remain intentionally unsupported under historical finding F2.

Seven new Playwright cases (NEX-024–030) were added. The final scoped Chromium run passed all 22 cases: 15 pre-existing page-attributed cases and 7 additions. The focused isolated API module passed 10/10 reported test entries against PGlite. The earlier F2 behavior was preserved.

No application defect was verified. Remaining limits are explicit: browser requests were mocked, there was no live database run, unusual Unicode and API-only validation boundaries were assessed from source rather than exhaustively exercised, and the repository has a stale client-creation statement in `docs/rbac.md`.

## 2. Git Baseline

| Item           | Initial                                                                                            | Final                                                                                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch         | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | Same                                                                                                                                                                                                                                                                                    |
| HEAD           | `6b1d80c9fc463e110eb5c45e17623e3544c59fb4`                                                         | Same                                                                                                                                                                                                                                                                                    |
| Working tree   | Clean; no staged, unstaged, or untracked files                                                     | Two authorized Page 5 files are untracked. A separate audit-document relocation is also visible: the tracked `docs/INPUT_VALIDATION_AUDIT.md` path is deleted and an exact-content copy exists at `docs/testing/INPUT_VALIDATION_AUDIT.md`; it was left untouched as out-of-scope work. |
| Staged changes | None                                                                                               | None                                                                                                                                                                                                                                                                                    |
| Commit/push    | —                                                                                                  | Neither performed                                                                                                                                                                                                                                                                       |

The Page 1–4 files were already tracked at the initial HEAD. Their before-run hashes, the five relevant browser specs, shared regression support, API client integration test, and Phase 7 reports are retained in `test-results/phase7/page-by-page/page-05-client-management/pre-change-file-hashes.json`. The preservation snapshot is `pre-change-preservation.json`. The separate audit-document relocation has identical Git blob content at its new path and was not changed as part of Page 5.

Playwright output, screenshots, logs, and JSON snapshots are under `test-results/phase7/page-by-page/page-05-client-management/`. This directory is Git-ignored by `**/test-results/`; it is local execution evidence, not a tracked report artifact.

## 3. Client Management Source Inventory

The route entry is `apps/web/src/app/(portal)/clients/page.tsx`; screen state and directory controls are in `apps/web/src/features/clients/pages/client-management-page.tsx`.

| Feature                         | Source and trigger                                                                                                  | Supported result and API dependency                                                                                                                                                                     | Roles and error handling                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Directory and list              | `client-management-page.tsx`; visit `/clients`                                                                      | Loads the paged `ClientList` from `GET /api/clients`; table columns are name, email, contact, status, registration date, and actions.                                                                   | Admin only through `clients:read`; skeleton, empty, no-match, and retryable error states are implemented.                          |
| Search, status, sort, page      | `client-management-page.tsx`, `client-table.tsx`, `clients-api.ts`; type search, select status/sort, or change page | API query supports name/email search, Active/Inactive status, four sort keys, direction, and ten records per page. Search text is trimmed before request; changing search/status/sort resets to page 1. | Admin only. A failed list request is shown as an alert with “Try again”.                                                           |
| Creation                        | `client-management-page.tsx`, `client-form-dialog.tsx`; select “Create Client”                                      | `POST /api/clients`; creates a `USER`, closes the form, shows success feedback, and reloads the list.                                                                                                   | Admin only. Field/API errors are shown in the form and submitted values remain available after a failed save.                      |
| Client details                  | `client-table.tsx`, `client-details-drawer.tsx`; select a row’s eye action                                          | `GET /api/clients/:id`; overview shows contact/account fields and related counts. The details drawer restores focus to the eye action when closed.                                                      | Admin only; loading and retryable error states are present.                                                                        |
| Related records                 | `client-details-drawer.tsx`; select “View service requests” or “View projects”                                      | `GET /api/clients/:id/service-requests?page=…` and `/projects?page=…`; tabs show paginated, read-only rows. Tab buttons switch drawer content; rows do not navigate to another page.                    | Admin only through the same read permission; empty, loading, retry, and pagination states are implemented.                         |
| Editing/status changes/deletion | `client-table.tsx`, `client-management-page.tsx`, `clients.controller.ts`                                           | There is no supported edit, status-change, delete, or restore action in the directory. See Section 5 for the inaccessible API routes and F2 reconciliation.                                             | No role can use the current `PATCH` or `DELETE` routes because the router’s outer read permission and route role are incompatible. |

### Data model and relationships

There is no separate Client model. A client is a `User` with `role = USER` and `accountDeletedAt = null`. Existing inactive accounts stay in the directory. The page’s safe projection is `id`, nullable `fullName`, `email`, nullable `contactNumber`, `isActive`, and `createdAt`; password hashes, session records, permission details, and other account fields are excluded.

The source-backed client relationships are `ServiceRequest.clientId` and `Project.clientId`, both referencing `User.id`. The details API exposes request/project counts and paginated summaries. This page does not expose billing, quotation, or service-management records. Service requests and projects are read-only here.

## 4. Client Data and Validation Matrix

| Field                     | UI rule                                                                                                                          | API/source rule                                                                                                                                                                                                               | Coverage and discrepancy                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fullName`                | Required text; `minLength=2`, `maxLength=100`; trim before submit; trimmed name must be at least 2 characters.                   | Required on create; `validRegistrationProfile` trims and accepts lengths 2–100. No character allowlist is applied, so Unicode is not explicitly excluded.                                                                     | NEX-024 checks the trimmed two-character minimum; NEX-025 checks 100 characters. Existing form tests cover missing values. Unicode and whitespace-only boundary variants are source-reviewed, not separately runtime-tested.                                                                                                                                                                                              |
| `email`                   | Required `type=email`; `maxLength=254`; trimmed before submit.                                                                   | `normalizedEmail` trims and lowercases, requires at most 254 characters and `local@domain.tld`-style syntax. Repository lookup prevents case-insensitive duplicate email across user accounts; database email is also unique. | Existing browser coverage checks malformed email and a 409 duplicate/retry. PGlite verifies normalized creation, conflict, and safe response. Distinct case-variant collision and unusual Unicode email boundaries are source-only.                                                                                                                                                                                       |
| `contactNumber`           | Required `type=tel`; `maxLength=20`; after trim, regex `^\\+?[0-9][0-9\\s-]{6,19}$`. The form message describes 7–20 characters. | Same regex after trim in `validRegistrationProfile`; accepts ASCII digits, whitespace, hyphens, and an optional leading `+`.                                                                                                  | NEX-024 checks the 7-character minimum and surrounding whitespace; NEX-025 checks 20 characters; NEX-026 rejects six characters and a letter. The server regex can admit 21 characters when the optional `+` is followed by a 20-character remainder, while the UI caps the field at 20. This source-level boundary mismatch is recorded, not classified as a defect. There is no source-enforced Philippine prefix rule. |
| `isActive`                | Required status select on create; defaults to Active; exposes Active/Inactive.                                                   | Required boolean in the client input parser. Creation persists the selected status.                                                                                                                                           | NEX-028 verifies an Inactive selection reaches the request and row. PGlite creation coverage verifies the default active case. There is no supported status transition after creation in Client Management.                                                                                                                                                                                                               |
| Initial `password`        | Required for create; `minLength=12`, UI `maxLength=256`; omitted from the edit form branch.                                      | Create-only; at least 12 JavaScript characters and at most 1024 UTF-8 bytes; hashed with scrypt. It is never included in the safe response.                                                                                   | NEX-024 exercises 12 characters and NEX-025 the UI maximum of 256. API tests reject a short password and confirm the stored value is hashed and not returned. The UI’s 256-character cap is narrower than the API’s byte limit; this is an observed contract difference, not a verified defect.                                                                                                                           |
| `id`, `createdAt`, `role` | No form controls; shown in details where appropriate.                                                                            | ID and creation time are generated; client creation forces role `USER`. Extra role data is not copied into the parsed profile.                                                                                                | PGlite verifies an attempted `role: SUPERADMIN` input still creates a `USER` and that credentials are omitted. These fields are not editable in the UI.                                                                                                                                                                                                                                                                   |

The input parser reconstructs the accepted profile from `email`, `fullName`, `contactNumber`, and `isActive`; on creation it additionally accepts `password`. Unsupported properties are ignored by that parser. For a hypothetical PATCH that reached the handler, all four profile values are required, so it would not behave as a partial update; password is not an update field. The current permission gate prevents any role from reaching that handler.

| Directory control | Client rule                                                                                                    | Server rule                                                                                    | Existing/new coverage                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Search            | `type=search`, max 100; UI trims; matches name or email.                                                       | Query parser trims, accepts at most 100 characters, and repository search is case-insensitive. | Existing search/empty/clear tests; NEX-027 verifies trimmed request; PGlite tests case-insensitive search and rejects 101 characters.           |
| Status filter     | All, Active, Inactive; selecting one resets page 1.                                                            | Only empty, `ACTIVE`, or `INACTIVE`; repeated/unsupported values are rejected.                 | Existing list filter behavior; NEX-027 verifies combined search + ACTIVE request; PGlite verifies status and rejects malformed/repeated values. |
| Sort              | Four keys (`fullName`, `email`, `isActive`, `createdAt`), ascending/descending; defaults to newest registered. | Same four keys and `asc`/`desc`; defaults `createdAt:desc`; stable `id:asc` tie-breaker.       | Existing name sort; NEX-027 verifies mobile selector query and ordering; PGlite verifies sort keys, directions, tied dates.                     |
| Page              | Numbered pagination; page changes request new results; page size comes from response.                          | Integer 1–1,000,000; default 1; page size fixed at 10; beyond-last pages return empty results. | NEX-027 verifies next page and range; PGlite verifies ten-row pages, no overlaps, out-of-range page, and malformed bounds.                      |

## 5. Client Lifecycle and Update Contract

### Creation

The supported path is Admin form → required-field and client-side checks → `POST /api/clients` → API validation and duplicate check → serializable Prisma transaction → `USER` record with hashed password → safe client projection. The form trims name, email, and contact before sending. A duplicate email returns 409; invalid input returns 400; success returns 201. Browser tests verify mocked form submission and recovery; the isolated API test verifies persistence in PGlite.

### Historical F2: read-only update/deletion behavior

The [Phase 4 historical report](../../../migrations/phase4/baseline/artifacts/report.md#verified-limitations-and-classifications) classifies F2 as **INTENTIONAL BEHAVIOR**. It says to preserve the no-`PATCH`/no-`DELETE` browser contract and the API rejection assertions; it also calls the edit branch dormant and notes that the router requirements are incompatible. Current source confirms that contract:

- `clientsRouter.use(requireAuth, requirePermission(Permission.CLIENTS_READ))` applies to every client route. `CLIENTS_READ` is assigned to Admin only.
- The collection create route additionally requires `ADMIN`.
- The `PATCH /:id` and `DELETE /:id` routes additionally require `SUPERADMIN`. Superadmin fails the outer `clients:read` middleware; Admin fails the exact-role middleware. Staff and User also fail the outer gate.
- The PGlite test verifies 403 for mutation attempts by Admin, Superadmin, Staff, and User. Existing browser tests verify the directory exposes no edit/delete action and emits no PATCH/DELETE request during the create/details flow.
- The form component contains a dormant edit branch, but the page never sets an existing client as the form target. This is not missing supported coverage and is not being reclassified as a defect.

Thus, operationally, **no client profile field can be changed through Client Management**. In the unreachable parser/handler branch, the accepted payload would include name, email, contact, and active status; it would not accept password updates or role changes, would ignore unrelated payload fields, and would require the full profile. This latent code does not supersede the verified read-only public contract.

Deletion/restoration is likewise not a supported Client Management operation. The dormant repository deletion method uses soft deletion and refuses linked request/project records, but the route is unreachable under the same role mismatch. Account retirement through other account-management routes is outside this page’s supported workflow.

## 6. Authorization Matrix

| Operation                                | Role                      | UI permission/action         | API enforcement and result                                                                    | Evidence                                                   |
| ---------------------------------------- | ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Read directory, details, related records | ADMIN                     | Route and controls visible   | `clients:read`; allowed                                                                       | Four-role browser cases and PGlite read tests              |
| Read directory, details, related records | SUPERADMIN                | Redirected from `/clients`   | No `clients:read`; 403                                                                        | Shared role browser case and PGlite read test              |
| Read directory, details, related records | STAFF / USER              | Redirected from `/clients`   | No `clients:read`; 403                                                                        | Shared role browser cases and PGlite read tests            |
| Create client                            | ADMIN                     | “Create Client” form visible | `clients:read` plus exact `ADMIN`; 201 for valid input                                        | NEX-024–030 and PGlite creation case                       |
| Create client                            | SUPERADMIN / STAFF / USER | No directory action          | Outer read permission denies; 403                                                             | PGlite mutation-role assertions; UI route guards           |
| Edit/status update via client PATCH      | All roles                 | No supported edit action     | Admin fails exact `SUPERADMIN`; Superadmin fails `clients:read`; all tested roles receive 403 | F2 source reconciliation and PGlite no-mutation assertions |
| Delete/restore via client route          | All roles                 | No supported action          | Same incompatible route gates; all tested roles receive 403. No client restore route exists.  | F2 source reconciliation and PGlite mutation assertions    |

UI visibility is not used as proof of server authorization; API enforcement was verified separately in the PGlite integration module.

## 7. Existing Regression Inventory

The pre-change Page 5 browser group contained 15 cases: 14 historical Phase 4 identities plus the additional NEX-012 related-record case. The 14 original IDs are `PW-009`, `PW-010`, `PW-031`, `PW-032`, `PW-053`–`PW-056`, `PW-059`, `PW-062`, `PW-249`, `PW-250`, `PW-283`, and `PW-288`. The Phase 6 preservation map ties these IDs to 73 distinct assertion locations through 178 identity-to-site mappings.

Existing files and behavior:

- `apps/web/e2e/auth/admin.spec.ts`: two protected-route/session lookup cases for `/clients`.
- `apps/web/e2e/clients/client-mutations.spec.ts`: 1440px/390px required/email validation, duplicate conflict retry, successful creation, read-only details, and absence of edit/delete requests/actions.
- `apps/web/e2e/clients/related-records.spec.ts`: NEX-012, fixture-scoped requests/projects pagination and read-only details.
- `apps/web/e2e/clients/responsive-data-table.spec.ts`: loading, sort, search/no-results, list error/retry, focus, table semantics, and mobile overflow/action sizing.
- `apps/web/e2e/shared/clients.spec.ts`: all four role route guards and create-form cancellation/focus at desktop and mobile sizes.
- `apps/web/e2e/shared/table-interactions.spec.ts`: `/clients` search preview and clear behavior at 1440px/390px.
- `apps/api/src/client-integration.test.ts`: isolated reads, filtering, sorting, pagination, related records, role authorization, create validation/duplicate handling, and no-op mutation rejection.

Existing tests are retained unchanged. The preservation snapshot and SHA-256 file list are in the evidence directory.

## 8. New Regression Tests

Created only `apps/web/e2e/clients/client-input-contract.spec.ts`:

| Test title                                                                                              | Feature                  | New assertion focus                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `[NEX-024] client creation accepts minimum profile boundaries and trims name and contact`               | Create/input validation  | Two-character trimmed name, seven-character trimmed contact, 12-character password, normalized request payload, and resulting row. |
| `[NEX-025] client creation accepts the exact name, contact, and password UI maxima`                     | Create/input validation  | UI `maxlength` values and accepted 100-character name, 20-character contact, and 256-character UI password.                        |
| `[NEX-026] client creation rejects malformed and short contact numbers before posting`                  | Create/input validation  | Six-character and malformed contact values show a form error and produce no POST.                                                  |
| `[NEX-027] client directory trims search, combines active filtering and sorting, and paginates results` | Directory query behavior | Default sort, page 2 request and range, trimmed search, combined ACTIVE filter, mobile sort selector, and rendered results.        |
| `[NEX-028] client creation preserves the selected inactive initial status`                              | Initial lifecycle state  | Inactive selection is sent as `isActive: false` and displayed in the directory.                                                    |
| `[NEX-029] client form disables submission while one save is pending`                                   | Submission state         | A held save disables the submit and cancel controls, preserves one request, then closes after success.                             |
| `[NEX-030] client creation retains values after a network failure and retries the same payload`         | Error recovery           | Network failure keeps the form values and permits a second identical request that succeeds.                                        |

The new cases use synthetic fixtures and same-origin API route mocks. They do not assert real persistence or introduce edit/delete expectations.

## 9. Feature-to-Test Matrix

| Feature                                                       | Source                                                                  | Test assertion/result                                                                                                                                              | Verification level                                                               | Feature result                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| Admin route access and protected session state                | Portal permission rules; `auth/admin.spec.ts`; `shared/clients.spec.ts` | Existing route guards pass for all four roles; server-side read roles also pass in PGlite.                                                                         | MOCKED_UI_VERIFIED; ISOLATED_API_VERIFIED                                        | VERIFIED_PASS                                   |
| List loading, presentation, empty/error/retry, responsiveness | `client-management-page.tsx`; `client-table.tsx`                        | Existing loading, sorting/search/error retry, row action, and mobile checks pass.                                                                                  | MOCKED_UI_VERIFIED                                                               | VERIFIED_PASS for covered states                |
| Search/filter/sort/pagination                                 | `clients-api.ts`; `clients.schema.ts`; `clients.repository.ts`          | NEX-027 verifies request query and rendering; PGlite verifies case-insensitive search, combined status, stable sorting, ten-row pagination, and out-of-range page. | MOCKED_UI_VERIFIED; ISOLATED_API_VERIFIED                                        | VERIFIED_PASS                                   |
| Creation and validation                                       | `client-form-dialog.tsx`; client API schema/repository                  | Existing creation/retry plus NEX-024–026 and NEX-028 pass; PGlite verifies 201, 400, duplicate 409, forced USER role, hash, and safe response.                     | MOCKED_UI_VERIFIED; ISOLATED_API_VERIFIED                                        | VERIFIED_PASS for asserted contract             |
| Pending save and network recovery                             | `client-form-dialog.tsx`; `clients-api.ts`                              | NEX-029 verifies duplicate submission is prevented while pending; NEX-030 verifies values are retained and the same payload succeeds on retry.                     | MOCKED_UI_VERIFIED                                                               | VERIFIED_PASS                                   |
| Duplicate prevention                                          | `clients.repository.ts`                                                 | Browser conflict/retry and PGlite conflict pass; case-insensitive lookup is confirmed in source.                                                                   | MOCKED_UI_VERIFIED; ISOLATED_API_VERIFIED; SOURCE_ONLY for distinct case variant | PARTIALLY_VERIFIED                              |
| Details and safe field projection                             | `client-details-drawer.tsx`; `clients.repository.ts`                    | Existing detail view passes; PGlite confirms only six safe client fields and no credential exposure.                                                               | MOCKED_UI_VERIFIED; ISOLATED_API_VERIFIED                                        | VERIFIED_PASS                                   |
| Related requests/projects                                     | Drawer tabs; client repository                                          | NEX-012 verifies mocked tab/pagination rendering; PGlite verifies isolated relation counts, fields, authorization, and pages.                                      | MOCKED_UI_VERIFIED; ISOLATED_API_VERIFIED                                        | VERIFIED_PASS for read behavior                 |
| Edit/status transition/delete/restore                         | Client page, router, repository                                         | No supported UI action; PGlite confirms all tested PATCH/DELETE attempts are denied and denied PATCH leaves stored fields/password unchanged.                      | SOURCE_ONLY; ISOLATED_API_VERIFIED                                               | INTENTIONALLY_UNSUPPORTED (F2)                  |
| Accessibility and stability                                   | Page/table/form/drawer components                                       | Limited heading, labels, semantic table, dialog focus, responsive control sizing, retry, and no-overflow assertions pass.                                          | MOCKED_UI_VERIFIED                                                               | PARTIALLY_VERIFIED; no full accessibility claim |

## 10. Execution Results

### Browser

- Browser: Chromium, Playwright 1.64.1; Node v24.16.0; one worker; zero retries; live mode forced off.
- The existing `.next` standalone build had build ID `7jgxRDZUuknQmb_qEaXZ2`, timestamp 2026-11-11 19:22:07 +08:00. It was produced after the initial HEAD timestamp; the last Client source commit predates it. No application source changed in this task.
- Final discovered group: 22 unique cases (15 pre-existing plus NEX-024–030). Final execution: 22 executed, 22 passed, 0 failed, 0 skipped, 0 blocked.
- Initial pre-NEX-028 group: 19 cases, 18 passed and one newly added NEX-027 assertion failed because animated/responsive content produced duplicate matching text nodes. This was a new-test locator defect, not an application failure. The trace and error context were retained. The locator was narrowed to a semantic row and reduced-motion was enabled.
- Targeted NEX-027 rerun: 1/1 passed. The corrected 19-case group then passed 19/19. NEX-028 targeted run passed 1/1. The prior complete 20-case group passed 20/20.
- Initial seven-case run for NEX-024–030: 6 passed and NEX-029 failed because its accessible-name locator stopped matching after the submit label changed to “Saving…”. The dialog and fields remained open/disabled as intended. This was a newly added test locator defect. The locator was changed to the submit button type; targeted NEX-029 rerun passed 1/1.
- Final complete 22-case run passed 22/22. No confirmed flaky behavior; the two first-run locator failures were test defects and remain reported above.

Final command (run from repository root):

```powershell
$env:NEXUS_E2E_LIVE='0'
$env:NEXUS_E2E_BASE_URL='http://127.0.0.1:5273'
node apps/web/node_modules/@playwright/test/cli.js test --config=apps/web/playwright.config.ts `
  apps/web/e2e/auth/admin.spec.ts `
  apps/web/e2e/clients/client-input-contract.spec.ts `
  apps/web/e2e/clients/client-mutations.spec.ts `
  apps/web/e2e/clients/related-records.spec.ts `
  apps/web/e2e/clients/responsive-data-table.spec.ts `
  apps/web/e2e/shared/clients.spec.ts `
  apps/web/e2e/shared/table-interactions.spec.ts `
  --grep '[Cc]lient|/clients' `
  --grep-invert 'client retries a failed submission|client submits standard service|workspace, team, task and deliverable tables|/employees previews|/booked-services previews|/request-inbox previews|/service-requests previews' `
  --workers=1 --retries=0 --reporter=line `
  --output=test-results/phase7/page-by-page/page-05-client-management/playwright-final-22
```

The local standalone server on port 5273 was stopped after execution. The final log is `client-browser-final-22.log`; the corrected NEX-029 rerun is recorded in `client-browser-nex029-rerun.log`. Screenshots and test failure traces/error contexts are retained beneath the evidence directory.

### Focused API

`apps/api/src/client-integration.test.ts` was compiled from the current source and run against its temporary PGlite database. The ordinary Node runner could not spawn a worker in the sandbox (`EPERM`); `node --test --test-isolation=none dist/client-integration.test.js` ran the same focused module in-process and passed 10/10 reported entries (parent plus nine subtests), with 0 failures and 0 skips. No live or shared database was used. `client-api-test-summary.md` records the command and case scope.

### Static checks

The first `pnpm` invocations could not open the global store operation lock (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`, access denied). After package-manager lock access was granted, the required `pnpm format`, `pnpm lint`, and `pnpm typecheck` commands each passed with exit code 0. Formatting reported all files unchanged; lint passed with `--max-warnings 0`; typecheck passed for web and API, including Prisma generation and Next route type generation. The repository pins pnpm 12.7.0 while the installed version is 12.15.0.

Direct local equivalents also passed: repository-wide Prettier check, direct ESLint, web TypeScript `--noEmit`, and API TypeScript `--noEmit`. The API source was compiled before the PGlite test. `git diff --check` passed in the final audit.

## 11. Defect and Failure Register

| Finding                                  | Classification                                  | Expected/actual and evidence                                                                                                                                                                                    | Resolution/status                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Historical F2: client edit/delete        | ACCEPTED_LIMITATION / INTENTIONAL BEHAVIOR      | Expected and actual behavior is read-only details. The global `clients:read` permission is Admin-only while the mutation routes require Superadmin. Browser and PGlite tests preserve the no-mutation contract. | Preserved. No application change or edit-success expectation added.                                                                   |
| `docs/rbac.md` client creation statement | ACCEPTED_LIMITATION (documentation discrepancy) | The RBAC paragraph says the Admin client directory exposes no creation, while the current page, `POST` route, client feature specification, and PGlite test support Admin creation.                             | Recorded only; documentation was not changed in this test-only assignment.                                                            |
| UI/API input caps                        | ACCEPTED_LIMITATION / SOURCE-ONLY discrepancy   | UI password cap is 256 characters vs API 1024 UTF-8 bytes; UI contact `maxLength=20` vs optional-plus server regex boundary up to 21 characters.                                                                | No defect inferred. UI-supported boundaries were exercised; API boundary differences are identified for future contract review.       |
| Initial NEX-027 locator                  | TEST_DEFECT                                     | Strict text locator matched duplicate transient/responsive DOM nodes during filtering; evidence is in the first 19-case run trace and error context.                                                            | Corrected to locate a semantic row and respect reduced motion; targeted case passed and final suite passed.                           |
| Initial NEX-029 locator                  | TEST_DEFECT                                     | The submit button changed its accessible name to “Saving…” while pending, so the original name-based locator could not find it for the disabled assertion.                                                      | Changed to a stable `button[type=submit]` locator; targeted rerun and final 22-case group passed.                                     |
| Initial sandbox worker spawn             | ENVIRONMENT_FAILURE                             | Default Node/Playwright worker spawn returned `EPERM` before browser cases ran.                                                                                                                                 | A reviewed process-spawn exception was used for the bounded local browser run; final group completed. API tests used in-process mode. |

No application, client validation, authorization, API contract, or data integrity defect was verified.

## 12. Client Data Integrity Assessment

- **Creation:** PGlite confirms a new client is stored as `USER`, the password is scrypt-hashed, and password hash/credentials are absent from responses. Duplicate creation is rejected with 409. Creation uses a serializable transaction.
- **Read projections:** The directory and detail response select only the safe six-field client projection. PGlite tests verify no credential material is exposed.
- **Denied mutations:** The PGlite test attempts PATCH/DELETE with the tested roles. Denied PATCH leaves the saved name, active state, and password hash unchanged.
- **Relationships:** PGlite fixtures verify client ownership and paginated request/project results using synthetic rows. The browser related-record fixture verifies tab association and pagination, but is mocked.
- **Unverified:** There is no accessible Client Management update route to verify successful update persistence, and no live database/browser integration was attempted. Direct cross-page propagation beyond these read-only relationships remains outside this page’s verification.

## 13. Integration Limitations

- All browser API responses are Playwright route mocks; browser success is not evidence of durable persistence. PGlite is the separate isolated persistence/authorization evidence.
- There was no live Supabase/shared database access and no production client data was read or changed.
- The drawer exposes tabs for service requests and projects but not links to their destination pages. Cross-page propagation was not added.
- Accessibility checks cover selected semantics, labels, focus restoration, and responsive behavior only. They are not a comprehensive accessibility audit.
- Some validation details (Unicode edge cases, distinct case-variant duplicate collision, server maximum boundaries) are source-only; no live integration claim is made.

## 14. Historical Preservation

- The original 14 Client Management Playwright IDs and their mapped assertion sites were not edited or renamed. The pre-change mapping snapshot records 73 distinct assertion locations and 178 mappings for those IDs.
- NEX-012 remains unchanged. Seven new cases NEX-024–030 are counted separately.
- The global Phase 6 baseline remains 292 original identities, 1,630 historical assertion sites, 4,211 mappings, and 34 pre-existing additional browser cases. Page 5 additions are not folded into those historical totals.
- Page 1–4 tests, reports, and evidence were hash-snapshotted before work and remained unchanged. Page 4 artifacts were tracked at initial HEAD. The final audit also records the exact-content relocation of the separate Input Validation Audit document; it is outside this page’s changes.
- No app source/API files, schemas, migrations, package files, prior page tests, or prior reports changed.

## 15. Page Acceptance Assessment

All applicable Page 5 requirements are complete: current source and F2 were inspected; fields, operations, validation, roles, dependencies, and current tests were inventoried; seven missing browser cases were implemented; all 22 applicable browser cases passed in the final run; focused PGlite API verification passed; traceability and limitations are documented; and historical files were preserved.

The page is administratively complete with the accepted F2 read-only behavior, UI/API boundary differences, a stale documentation statement, and no live browser-to-database verification. Those limitations do not require changing application behavior or weakening tests.

## 16. Next Page Readiness

Client Management uses `User` records with `role = USER`; Employee Management creates/uses staff records and has no direct Client Management mutation dependency. The relevant client relationship context—service requests and projects—is recorded above. Page 6 may proceed as its own scope. **Page 6 was not started, and Phase 7.5 was not started.**
