# Backend regression architecture review

Reviewed November 2, 2026, from `42789dd6b13094b00041b1fb24411602dc350af1`
through `61a24a8` on `138-teste2e-enhance-latest-playwright-regression-v5`.
The local branch matched its remote tracking branch after fetching origin.

## Execution boundaries

Browser requests use the Next.js same-origin `/api` proxy. Express mounts the
feature controllers in `apps/api/src/app.ts`; authentication verifies JWTs and
loads current account/session state. Role checks alone do not authorize access
to a particular request: workflow services additionally check client ownership,
department-head assignment, or assigned financial approver permissions.

The offline API suites start real Express servers against Prisma backed by
PGlite, apply the migration history, and assert HTTP responses and persisted
state. Storage integrations use test adapters where needed. They do not need
production credentials. The browser specs mock API responses and verify UI
contracts, retries, navigation, and token handling. They do not exercise Express
through the proxy; passing both suites is not evidence of a full browser-to-DB
integration run. The optional live browser suite only exercises its documented
read/login/logout cases.

## Coverage and commands

`pnpm test:e2e -- --workers=2` runs the full offline API suite alongside all
Playwright specs. `pnpm test:e2e -- --ui` opens the browser test UI while backend
results appear in the terminal. Either child process failing makes the combined
command fail. Playwright arguments only select browser tests; backend coverage
remains complete.

`pnpm --filter @nexus/api test:regression` now runs the complete API suite,
including profiles, inbox, conversation retention/edit/delete, workflow actions,
payment attachments, notifications, and JWT lifecycle coverage. Previously it
only ran `backend-regression.test.ts`, omitting these detailed feature suites.
`pnpm --filter @nexus/api test:smoke` retains that faster HTTP smoke run.

The shared smoke regression now covers all-role/anonymous reads for profiles,
client services/requests, inbox, internal messaging, request conversations,
notifications, and approvals. An unassigned Staff account must not gain inbox
access. Anonymous writes across the new modules must return JSON 401 responses
with the API security headers; checks also assert no workflow files, action
receipts, conversations, or injected profile names were persisted. Invalid
profile updates must preserve both User and linked Employee records.

| Recent feature                           | Real backend coverage                                                | Browser contract coverage                                                             |
| ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| JWT refresh and revocation               | `jwt-session.test.ts`, auth JWT tests, account password/status tests | `regression.spec.ts`, `jwt-session.spec.ts`                                           |
| Client submission/cancellation           | `client-requests.test.ts`, shared backend regression                 | `client.spec.ts`, `client-service-requests.spec.ts`                                   |
| Head assignment and request access       | `request-inbox.test.ts`                                              | `request-inbox.spec.ts`                                                               |
| Internal and client messaging            | `request-conversations.test.ts`                                      | `internal-conversations.spec.ts`, `request-conversations.spec.ts`                     |
| Workflow, files, notifications, projects | `request-workflow.test.ts`                                           | `request-workflow.spec.ts`, `workflow-approvals.spec.ts`, `project-workspace.spec.ts` |
| Profiles and specialist edits            | `profile.test.ts`, `service-specialists.test.ts`                     | `profile.spec.ts`                                                                     |

## Open architecture findings

- Inbox decline/delete controls call routes that are still absent from the
  controller. Successful browser mocks must not be treated as backend coverage.
  Implement the server contract, lifecycle rules, and persistence/RBAC tests
  before claiming these operations work end to end.
- Profile contact validation currently accepts broader international-style
  strings than the repository's Philippine mobile-number convention. This
  review records the mismatch; aligning the profile UI/API requires a separate
  behavior change and corresponding valid/invalid input coverage.
- The passing in-memory suites do not validate hosted storage permissions,
  production proxy configuration, or deployed migrations. The existing live
  regression remains a separate deployment check.
