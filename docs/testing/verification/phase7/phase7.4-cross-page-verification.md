# Phase 7.4 Cross-Page Workflow and Business Process Verification

**Verification date:** 2026-11-11 (Asia/Singapore)  
**Status:** COMPLETE — WITH VERIFIED DEFECTS OR ACCEPTED LIMITATIONS

## 1. Executive Summary

Phase 7.4 discovered and mapped 14 source-backed cross-page or cross-module workflows: seven P0, six P1, and one P2. Ten workflows had safe, relevant existing browser cases selected. The bounded run executed 21 unique Playwright cases in 10 specs: 19 passed, two failed, zero were skipped, and none were flaky. Six executed workflows passed completely, one failed, and three were partially verified. Four additional workflows remain partially verified or not covered; no source-only workflow is reported as a pass.

The two failures reproduce the known NEX-017 error-notification defect for project brief updates and deliverable reviews. The selected tests use mocked API responses. They verify UI behavior and navigation but do not establish live API authorization or durable database persistence. The five deferred live-backend browser tests remain blocked by the absence of a verified disposable integrated environment. No new application, cross-page contract, authorization, or data-integrity defect was verified.

## 2. Git Baseline

| Check                  | Initial                                                                                            | Final                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Branch                 | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | Same                                           |
| HEAD                   | `4e98092d0bfedcad679db92f701efad9ace768e9`                                                         | Same                                           |
| Tracked/staged changes | None                                                                                               | None                                           |
| Untracked reports      | Phase 7.2 and Phase 7.3 reports                                                                    | Phase 7.2, Phase 7.3, and new Phase 7.4 report |

Phase 7.2 and 7.3 reports were preserved. Application source, existing tests, historical evidence, and Git history were not changed. No commit or push was made.

## 3. Authoritative References

- **Phase 7.1:** 23 official routes, 326 discovered browser cases including five live cases, Chromium project and isolated web-server procedure. Its source HEAD predates the current tested commit; Phase 7.2 supersedes it for build provenance.
- **Phase 7.2:** Source HEAD `4e98092d0bfedcad679db92f701efad9ace768e9`; build ID `_FCLZ3oNKtr9JcsDNCx7k`; 321 offline browser cases, 319 passed and two NEX-017 notification assertions failed. The current standalone build ID matches this source-matched build, and no app source changes followed.
- **Phase 7.3:** 28 API modules, 19 PGlite-backed; 170 unique cases, 169 passing after triage and one reproducible `request-workflow.test.ts` test-contract defect. The client response intentionally omits milestones while that test reads a client milestone ID. That failing test and its later unexecuted assertions were not rerun in Phase 7.4.
- **Phase 5/6:** Coverage assessment and approved delta/preservation records supplied workflow boundaries. NEX-009 deliverable review, NEX-012 client-related records, NEX-017 client project interactions, Request Inbox limitations, and team-lead behavior were reconciled to their existing tests and current source.

Historical Phase 7.2 and 7.3 results are reference baselines, not Phase 7.4 test executions.

## 4. Workflow Discovery Methodology

Discovery was limited to the reference reports and the relevant current source/spec areas: Playwright configuration and regression support; auth/session specs; client/service-request specs; Request Inbox and conversation specs; request workflow; project, workspace, deliverable, and project-conversation specs; notification links; and related service, billing, department, employee, and API contracts. Existing test titles and route assertions were used to identify candidate transitions. Source links without an executed target-page assertion were kept partial or source-only.

Fourteen workflows were recorded before execution in `test-results/phase7/phase7.4/workflow-inventory.json`. The inventory records route, role, precondition, trigger, expected state, test owner, API/data dependencies, risk, priority, and planned execution count. It includes only behavior supported by repository source or accepted project documentation. Unsupported Request Inbox decline/delete success, NEX-006 wizard creation, and NEX-015 team-lead removal were excluded from the supported-workflow pass criteria.

## 5. Cross-Page Workflow Inventory

| ID                    | Workflow and verified pages                                              | Role                               | Priority | Existing automated owner                              | Planned cases |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------------- | -------- | ----------------------------------------------------- | ------------: |
| WF-AUTH-01            | Login/registration, protected routes, dashboard, logout                  | Guest and all four roles           | P0       | `auth/regression.spec.ts`                             |             7 |
| WF-AUTH-02            | Settings session revocation to login across two browser contexts         | USER                               | P0       | `settings/session-revocation.spec.ts`                 |             1 |
| WF-CLIENT-01          | Client directory to related request/project tabs                         | ADMIN                              | P1       | `clients/related-records.spec.ts` (NEX-012)           |             1 |
| WF-INBOX-01           | Request Inbox acceptance/chat to the exact Messages thread               | Current Department Head STAFF      | P0       | `request-inbox/request-inbox.spec.ts`                 |             3 |
| WF-MESSAGES-01        | Dashboard to Messages list to selected request conversation              | USER                               | P1       | `messages/request-conversations.spec.ts`              |             2 |
| WF-SERVICE-01         | Service selection/submission to confirmation and request-history handoff | USER                               | P1       | `services/client.spec.ts`; separate history tests     |             2 |
| WF-REQUEST-PROJECT-01 | Activated request context to its related project                         | USER                               | P0       | `workflows/request-workflow.spec.ts`                  |             1 |
| WF-CLIENT-PROJECT-01  | Client project list to project/deliverable detail and revision request   | USER                               | P0       | `projects/client-project-workflows.spec.ts` (NEX-017) |             2 |
| WF-DELIVERABLE-01     | Staff upload, head review, and client-visible project deliverable        | STAFF, Department Head STAFF, USER | P0       | `projects/workspace-deliverables.spec.ts` (NEX-009)   |             1 |
| WF-PROJECT-CHAT-01    | Project conversation to related project/deliverable links                | USER                               | P1       | `project-conversations.spec.ts`                       |             1 |
| WF-WORKSPACE-01       | Workspace list to matching workspace detail                              | STAFF/Department Head STAFF        | P1       | Workspace list/detail specs, separately               |             0 |
| WF-DEPT-EMPLOYEE-01   | Department/team assignment to employee/staff views                       | ADMIN, STAFF                       | P1       | Department, employee, and workload specs, separately  |             0 |
| WF-PAYMENT-BILLING-01 | Request-workflow payment to client Billing Logs                          | USER and authorized STAFF          | P0       | Workflow, Billing Logs, and API tests, separately     |             0 |
| WF-NOTIFICATION-01    | Workflow notification to related project or request conversation         | Roles allowed by the endpoint      | P2       | No dedicated click-through browser test               |             0 |

P0 reflects authentication/session security, ownership, client-visible project state, request acceptance, or payment integrity. P1 covers major operational relationships and state handoffs. P2 covers notification navigation. The detailed expected states, dependencies, findings, and execution status are in `workflow-results.json`.

## 6. Environment Readiness

| Item                          | Finding                                                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current source                | HEAD matches Phase 7.2; no app-source changes since its build                                                                                                                                                              |
| Existing production build     | Build ID `_FCLZ3oNKtr9JcsDNCx7k` matches Phase 7.2; reused without rebuilding                                                                                                                                              |
| Browser/test runner           | Node.js v24.16.0; Playwright 1.64.1; Chromium project launched successfully                                                                                                                                                |
| pnpm                          | Repository pins 12.7.0; installed 12.15.0 and previously reported the global store-lock error. Local tools were used; pnpm was not retried.                                                                                |
| Quality gates                 | Repository-wide Prettier check, ESLint with zero warnings, API `tsc --noEmit`, Next.js route type generation, and web `tsc --noEmit` passed using installed local tools. The new report was formatted with local Prettier. |
| Web server                    | Existing standalone web build only, served at `127.0.0.1:5273`; `/login` returned HTTP 200. The server started for this run was stopped afterwards.                                                                        |
| API/database                  | No API service or database was started. `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, and service-role key were removed from the Playwright runner process. Selected specs intercept API calls.                            |
| Live accounts                 | No live credentials were loaded by the temporary isolated config or used. No provisioned disposable database/base URL was verified.                                                                                        |
| Existing screenshot artifacts | `apps/web/test-results` contained screenshots with names used by selected specs. Playwright ran from a new Phase 7.4 working directory and wrote the test output there; existing files were not overwritten.               |

Local quality commands: `node node_modules/prettier/bin/prettier.cjs --check .`; `node node_modules/eslint/bin/eslint.js . --max-warnings 0`; API `node node_modules/typescript/lib/tsc.js --noEmit`; web `node node_modules/next/dist/bin/next typegen` followed by `node node_modules/typescript/bin/tsc --noEmit`. All exited 0. The new report was formatted with the local Prettier executable and the full-workspace formatting check passed.

The temporary `playwright-isolated.config.mjs` is under ignored Phase 7.4 evidence, outside application and test source. It preserves the Chromium project, base URL, trace behavior, one worker, zero retries, and original `apps/web/e2e` test directory while isolating the working/output paths. The standard Playwright config's webServer was not used because the local standalone server was started explicitly.

## 7. Execution Results

**Exact test command:**

```text
node C:\Users\ADMIN\Documents\Thesis\Nexus\apps\web\node_modules\@playwright\test\cli.js test
  --config=C:\Users\ADMIN\Documents\Thesis\Nexus\test-results\phase7\phase7.4\playwright-isolated.config.mjs
  e2e/auth/regression.spec.ts
  e2e/settings/session-revocation.spec.ts
  e2e/clients/related-records.spec.ts
  e2e/request-inbox/request-inbox.spec.ts
  e2e/messages/request-conversations.spec.ts
  e2e/workflows/request-workflow.spec.ts
  e2e/projects/client-project-workflows.spec.ts
  e2e/projects/workspace-deliverables.spec.ts
  e2e/project-conversations.spec.ts
  e2e/services/client.spec.ts
  --project=chromium --workers=1 --retries=0 --reporter=json
  --grep 'anonymous home and protected deep links|login preserves the loader|registration keeps the existing API contract|keeps their session when opening login|individual session revocation redirects|admin can browse paginated client requests|department head reviews and accepts booked services|chat icons open the exact accepted request|top bar opens the conversation list|client selects service packages and returns to the catalog|mobile request context collapses and activated projects have a workspace link|client browses projects and edits brief|client opens shared files and reviews them|assigned staff upload and department head review deliverables|client chats offer approved deliverable access'
  --output=C:\Users\ADMIN\Documents\Thesis\Nexus\test-results\phase7\phase7.4\artifacts-escalated
```

Working directory: `test-results/phase7/phase7.4/playwright-cwd`. Environment: `NEXUS_E2E_LIVE=0`, `NEXUS_E2E_BASE_URL=http://127.0.0.1:5273`, database/Supabase variables absent. The list-only discovery resolved 21 exact test identities in 10 files before execution.

| Result                       |          Count |
| ---------------------------- | -------------: |
| Unique tests executed        |             21 |
| Passed                       |             19 |
| Failed                       |              2 |
| Skipped                      |              0 |
| Not run among selected cases |              0 |
| Retries / flaky              |          0 / 0 |
| Duration                     | 49.438 seconds |
| Final command exit code      |              1 |

The final run was serial and run once. Both failed assertions belong to NEX-017. The first unsandboxed worker attempt stopped with `spawn EPERM` before test cases; it is retained in `playwright-run.stderr.txt`. The same selection ran after process permission was granted. A preliminary list command from the isolated working directory selected zero files because the path filters were rooted incorrectly; the temporary config corrected the root, and the final list reports all 21 selected cases. Neither setup attempt is counted as a test case or a workflow result.

The 21 cases comprise: authentication/protected navigation (7), session revocation (1), client related records (1), Request Inbox acceptance/chat (3), Messages navigation (2), service request submission (2), activation/project handoff (1), client project/deliverable flow (2), staff/head/client deliverable review (1), and project chat links (1). Targeted reruns: zero.

## 8. Detailed Workflow Verification Matrix

| ID                    | Workflow                                           | Pages / roles                                                   | Verification level | Tests | Pass | Fail | Not run | Status             | Findings                                                                                          |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------- | ------------------ | ----: | ---: | ---: | ------: | ------------------ | ------------------------------------------------------------------------------------------------- |
| WF-AUTH-01            | Login/registration, protected routes, logout       | `/login`, `/register`, `/dashboard`; all roles                  | MOCKED_UI_VERIFIED |     7 |    7 |    0 |       0 | VERIFIED_PASS      | Session and route state assertions passed; no server auth claim.                                  |
| WF-AUTH-02            | Revoke a session across browser contexts           | `/settings`, `/login`; USER                                     | MOCKED_UI_VERIFIED |     1 |    1 |    0 |       0 | VERIFIED_PASS      | Two-context fixture uses in-memory session state.                                                 |
| WF-CLIENT-01          | Browse related requests and projects               | `/clients`; ADMIN                                               | MOCKED_UI_VERIFIED |     1 |    1 |    0 |       0 | VERIFIED_PASS      | Fixture-scoped request/project identities and pagination passed.                                  |
| WF-INBOX-01           | Accept request/open matching conversation          | `/request-inbox` → `/messages?request=…`; Department Head STAFF | MOCKED_UI_VERIFIED |     3 |    3 |    0 |       0 | VERIFIED_PASS      | Accepted request identity and access-error retry passed.                                          |
| WF-MESSAGES-01        | Dashboard to selected request thread               | `/dashboard` → `/messages` → `/messages?request=…`; USER        | MOCKED_UI_VERIFIED |     2 |    2 |    0 |       0 | VERIFIED_PASS      | Desktop/mobile selected-thread route passed.                                                      |
| WF-SERVICE-01         | Service request submission and confirmation        | `/services` → confirmation; USER                                | MOCKED_UI_VERIFIED |     2 |    2 |    0 |       0 | PARTIALLY_VERIFIED | Retry and confirmation passed; history-link navigation is not asserted.                           |
| WF-REQUEST-PROJECT-01 | Activated request exposes project link             | `/messages?request=…` → `/projects/:id`; USER                   | MOCKED_UI_VERIFIED |     1 |    1 |    0 |       0 | PARTIALLY_VERIFIED | Correct project href asserted; destination was not opened by this test.                           |
| WF-CLIENT-PROJECT-01  | Project list/detail to deliverable revision        | `/projects` → project/deliverable details; USER                 | MOCKED_UI_VERIFIED |     2 |    0 |    2 |       0 | VERIFIED_FAIL      | Both known NEX-017 error-toast assertions failed.                                                 |
| WF-DELIVERABLE-01     | Staff submission, head review, client visibility   | `/project-workspace/:id` → `/projects/:id`; STAFF/head/USER     | MOCKED_UI_VERIFIED |     1 |    1 |    0 |       0 | VERIFIED_PASS      | Mocked role/state transition and client-visible file assertions passed.                           |
| WF-PROJECT-CHAT-01    | Client project chat to related project/deliverable | `/messages?project=…` → project/deliverable hrefs; USER         | MOCKED_UI_VERIFIED |     1 |    1 |    0 |       0 | PARTIALLY_VERIFIED | Role controls and hrefs passed; neither destination was followed.                                 |
| WF-WORKSPACE-01       | Workspace list to workspace details                | `/project-workspace` → `/project-workspace/:id`; STAFF/head     | SOURCE_ONLY        |     0 |    0 |    0 |       0 | PARTIALLY_VERIFIED | Source link and separate Phase 7.2 list/detail tests exist; no same-record cross-route assertion. |
| WF-DEPT-EMPLOYEE-01   | Team assignment reflected in employee/staff views  | `/departments`, `/employees`, `/staff-workload`; ADMIN/STAFF    | SOURCE_ONLY        |     0 |    0 |    0 |       0 | NOT_COVERED        | Separate mocked fixtures do not establish cross-route propagation.                                |
| WF-PAYMENT-BILLING-01 | Payment state reflected in client Billing Logs     | `/messages?request=…` → `/billing-logs`; USER/authorized STAFF  | SOURCE_ONLY        |     0 |    0 |    0 |       0 | NOT_COVERED        | Browser sides are tested separately; live persistence handoff was not verified.                   |
| WF-NOTIFICATION-01    | Notification opens related project/request         | Dashboard notification → project or Messages; permitted roles   | SOURCE_ONLY        |     0 |    0 |    0 |       0 | NOT_COVERED        | Source mapping exists; no browser click-through assertion was found.                              |

The complete workflow records and the five deferred live cases are in `test-results/phase7/phase7.4/workflow-results.json`. Workflow counts are 14 discovered, 10 executed, six verified passing, one failing, four partially verified, and three not covered. The four partial workflows include three selected workflows with href/confirmation-only coverage and the workspace list/detail relationship with existing separate-page evidence.

## 9. Cross-Module Data Consistency

- **Client relationships:** NEX-012 verified that the selected ADMIN client’s related request and project fixtures remain associated across tabs and pagination. This is mocked UI consistency, not server persistence.
- **Inbox/conversation:** Inbox acceptance and chat selection carried the exact mocked request ID into Messages. No Express route or persistent request was involved.
- **Service request:** The form’s retry retained the submission key and the success response produced a confirmation. The route to request history and the persisted history record were not verified.
- **Request/project:** The active workflow rendered the associated project href. The destination project was not opened in that test, and API persistence was not checked.
- **Deliverables:** NEX-009 exercised mocked in-test state through STAFF, head, and USER views, including client sharing. It verifies UI state propagation only; file storage and database persistence were not exercised.
- **Payment/Billing, department/employee, and notification handoffs:** No shared-state integration was executed. Separate page tests and source relations do not establish cross-page persistence.

No `ISOLATED_API_VERIFIED` or `LIVE_INTEGRATION_VERIFIED` workflow was produced in Phase 7.4. Phase 7.3 API outcomes remain separate evidence and were not combined with browser counts.

## 10. Defect Register

| Finding                              | Workflow / test                                                                  | Expected and actual behavior                                                                                                                                                                        | Classification                                  | Phase 7.4 evidence and action                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| NEX-017-BRIEF-ERROR (existing)       | WF-CLIENT-PROJECT-01; brief update in `client-project-workflows.spec.ts`         | After the mocked brief-update failure, the test expects “Couldn't update the brief”; the notification did not appear within five seconds. The soft assertion failed; recovery assertions continued. | APPLICATION_DEFECT; high confidence, reproduced | `playwright-run-escalated.json`; retain the existing assertion and previously documented shared-notification remediation path. |
| NEX-017-DELIVERABLE-ERROR (existing) | WF-CLIENT-PROJECT-01; deliverable revision in `client-project-workflows.spec.ts` | After the mocked revision failure, the test expects “Couldn't save your response”; the notification did not appear within five seconds. The soft assertion failed; later assertions continued.      | APPLICATION_DEFECT; high confidence, reproduced | `playwright-run-escalated.json`; preserve the known finding. No duplicate Phase 7.4 defect ID was created.                     |

No new cross-page contract, authorization, data-integrity, or test defect was verified. The Phase 7.3 `request-workflow.test.ts` TEST_DEFECT remains a separate known API test-contract inconsistency and was not altered or rerun. The Request Inbox decline/delete success contract remains unresolved; Phase 7.4 exercised acceptance only.

## 11. Deferred Live-Backend Verification

| ID     | Existing case                                        | Result  | Reason / prerequisite                                                         |
| ------ | ---------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| PW-124 | SUPERADMIN logs in and validates real feature access | BLOCKED | No verified disposable database and isolated live service/accounts.           |
| PW-125 | ADMIN logs in and validates real feature access      | BLOCKED | Same; this case queries multiple administrative resources.                    |
| PW-126 | STAFF logs in and validates real feature access      | BLOCKED | Same; live role and department access are not safe to infer from mocks.       |
| PW-127 | USER logs in and validates real feature access       | BLOCKED | Same; client service and owned-resource access require isolated data.         |
| PW-128 | Deactivated account cannot establish a session       | BLOCKED | Requires a safely provisioned deactivated test account and live auth service. |

The account password keys documented in Phase 7.3 were not loaded or used. No live base URL or dedicated disposable database was established. Running login/session and data-read cases without that isolation could affect persistent accounts or records. These five cases remain separate from the 21 Phase 7.4 executions and are deferred to a later verified live environment.

## 12. Coverage Gaps

1. **Service request history handoff:** successful submission and confirmation are mocked and tested; clicking through to `/service-requests` and finding the same persisted request has no complete cross-page assertion.
2. **Activated request destination:** the View Project href is checked, but the same test does not open and identify the project destination.
3. **Project chat destinations:** project and deliverable hrefs are checked without following either destination.
4. **Workspace list/detail identity:** source exposes a row link, while the existing list/detail tests use separate flows and fixtures.
5. **Department/team propagation:** department membership, employee directory, and workload pages do not share an executed state transition.
6. **Payment/Billing consistency:** payment actions and Billing Logs lack a safe integrated run that proves the same persisted payment appears for the owning client.
7. **Workflow notification click-through:** source maps notification types to project or request routes, but no E2E assertion covers that path.
8. **NEX-017:** the two existing error-toast assertions still fail.
9. **Request workflow API test contract:** Phase 7.3's client milestone expectation is inconsistent with the client response contract; later assertions in that API test scenario remain unexecuted.
10. **Live role integration:** all five live-browser identities remain deferred.

No new permanent test was created. Future tests or remediation require separate authorization. Source-only observations are explicitly marked SOURCE_ONLY/NOT_COVERED and are not represented as runtime passes.

## 13. Historical Preservation

- Phase 6 baseline remains 292 original Playwright identities, 1,630 historical assertion sites, and 4,211 preservation mappings, with 34 additional cases accounted for. Phase 7.4 did not edit any of them.
- Phase 7.2 remains 319/321 offline browser cases passing, with two known NEX-017 failures. The two assertions failed again in this targeted execution; no all-suite rerun was performed.
- Phase 7.3 remains 169/170 unique API cases passing after targeted triage, with one reproducible test defect. No API suite was rerun.
- **NEX-006:** inaccessible workspace wizard remains unverified; no alternate behavior was invented.
- **NEX-015:** assignment and reassignment remain supported; team-lead removal remains intentionally unsupported.
- **Request Inbox:** acceptance was exercised. Successful decline/delete remains blocked by the absent backend contract.
- **Help:** no dedicated browser spec exists; navigation alone would not establish full Help verification.
- Existing Phase 7.2/7.3 reports, browser specs, API tests, and ignored historical evidence were preserved.

## 14. Reliability Assessment

The selected tests ran once, serially, in one Chromium worker with zero retries. Nineteen passed and two known notification assertions failed; there were zero skips and zero flaky outcomes. The two NEX-017 failures match Phase 7.2 and are not evidence of nondeterminism. No test worker contacted a real API/database: API calls were intercepted and the runner process had database/Supabase variables removed.

The first runner attempt hit process-spawn `EPERM` before tests and was rerun after the required process permission was granted. The preliminary isolated-CWD list command selected no cases; the corrected temporary config found the same 21 enumerated cases used for execution. Neither setup event was counted as test execution. The local web server responded HTTP 200 and was stopped; port 5273 was unreachable afterwards. Existing screenshots in `apps/web/test-results` retained their prior timestamps and sizes; new hard-coded screenshots are under the isolated Phase 7.4 working directory.

All runtime workflow results are `MOCKED_UI_VERIFIED`. No real server authorization, live event delivery, object storage, payment processing, or durable database state was verified. The current environment produced no evidence of a flaky test, race, or state leak within the selected mocked fixtures.

## 15. Phase 7.4 Acceptance Assessment

The administrative Phase 7.4 criteria are satisfied with visible limitations: current Git and reference baselines were reconciled; 14 source-backed workflows were inventoried before execution; existing safe cross-page tests were selected and run; 21 unique case outcomes and four coverage levels were reconciled; all failures and non-execution reasons were documented; historical findings and evidence were preserved; and no application/test source or persistent database was changed.

Completion does not mean all workflows passed. Six workflows passed in full, one reproduced NEX-017 failures, four are partial, three lack cross-page coverage, and five live role cases remain blocked. No new application defect was introduced or silently fixed.

## 16. Phase 7.5 Readiness

Phase 7.5 was not executed. Before combined-suite verification, establish a dedicated disposable database and provisioned test accounts, verify web/API service lifecycle and data cleanup, and keep live credentials out of artifacts. Preserve the NEX-017 UI defect and Phase 7.3 API test-contract defect for separately authorized correction. The combined suite must count browser/API tests independently and use the isolated test environment for any persistent state transition.

Phase 7.5 has not started. No full 321-case browser suite, 170-case API suite, or combined suite was run in Phase 7.4.
