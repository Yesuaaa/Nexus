# System Logs & Diagnostics — Phase 2C Superadmin UI

Developed: 2026-11-16. Status: UI implemented for the two management sources; **production API access remains disabled**. Builds on [Phase 1](system-logs-contracts.md), [Phase 2A](system-logs-management-read-adapters.md), [Phase 2B](system-logs-superadmin-api.md) and the [regression reconciliation](system-logs-backend-regression-reconciliation.md). No Phase 2D implementation or release activation.

## Route and authorization

Follow-up: [Phase 2C.1](system-logs-shared-navigation.md) moves navigation to Shared, retains the originating workspace and adds module coverage/default/manual-filter behavior. The sections below preserve the initial Phase 2C implementation record; use the follow-up for current navigation behavior.

`/system-logs` belongs to Administration. The centralized route policy allows only active, non-retired SUPERADMIN accounts. Other portal roles redirect using existing PortalLayout denial behavior and never mount/request history. The page also checks its account context before loading. Navigation uses the existing sidebar and History icon, labelled **System Logs (Unavailable)**. An always-visible page notice explains production unavailability. No frontend flag, test switch, query activation control or mock production endpoint is introduced.

Backend current-session/role checks and the offline-only activation gate are unchanged and authoritative. Normal production requests encounter the existing disabled API response and safe unavailable state. No durable access evidence or production database protections are claimed.

## Changed-file inventory and component reuse

| File under `apps/web/`                                 | Responsibility                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `src/app/(portal)/system-logs/page.tsx`                | Thin App Router entry                                                                                                  |
| `src/features/system-logs/pages/system-logs-page.tsx`  | Activity & Audit page, filters, pagination, source warnings, detail panel and operation investigation                  |
| `src/features/system-logs/model/management-history.ts` | Safe frontend projection, UTC query construction, cursor-advance policy and role helper                                |
| `src/features/system-logs/api/system-logs-api.ts`      | Standard authenticated same-origin list/detail/operation integration and safe errors                                   |
| `src/features/workspaces/model/route-policy.ts`        | Administration route and marked navigation, Superadmin only                                                            |
| `src/components/layout/sidebar.tsx`                    | Existing History icon for new route                                                                                    |
| `src/features/auth/api/auth-api.ts`                    | Optional unknown response body on ApiError, allowing validated 503 source metadata; refresh/session behavior unchanged |
| `test/system-logs.test.mjs`                            | Five unit tests for filters, navigation, pagination policy, details/privacy and API metadata                           |
| `test/route-policy.test.mjs`                           | Exact Superadmin navigation expectation includes unavailable-labelled entry; ordinary-role expectations unchanged      |
| `e2e/system-logs.spec.ts`                              | Isolated responsive, authorization, state, privacy and keyboard/focus tests                                            |

Documentation: this report, feature index, RBAC and module reference. All pre-existing uncommitted work is preserved. No API code/gate, history writer, business mutation, schema or migration changed in Phase 2C.

Reused components: PortalLayout, account context/workspace policy, PageHeader/content frame, responsive table primitives, skeleton/error rows, Input, FilterSelect/Radix Select, Button, SidePanel/DetailList/animated close/focus restoration, useAsyncResource cancellation and stale-result guards, date/enum formatting, shared module registry, apiRequest and existing Playwright mock/session helpers. The page and detail panel are feature-specific; no duplicate shared design system was added.

## Filters, pagination and details

Activity & Audit supports primary module (Administration, People & HR, Service Operations), Account/Workforce source, normalized event name, action, actor ID, subject ID/type, operation UUID and UTC dates. Default: seven inclusive UTC dates. The client rejects invalid dates, reversed ranges and windows over 31 days before requesting; remaining enum/ID/conflict validation stays authoritative in the API. Queries request 50 events per page.

Draft filters apply together and reset cursor history. Next passes the opaque signed cursor unchanged; Previous re-fetches the previous cursor. Requests abort on state changes and stale rows hide during loading/failure. Every response replaces the page; partial pages are never appended. Filters/cursors stay in memory rather than browser storage/URLs; reload returns to defaults.

Event count is displayed separately from **operations on this page**. The UI validates `grouping.scope = page` and verifies counts against unique projected events/operations. It never promises global totals or complete operations. **Investigate operation** clears other filters, retains the date range and uses the existing operation endpoint with the recorded UUID. Related events remain individual source-aware records; no duplicated timeline is generated.

Details re-fetch the exact source/native ID within the date range and show historical actor ID, recorded role-at-time or Not recorded, affected resource, UTC timestamp, source/module/event/operation IDs, approved changed field names, safe identifier/state transitions and session-revocation flag. Deleted IDs remain evidence without current-name lookup or current-role inference. Missing detail responses produce a retryable panel error rather than silently substituting list data.

## Privacy, gaps and unavailable states

The frontend projects only approved normalized fields. It never renders raw source JSON, raw summaries, names/emails, arbitrary transition values, stack traces, credentials or diagnostic details. Invalid shapes, duplicate event IDs and mismatched counts/scope produce safe verification errors. Additional fields are discarded; React text rendering and bounded ID/state checks prevent HTML interpretation. Personal field names can appear; personal field values cannot.

ApiError retains unknown response data for consumers to validate explicitly. This feature safely parses 503 bodies through its page projection, preserving all-unavailable source metadata. It displays fixed safe error messages, not raw ApiError messages. Shared auth renewal/revocation remains unchanged.

| State                                | UI behavior                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Loading or changed page              | Labelled skeleton/status, aria-busy; old rows hidden                                                     |
| Empty verified page                  | No matching events, without claiming no historical action occurred                                       |
| Malformed rows                       | Incomplete warning and source omission count/reason                                                      |
| Unavailable source or structured 503 | Explicit availability/unknown omissions; retry replaces current page; Next disabled on any source outage |
| Scan cap                             | Warning; an empty verified window can continue using its signed cursor                                   |
| Disabled API                         | Safe release-unavailable message and retry, no gate bypass                                               |
| Invalid response/general error       | Verification/load error and retry, no raw payload                                                        |
| Detail missing/unavailable           | Safe detail error and retry                                                                              |
| API denial                           | Safe current-account denial; backend remains authoritative                                               |

All filters have accessible names. Table/cells retain roles; pagination is labelled; detail dialog has title/description, Escape handling and restored focus. Filters reflow across one to four columns, rows stack below the table container breakpoint and IDs wrap. Accessibility checks cover these interactions and no horizontal overflow; they are not a complete WCAG certification.

## Validation

Browser tests use isolated HTTP fixtures around the real built Next UI and standard authenticated client. They **do not** connect to the actual Express System Logs router or establish live browser-to-backend integration. No production gate is activated.

- Frontend unit suite: 127/127 passing, including five new feature tests.
- Backend regression suite: 436/436 passing, zero failures/skips; API implementation/gate unchanged.
- Responsive Playwright cases cover 390×844, 768×1024, 1280×800 and 1600×1000; filters, cursor replacement/back, safe historical details, operation investigation, navigation, partial/empty/malformed/scan-cap/503/disabled responses, role denial without API calls, loading, detail retry, safe 403 errors, keyboard Escape/focus restoration and privacy/no-overflow checks.
- Screenshots are retained under ignored `apps/web/test-results/system-logs-*.png`. Mobile and desktop page images were visually inspected. Initial tests had ambiguous Next route-announcer/date-help locators; these were scoped without weakening assertions. The initial Windows Playwright-managed server did not exit cleanly after failed tests; final runs use a task-owned production server on port 5274 with isolated mocks.

| Final executed check                                                                              | Result                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `pnpm --filter @nexus/web test`                                                                   | PASS, 127/127 tests, exit 0                      |
| Isolated `playwright test system-logs.spec.ts --workers=2 --reporter=line --global-timeout=90000` | PASS, 9/9 tests, zero skips, exit 0              |
| `pnpm test:api`                                                                                   | PASS, 436/436 tests, zero failures/skips, exit 0 |
| `pnpm format`                                                                                     | PASS, exit 0; scope inspected                    |
| `pnpm lint`                                                                                       | PASS, zero warnings, exit 0                      |
| `pnpm typecheck`                                                                                  | PASS, API/web, exit 0                            |
| `pnpm build`                                                                                      | PASS, API/web production builds, exit 0          |
| Report links and `git diff --check`                                                               | PASS                                             |

The final browser run used `NEXUS_E2E_LIVE=0` and `NEXUS_E2E_BASE_URL=http://127.0.0.1:5274` with a task-owned built frontend server; it was stopped afterward. The mobile detail panel was also visually inspected. Initial lint required preserving caught error causes when replacing them with fixed safe messages; no arbitrary message/cause is rendered in this feature. Existing pg deprecation and Playwright NO_COLOR warnings remain non-fatal. No new failures remain in the executed checks; the whole pre-existing browser suite was not run.

No browser/web unit behavior is inferred from a build alone. No live API, real credentials, production privilege inspection, migration, seed, collection or deployment was used.

## Limitations and Phase 2D prerequisites

1. Explicit Phase 2D instruction is required; completion does not authorize release.
2. Keep production API disabled. Durable logs-access evidence and fail-closed delivery behavior, actual database grants/RLS/append-only protections, ownership and retention policies need separate implementation/verification. No frontend switch can establish them.
3. Phase 2A physical sort costs, scan caps, malformed boundary and late-commit consistency limitations remain. Production-sized query validation and separately authorized index decisions are still pending.
4. Only the two management histories are supported. Attendance/workflow adapters, operational/security collection, exports, repair/replay and global operation totals are absent.
5. Whole UTC dates and in-memory filters are intentional current limits. Approved controlled end-to-end testing remains necessary before any integration claim.

Stop after Phase 2C. Phase 2D and production activation have not started.
