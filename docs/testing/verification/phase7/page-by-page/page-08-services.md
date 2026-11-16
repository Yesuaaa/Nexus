# Phase 7.4.1 — Page 8: Services

**Route:** `/services`  
**Scope:** Services source inspection, regression coverage, isolated API verification, and Page 8 evidence only.  
**Verification date:** 2026-11-13

## A. Page status

**COMPLETE WITH VERIFIED DEFECTS.** The source and current regression coverage were audited, five browser cases and four API leaf cases were added, the focused suites were executed, failures were investigated, and this report was produced. The failures remain visible and no application code was changed. This status describes the audit and test work; it does not represent administrative acceptance.

## B. Git baseline

| Item           | Initial                                                                                            | Final                                                           |
| -------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Branch         | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | Same                                                            |
| HEAD           | `7aaaa55cfe0fbc4c2a1b833d2cbfa74d2abe9f82`                                                         | Same                                                            |
| Worktree       | Clean; no staged, modified, or untracked non-ignored files                                         | Six new files listed in Section M; no tracked or staged changes |
| Commit or push | —                                                                                                  | Neither performed                                               |

The branch and HEAD matched the expected Page 8 baseline. No branch switch, fetch, merge, rebase, reset, commit, or push occurred. No accepted Page 1–7 test, report, source file, package file, lockfile, or Prisma schema was changed. Test outputs are kept under the ignored Page 8 evidence directory.

## C. Source inspection

The route entry [`apps/web/src/app/(portal)/services/page.tsx`](<../../../../apps/web/src/app/(portal)/services/page.tsx>) renders `ServicesPage`. The page selects `ClientServicesPage` for `USER` and `ServiceManagementPage` otherwise; route policy permits the exact `/services` route to `USER` catalog access or `ADMIN` service management, while `/services/*` management routes require the Admin service permission. See `apps/web/src/features/services/pages/services-page.tsx:23`, `apps/web/src/features/workspaces/model/route-policy.ts:210-230`, and `apps/web/src/features/auth/model/permissions.ts:61-73`.

The Admin management view in `apps/web/src/features/services/pages/service-management-page.tsx:75-285` loads services, departments, and pricing templates together through the web API clients. It presents loading and retryable error states, keeps create/edit/detail/status/delete/template dialog state locally, and updates the local catalog after successful responses. `ServiceTable` in `apps/web/src/features/services/components/service-table.tsx:95-165` performs search, filtering, sorting, and pagination in the browser. The service wizard is in `service-form-dialog.tsx`; details, status confirmation, deletion confirmation, and template management are separate components.

The `USER` branch in `apps/web/src/features/services/pages/client-services-page.tsx:89-` provides a service catalog, service details, package selection, specialist selection, request form, and submitted request view. It uses the client service API client, not the Admin management client. The current success page heading is **“Request submitted”**; the Sileo toast title is **“Service request submitted for review”**.

The service management API is mounted at `/api/services` in `apps/api/src/app.ts:37` and defined in `apps/api/src/features/services/services.controller.ts:6-122`. Business rules and status mapping are in `services.service.ts`; input validation is in `services.schema.ts`; persistence is in `services.repository.ts`. Create and update persist the service, related packages/benefits, department links, and any newly created pricing template within Prisma transactions. The client catalog and client request endpoints are separately mounted under `/api/client` and restricted to `Role.USER` in `apps/api/src/features/client-services/client-services.controller.ts`.

The relevant schema is `apps/api/prisma/schema.prisma:222-319`. `Service` is linked to departments, packages, benefits, pricing templates, and historical service requests. A service request’s service relation uses `onDelete: Restrict`. The Page 7 department deletion behavior was reviewed as a dependency; its suite was not repeated here.

## D. Services feature inventory

| Feature                        | Implemented behavior                                                                                                                                                                                                                   | Verification                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Admin service directory        | Table shows service name, description, associated departments, active state, creation date, and actions. Details expose the rest of the configured service. There are no service code, category, or fee columns.                       | Existing cases plus new local table interaction cases; `MOCKED_UI_VERIFIED`                                   |
| Client service catalog         | `USER` browses active services, opens details, selects packages and specialists, fills request requirements, and submits a request.                                                                                                    | Existing responsive cases; `MOCKED_UI_VERIFIED`                                                               |
| Create and edit                | Admin service wizard creates and edits supported service fields, departments, image, requirements, workflow flags, benefits, pricing, and packages. Create produces an active service.                                                 | Existing create/edit tests and new validation recovery test; `MOCKED_UI_VERIFIED`                             |
| Pricing templates              | Admin reads, updates, and deletes unused templates. Templates in use cannot be deleted.                                                                                                                                                | Existing pricing template tests; `MOCKED_UI_VERIFIED` and API coverage                                        |
| Status lifecycle               | Admin activates or deactivates with confirmation. Deactivation removes a service from active client options while preserving linked history.                                                                                           | Existing success tests; new rejection/retry case; `MOCKED_UI_VERIFIED` and `ISOLATED_API_VERIFIED`            |
| Service deletion               | Admin must deactivate first and confirm deletion. A service referenced by a service request remains undeletable.                                                                                                                       | Existing confirmation test and new PGlite relationship test; `MOCKED_UI_VERIFIED` and `ISOLATED_API_VERIFIED` |
| Search and table controls      | Search matches service name, description, and department name; department and status filters can be combined; sorting supports name, status, and created date; page size is 10. These controls are local, not server query parameters. | New combined-filter/sort case and search-clear regression; `MOCKED_UI_VERIFIED`                               |
| Unsupported or absent controls | No service code/category field, archive/restore flow, fee/duration field, or page-size selector was found in the current `/services` management UI.                                                                                    | `SOURCE_ONLY`                                                                                                 |

## E. Input validation

The field contracts below come from the current form and `apps/api/src/features/services/services.schema.ts`. UI constraints, API validation, business checks, and database constraints are distinct layers.

| Input                                 | Source-backed contract                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service name                          | Required; API trims and accepts 2–100 characters. UI caps at 100. Database uniqueness is case-sensitive; duplicate names map to conflict. Whitespace-only input fails the UI’s minimum length rule.                                                                                                                                                                                                                      |
| Description                           | Required; trimmed length 2–500 characters.                                                                                                                                                                                                                                                                                                                                                                               |
| Icon key                              | Nine supported keys; omitted API value is inferred from the service name, otherwise defaults to `sparkles`. No separate service category field exists.                                                                                                                                                                                                                                                                   |
| Responsible departments               | At least one non-empty ID; IDs are trimmed and de-duplicated. API verifies each referenced department exists; missing references are rejected before persistence.                                                                                                                                                                                                                                                        |
| Image and alt text                    | Optional WebP data URL, maximum 2 MiB. Alt text is optional when there is no image and otherwise must be 2–160 characters. Upload and remove cannot be requested together.                                                                                                                                                                                                                                               |
| Client requirements                   | API accepts up to 20 strings, each trimmed to 1–200 characters. The multiline UI has no matching length or item-count limit. The new browser case sends a 201-character requirement, observes a mocked API rejection, and verifies the form retains the value.                                                                                                                                                           |
| Workflow flags and consultation notes | Consultation defaults false; agreement and payment default true; quotation approval defaults false. Flags must be booleans. Notes are trimmed, at most 500 characters, and omitted from persistence when consultation is off.                                                                                                                                                                                            |
| Key benefits                          | Optional list of at most 10; title 2–120, description 2–500; titles must be unique after case normalization.                                                                                                                                                                                                                                                                                                             |
| Pricing template                      | Name 2–100; pricing model must be a supported enum; currency is normalized to a three-letter uppercase code (default `PHP`). Non-quotation models require a finite amount greater than zero; recurring pricing requires an interval and other models reject one. A template ID must be 1–80 characters and cannot be combined with a new inline template.                                                                |
| Service packages                      | Optional list, maximum 20. Name 2–80 and unique within the service after case normalization; description 2–500; 1–30 included features, each 1–160 characters. IDs must belong to the edited service. Status/public/recommended values are booleans; display order is an integer from 0–10,000; at most one package can be recommended. The UI’s package workflow requires at least two packages when packages are used. |
| Pricing amounts                       | API and numeric UI input allow values greater than zero up to `99,999,999,999.99`. However, both `PricingTemplate.amount` and `ServicePackage.amount` are `Decimal(12,2)`, whose maximum is `9,999,999,999.99`. This is a confirmed validator/database boundary mismatch (SVC-001, Section L).                                                                                                                           |
| Directory search                      | Local text input capped at 100 characters. Search, department filter, status filter, and sort state form the local table view key.                                                                                                                                                                                                                                                                                       |

Two validation gaps are confirmed. First, the client requirements UI permits values that the API rejects after submission. Second, pricing validation permits values the Decimal database columns cannot store. Neither was fixed in this testing-only task.

## F. API contract results

The `/api/services` router applies authentication to all of its routes. Permission checks use the API role-permission map; only `ADMIN` has `services:read` and `services:manage`. Client catalog and submission routes use a separate `Role.USER` router.

| Method and route                                                                                       | Access                      | Observed contract                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/services/available`                                                                          | Any authenticated role      | Returns active services for request workflows.                                                                                                                                                 |
| `GET /api/services`                                                                                    | `services:read` (`ADMIN`)   | Returns `{ services }`.                                                                                                                                                                        |
| `GET /api/services/:id`                                                                                | `services:read` (`ADMIN`)   | Returns `{ service }`; missing service is 404.                                                                                                                                                 |
| `GET /api/services/pricing-templates`                                                                  | `services:read` (`ADMIN`)   | Returns `{ pricingTemplates }`.                                                                                                                                                                |
| `PUT /api/services/pricing-templates/:id`                                                              | `services:manage` (`ADMIN`) | Validates and updates a template; invalid input 400, missing template 404, duplicate name 409.                                                                                                 |
| `DELETE /api/services/pricing-templates/:id`                                                           | `services:manage` (`ADMIN`) | Deletes an unused template; missing template 404, in-use template 409.                                                                                                                         |
| `POST /api/services`                                                                                   | `services:manage` (`ADMIN`) | Creates and returns `{ service }` with 201. Invalid fields or missing department/template references return 400; duplicate name returns 409. Numeric overflow currently returns 500 (SVC-001). |
| `PUT /api/services/:id`                                                                                | `services:manage` (`ADMIN`) | Full service update; invalid fields or references 400, missing service 404, duplicate name 409.                                                                                                |
| `PATCH /api/services/:id/status`                                                                       | `services:manage` (`ADMIN`) | Requires boolean `isActive`; invalid type 400, missing service 404, successful update returns `{ service }`.                                                                                   |
| `DELETE /api/services/:id`                                                                             | `services:manage` (`ADMIN`) | Active or missing service returns 409 or 404 respectively. Inactive service with linked request returns 409; successful deletion returns a success message.                                    |
| `GET /api/services/:id/specialists` and `GET /api/services/:id/specialists/:specialistId`              | Any authenticated role      | Specialist directory/profile reads are implemented under the authenticated service router.                                                                                                     |
| `GET /api/client/services`, `GET /api/client/services/:id`, `GET /api/client/services/:id/specialists` | `USER` only                 | Client catalog, service detail, and specialist reads.                                                                                                                                          |
| `POST /api/client/service-requests`                                                                    | `USER` only                 | Submits a client service request and returns `{ serviceRequest }` with 201.                                                                                                                    |

Missing authentication is rejected by `requireAuth`; disallowed management operations are rejected by `requirePermission`, and client route attempts by non-`USER` roles are rejected by `requireRole`. The PGlite permission case exercises management reads and writes across all four roles. The browser route tests mock API responses and are not persistence evidence.

The API layer validates payloads before persistence. Create/update map invalid references to 400, unique conflicts to 409, missing records to 404, active deletion to 409, and service request foreign-key restriction to 409. Create and update transactions prevent partial persistence; the overflow test confirmed zero service/template rows after the 500 response.

## G. Authorization matrix

`/services` has a role-specific branch: the USER catalog or ADMIN service management. Source and API permission tests show that `SUPERADMIN` does not inherit service permissions.

| Operation                                           | SUPERADMIN         | ADMIN              | STAFF              | USER                |
| --------------------------------------------------- | ------------------ | ------------------ | ------------------ | ------------------- |
| Open `/services`                                    | No                 | Yes, management    | No                 | Yes, client catalog |
| Read `/api/services` or templates                   | No                 | Yes                | No                 | No                  |
| Create, edit, delete, activate, deactivate services | No                 | Yes                | No                 | No                  |
| Read `/api/services/available` or specialist routes | Yes, authenticated | Yes, authenticated | Yes, authenticated | Yes, authenticated  |
| Read client catalog/details/specialists             | No                 | No                 | No                 | Yes                 |
| Submit client service request                       | No                 | No                 | No                 | Yes                 |

`SUPERADMIN`, `STAFF`, and `USER` do not receive the API service management permissions in `apps/api/src/features/auth/auth.permissions.ts`. `USER` access is role-gated by the client router. ADMIN mutation controls additionally depend on `services:manage` in the UI. Existing PGlite permission tests check direct management API requests; the source-backed route policy establishes browser route access.

## H. Existing regression coverage

The three pre-existing direct Services browser specs contained **26 cases** before Page 8 additions, confirmed by explicit-path Playwright discovery (`services-discovery-existing-final.txt`). Their historical identity groups and coverage are:

| Historical identities | Spec                                              | Existing coverage and role                                                                                                                                                                                                                                     | Verification                                        |
| --------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| PW-041–PW-049         | `apps/web/e2e/services/client.spec.ts`            | USER catalog card layout for three package counts at three viewport sizes; mocked catalog data.                                                                                                                                                                | `MOCKED_UI_VERIFIED`                                |
| PW-050–PW-051         | `client.spec.ts`                                  | USER package and specialist selection, request submission, submitted-state content, and return navigation at 1280px and 390px; API is mocked. These two fail because they query the toast title as a page heading.                                             | `MOCKED_UI_VERIFIED`, with stale assertion mismatch |
| PW-052                | `client.spec.ts`                                  | USER catalog request failure/retry and catalog pagination/filter reset.                                                                                                                                                                                        | `MOCKED_UI_VERIFIED`                                |
| PW-106–PW-109         | `apps/web/e2e/services/pricing-templates.spec.ts` | Admin template edit and deletion at desktop/mobile widths, failed template mutation recovery, and hiding template controls for read-only service access.                                                                                                       | `MOCKED_UI_VERIFIED`                                |
| PW-251–PW-260         | `apps/web/e2e/services/services.spec.ts`          | Admin read-only controls; create/edit wizard persistence; pricing/package exclusivity; deactivate/confirm/delete lifecycle; untrusted description rendering; 403/500 list retry; rejected create recovery for pricing/packages; missing department validation. | `MOCKED_UI_VERIFIED`                                |

Relevant pre-existing API coverage includes `service reads and writes enforce permissions for every role`, `service lifecycle validates department links and prevents deleting active services`, and `pricing templates can be customized and only unused templates can be deleted` in `apps/api/tests/employee-integration.test.ts`; service authorization and persistence cases in `backend-regression.test.ts`; and five schema validation tests in `tests/features/services/validation.test.ts`. These were included in the Page 8 API execution.

## I. Identified coverage gaps

| Gap before Page 8                                                                                                | Page 8 response                                                                                 | Remaining result                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Admin directory combined department/status filtering and sort interaction was not covered.                       | Added combined-filter-and-sort browser case.                                                    | Passes.                                                                      |
| Clearing search after changing local views did not have an Admin Services regression.                            | Added page-two/search/page-one regression.                                                      | Fails and confirms SVC-002.                                                  |
| Whitespace-only service name and recovery before submit lacked a direct browser case.                            | Added form validation/recovery case.                                                            | Passes after correcting its initial fixture to select a required department. |
| Client requirement API maximum was not covered in the form or API boundary tests.                                | Added a browser rejected-save/retained-value case and API 200/201-character validator boundary. | Both pass; mismatch remains visible.                                         |
| Status mutation rejection followed by retry was not covered.                                                     | Added status error, unchanged-state, and retry-success browser case.                            | Passes.                                                                      |
| Inactive service deletion while a request still references it was not covered by the service lifecycle API test. | Added isolated PGlite linked-history case.                                                      | Passes; request reference prevents deletion until removed.                   |
| API accepted price upper bound had not been compared against Decimal persistence.                                | Added PGlite exact-maximum and out-of-range API cases.                                          | Exact maximum persists; out-of-range case fails and confirms SVC-001.        |

No additional Page 7 Department Management cases were repeated. The relationship case is scoped to a service linked to a historical service request.

## J. New regression tests

Five browser cases were added under `apps/web/e2e/services/`:

1. `service directory combines department and status filters, then sorts` — validates combined local filters, counts, ordering, and visible department/status values.
2. `service directory resets to page one when search is cleared` — reproduces the stale page restoration after navigating to page two, searching, and clearing search. It fails against the current shared table hook.
3. `service creation rejects whitespace-only names and recovers after correction` — verifies client validation prevents a write, then proceeds after the name and required department are corrected.
4. `service editing submits and retains a client requirement rejected by the API limit` — verifies the UI sends a 201-character item, displays the API validation error, and retains the entered value.
5. `service status changes retain state after a rejected request and can be retried` — checks rejected status update leaves the service active and a retry succeeds.

Four API leaf cases were added:

1. `inactive services remain undeletable while service requests reference them` — PGlite API persistence and 409 behavior; deleting the request permits later deletion.
2. `pricing at the Decimal(12,2) maximum persists` — verifies `9,999,999,999.99` persists through the API.
3. `pricing above the Decimal(12,2) maximum is rejected before persistence` — verifies the validator/database mismatch and currently fails because API returns 500, with no partial rows.
4. `service client requirements accept 200 characters and reject 201` — directly checks the API service schema boundary.

No historical test, shared helper, application source, backend business logic, or schema was modified.

## K. Execution results

### Discovery

- Existing explicit-path Services discovery: **26 tests in 3 files**.
- Current explicit-path Services discovery: **31 tests in 6 files**.
- Current whole Playwright discovery: **440 tests in 58 files**. The retained pre-Page 8 discovery was 435 tests in 55 files; the difference is the five new browser cases in three new spec files.
- Discovery is not counted as execution. Nine `/booked-services` cases and unrelated workflow tests matched an earlier broad text filter and were excluded from the explicit Page 8 test paths.

### Browser execution

Command, from `apps/web`:

```powershell
$env:NEXUS_E2E_BASE_URL='http://127.0.0.1:5274'
pnpm exec playwright test services/client.spec.ts services/pricing-templates.spec.ts services/services.spec.ts services/services-directory.spec.ts services/services-form-validation.spec.ts services/services-lifecycle.spec.ts --reporter=list --output='..\..\test-results\phase7\page-by-page\page-08-services\browser-results-page8-final'
```

The current focused run executed **31 unique Chromium cases: 28 passed, 3 failed, 0 skipped**. Twenty-four of the 26 pre-existing browser cases passed; four of the five new browser cases passed.

The three failures are:

- PW-050 and PW-051, at 1280px and 390px: the tests expect a heading named `Service request submitted for review`. The current page heading is `Request submitted`; the former text is the Sileo toast title. This is a pre-existing test assertion mismatch, not a failed request submission. The historical cases were not edited.
- The new search-clear pagination case expects 10 rows after returning to the original unfiltered view but receives 2, with summary `Showing 11–12 of 12 services`. `useLocalTable` stores the page against the previous view key and restores it when that key returns. Its source comment says the page returns to one whenever the view changes. This confirms SVC-002.

Earlier browser runs and the corrected fixture are retained separately. An initial whitespace-only form test fixture did not choose a required department after correcting the name; the test was fixed to select Engineering and then passed standalone. The latest full focused run above includes the corrected case. The same two historical heading failures and pagination failure were seen in the preceding 30-case focused run. No test was skipped to obtain the reported results.

### API execution

Command, from `apps/api`:

```powershell
pnpm exec tsx --test tests/features/services/integrity.test.ts tests/features/services/validation-boundaries.test.ts tests/features/services/validation.test.ts tests/employee-integration.test.ts tests/backend-regression.test.ts
```

Node reported 61 test entries, including three parent tests. Counting unique leaves as required gives **58 leaf cases: 57 passed, 1 failed, 0 skipped**. The failed leaf is the new out-of-range pricing case: `validateServiceInput` accepts `10,000,000,000`, Prisma returns P2020 numeric overflow, and the HTTP response is 500 instead of a client input rejection. Counts after excluding the three parent entries are 57 passed and 1 failed. Service and template counts are both zero after the failed transaction. The exact Decimal maximum, request-history delete restriction, role matrix, existing service validation, and 200/201 requirement boundary cases passed.

### Static and repository checks

| Command            | Result                           | Evidence                                                                        |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm format`      | Exit 0; no tracked files changed | `test-results/phase7/page-by-page/page-08-services/pnpm-format-page8-final.log` |
| `pnpm lint`        | Exit 0                           | `pnpm-lint-page8-final.log`                                                     |
| `pnpm typecheck`   | Exit 0 for web and API           | `pnpm-typecheck-page8-final.log`                                                |
| `git diff --check` | Exit 0                           | Final repository inspection                                                     |

The local portal was served from the existing standalone build on port 5274. The browser suite used mocked API responses. API verification used isolated PGlite. No shared or production database was accessed.

## L. Defects and limitations

### SVC-001 — Pricing validator exceeds database numeric range

The browser numeric input and API validator permit prices through `99,999,999,999.99`, while Prisma stores pricing template and package amounts as `Decimal(12,2)`, whose upper bound is `9,999,999,999.99`. The PGlite API test proves that `10,000,000,000` passes validation, fails at persistence with P2020, and surfaces as HTTP 500. The transaction leaves no service or template row. This is a confirmed input-validation and error-handling defect. Application and schema changes were outside this task.

### SVC-002 — Returning to a previous search view restores stale pagination

On `/services`, moving to page two, searching, and clearing search returns to page two. The table hook’s stored `{ viewKey, page }` matches the old view again, so it restores page two rather than starting at page one. The new browser case reproduces it. The shared hook was not changed; other hook consumers were not retested within Page 8 scope.

### SVC-003 — Client requirement form accepts values the API rejects

The form allows a 201-character requirement and has no matching per-item 200-character or 20-item limit. The API validator rejects a 201-character item, and the service maps schema errors to 400. The browser case simulates that 400 while verifying failed-save draft retention; the API unit case establishes the exact schema boundary. No HTTP or PGlite request for this specific invalid value was run. Users can discover the limit only after submitting. No product change was authorized.

### Existing test assertion mismatch — PW-050 and PW-051

The page heading and toast title differ in the source. The cases currently query the toast copy as an exact heading. This finding is confined to the old test expectation. The two historical assertions remain untouched and visible as failures.

Previously recorded findings such as LOGIN-001/002, REG-001/002, NEX-017, NEX-006, NEX-015, and the Request Inbox discrepancy were not reverified in this bounded Page 8 run. They remain governed by their existing reports and have not been marked resolved.

## M. Integration limitations

- Browser results are `MOCKED_UI_VERIFIED`: they exercise the built web UI with intercepted API fixtures and do not prove persistence or real API integration.
- PGlite route and persistence cases are `ISOLATED_API_VERIFIED`; they use isolated in-memory PostgreSQL and do not exercise the browser-to-live-backend path.
- The requirements-boundary schema case invokes the API validator directly; it is isolated API unit evidence, not HTTP or database verification.
- Source-backed route policies and role permissions are `SOURCE_ONLY` except where the cited PGlite role matrix test exercised direct API behavior.
- No `LIVE_INTEGRATION_VERIFIED` check was performed. No production account, credential, service, shared database, or external API was used.

### Files changed

| File                                                                | Purpose                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/web/e2e/services/services-directory.spec.ts`                  | New combined filtering/sort and search-clear pagination cases.             |
| `apps/web/e2e/services/services-form-validation.spec.ts`            | New whitespace-name recovery and over-limit requirement draft cases.       |
| `apps/web/e2e/services/services-lifecycle.spec.ts`                  | New status error and retry case.                                           |
| `apps/api/tests/features/services/integrity.test.ts`                | New PGlite service-request deletion and pricing numeric-boundary coverage. |
| `apps/api/tests/features/services/validation-boundaries.test.ts`    | New service client-requirement schema boundary case.                       |
| `docs/testing/verification/phase7/page-by-page/page-08-services.md` | This Page 8 report.                                                        |

The only non-ignored worktree additions are these six files. Execution logs and traces are ignored evidence under `test-results/phase7/page-by-page/page-08-services/`.

## N. Historical preservation

The accepted Phase 6 preservation reconciliation was read and checked; its baseline artifacts were not regenerated or overwritten. It records:

- **292/292** original Playwright identities reconciled, with 0 missing or unexpected.
- **1,630/1,630** historical assertion sites accounted for: 1,620 preserved exactly and 10 approved superseded sites, with 0 unapproved missing assertions.
- **4,211/4,211** ownership mappings, with 0 CSV mismatches.
- The accepted **49 Page 1–7 browser additions** and **three Page 7 API additions** remain present in their accepted reports and source inventory.

Page 1–7 files do not appear in the Page 8 worktree changes. Their tests were not rerun as part of this task, so this report claims preservation by repository state and accepted reconciliation evidence, not current runtime passage. No old test was deleted, skipped, or weakened.

### Final verification

The final commands `pnpm format`, `pnpm lint`, and `pnpm typecheck` all exited 0. `git diff --check` also exited 0. No shared test helper or product file changed; no accepted Page 1–7 test was changed. HEAD remains `7aaaa55cfe0fbc4c2a1b833d2cbfa74d2abe9f82`; no commit or push occurred.

## O. Final assessment

Page 8 source inspection, test additions, focused execution, failure investigation, and documentation are complete. The current run provides 31 Services browser cases and 58 unique API leaves, with the confirmed SVC-001, SVC-002, and SVC-003 findings plus the two retained PW-050/051 assertion mismatches. The static quality gates pass. No app fix was made because this work was authorized for regression testing only.

**Recommended status: Ready for administrative review with documented defects and limitations.** Acceptance remains the user’s decision. A future product task would need to resolve the pricing/database boundary and the client-requirements UI/API mismatch; the shared pagination behavior and stale historical heading assertions also need decisions before describing the Services suite as green. Page 9 and Phase 7.5 have not been started.
