# Regression modes

`pnpm --filter @nexus/web test:e2e` runs the deterministic mocked regressions.

For the messaging-only run order, test cases, expected results and deployment
checks, see [Messaging regression workflow](MESSAGING-REGRESSION.md).
Run `pnpm --filter @nexus/web test:e2e:messages --workers=2` for its browser suite.

Run the complete folder when reviewing a release. This includes
`login-validation.spec.ts`, which covers login field validation, language
selection and duplicate submission behavior. `regression.spec.ts` contains the
shared session checks, while feature behavior is split across the other specs.
Playwright builds and starts a production server by default.
When setting `NEXUS_E2E_BASE_URL`, point it at a fresh production build:
development mode can repeat effects and invalidate request-count assertions.

## Review from 42789dd to 636c020

For the follow-up backend review through `61a24a8`, the expanded regression
command, and remaining architecture gaps, see
[Backend regression architecture review](../../../docs/backend-regression-review.md).

The November 2, 2026 review covers changes after
`42789dd6b13094b00041b1fb24411602dc350af1` through `636c020`.

| Area                       | Regression files and behavior                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and access  | `regression.spec.ts`, `jwt-session.spec.ts`, role specs: refresh, revoked sessions, protected routes and account operations                                                      |
| Client requests            | `client.spec.ts`, `clients.spec.ts`, `client-service-requests.spec.ts`, `booked-services.spec.ts`: submission, current action labels, receipt links, filters and details         |
| Department inbox           | `request-inbox.spec.ts`: review stays in the drawer; Go to chat opens messaging; cancellation and failed delete preserve bookings on desktop and mobile                          |
| Messaging                  | `request-conversations.spec.ts`: internal messaging access, staff message edit retry, delete confirmation and client synchronization, archived conversations                     |
| Workflow                   | `request-workflow.spec.ts`: quotation approval, consultation reschedule retry with the same action ID, payment evidence preview/removal and upload retry with the same upload ID |
| Services                   | `services.spec.ts`, `pricing-templates.spec.ts`: package removal payload and reopening, pricing templates and current dialog controls                                            |
| Profiles and notifications | `profile.spec.ts`, `workflow-approvals.spec.ts`: all-role profile editing/images, notification read-all persistence and failure recovery                                         |

### Known backend gap

At `636c020`, the inbox UI calls `POST /api/request-inbox/:id/decline` and
`DELETE /api/request-inbox/:id`, but `request-inbox.controller.ts` only implements
list, detail and accept routes. The booking status enum also has no `DECLINED`
value (the separate workflow state does). The new inbox tests cover failed
delete recovery, not successful decline/delete. Implement the server contract
and its authorization/persistence tests before adding successful browser
fixtures.

Browser mocks verify frontend behavior only. Use the offline API suite for real
authorization and persistence; passing mocked tests does not close this gap.

The restored inbox implementation keeps its native confirmation dialog. Because
the open booking drawer can hide that dialog from assistive-technology queries,
the browser regression currently covers the delete confirmation from the inbox
table; decline confirmation remains a known UI follow-up until the dialog
stacking/accessibility interaction is redesigned.

## Commands and live mode

From the repository root, `pnpm test:e2e -- --ui` runs the complete offline backend
suite and every Playwright spec under `apps/web/e2e/` in the interactive UI
at the same time. This includes the login input validation regression in
`login-validation.spec.ts` and its PGlite API boundary coverage in
`apps/api/src/login-validation.test.ts`. Backend test results remain in the
terminal. The browser specs use mocked API responses, so the backend test
validates the API independently rather than serving requests to the browser.

To run the main regression file alone, use
`pnpm --filter @nexus/web test:e2e regression.spec.ts --workers=2` after building.
Its authentication checks cover both stored tokens, refresh across all roles,
concurrent refresh coordination, a single mutation retry, revoked sessions,
and recoverable refresh failures. Mock tokens exercise browser behavior;
they do not verify JWT signatures or server authorization.

The main file also checks desktop and mobile service-request retries: a failed
submission keeps the form open, reuses the same UUID and payload on retry, and
only shows confirmation after a successful response.

Run `pnpm --filter @nexus/api test:smoke` for the separate backend-only
suite in `apps/api/src/backend-regression.test.ts`. It starts Express on an
ephemeral loopback port, applies every Prisma migration to a fresh in-memory
PGlite database, and exercises real HTTP requests and Prisma writes. It needs
neither a browser, a running development server, nor live account credentials.

Smoke coverage includes all four roles and anonymous reads across the mounted API
modules; security headers; department/team/employee/service provisioning;
duplicate employee rollback; specialist discovery; account retirement preserving
HR records; service-request ownership, replay, conflict and stale-selection
checks; immediate role/status enforcement; refresh/logout; and password-reset
session revocation. The broader API test command includes this suite alongside
the existing detailed feature tests. Run both commands below for the browser
and backend regression checks:

```sh
pnpm --filter @nexus/web test:e2e regression.spec.ts --workers=2
pnpm --filter @nexus/api test:regression
```

`pnpm --filter @nexus/api test:regression` runs the full API suite (an alias of
`pnpm --filter @nexus/api test`) for real JWT verification, rotation/reuse
detection, password-reset session revocation, and account restoration against
offline PGlite databases. No live database is used by that suite.

`pnpm --filter @nexus/web test:e2e:live` signs in to the real backend using
the Superadmin, Admin, Staff, User, and deactivated test accounts configured in
`regression.spec.ts`. It checks login, page access, direct API read permissions,
the available service catalog, and logout. It does not modify business records.
Mutation and injected-error scenarios remain in the mocked suite.

Set the following variables in the environment or in the ignored file
`apps/web/.env.regression.local`:

```dotenv
NEXUS_E2E_SUPERADMIN_PASSWORD=
NEXUS_E2E_ADMIN_PASSWORD=
NEXUS_E2E_STAFF_PASSWORD=
NEXUS_E2E_USER_PASSWORD=
NEXUS_E2E_DEACTIVATED_PASSWORD=
```

Live validation runs all five account cases without temporary exclusions.

Start the API (`pnpm start:api`) with its test database configuration. Build the
web app with `pnpm build`; Playwright starts it on port 5273. To use an already
running web app instead, set `NEXUS_E2E_BASE_URL` to its URL. The web app must
proxy `/api` to the backend containing the supplied test accounts.

Live runs use one worker, no retries, and no traces, screenshots, or videos to
avoid storing passwords and session tokens in test artifacts. Passwords are
required; missing credentials fail the live run rather than falling back to mocks.
