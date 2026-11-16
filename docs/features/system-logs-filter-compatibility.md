# System Logs filter compatibility fix

Developed: 2026-11-16

Activity & Audit now checks retained selections before applying a workspace/module change, All Modules, or the existing filter form. Incompatible combinations produce a contextual shared Alert naming the requested scope and the exact selections proposed for removal. No incompatible read is sent and the applied scope, results, cursor and investigation return state remain intact while the choice is pending.

**Clear incompatible filters and apply** explicitly removes the smallest set needed for compatibility, then applies the scope and resets pagination for the changed query. Compatible source/action/event/subject/operation selections remain; ties favor retaining the exact event search. Dates and opaque actor/subject identifiers are never removed by compatibility correction. Applied and unapplied filter selections are checked independently so scope shortcuts do not silently apply pending edits. **Keep current filters** cancels the proposal without discarding selections. Editing a filter invalidates the old proposal and the next apply checks the new combination.

The advisory model uses the existing frontend action/subject catalogs and the established `parseManagementQuery` source/module, subject/action/event and operation-availability rules. Existing UTC date validation remains in `historyQuery`; backend validation stays authoritative. Unsupported modules retain their existing coverage state. Exact event search remains an exact approved name, rather than arbitrary text search.

## Changed files and reuse

- `apps/web/src/features/system-logs/model/history-filter-compatibility.ts`: bounded advisory compatibility check and immutable explicit correction; at most 32 candidate field subsets.
- `apps/web/src/features/system-logs/pages/system-logs-page.tsx`: pending conflict handling through existing scope actions and filter panel. Reuses Alert, Button, SidePanel, current filter fields and query validation.
- `apps/web/test/system-logs.test.mjs`: focused minimum-correction, non-mutation, scope/source/event, operation and retained-state tests.
- `apps/web/e2e/system-logs-integration.spec.ts`: mobile and desktop conflict flows against the existing real Express/PGlite and built Next rewrite fixture, including module override, All Modules, workspace return, cancellation, explicit correction and compatible selection/date preservation.
- This report, `docs/features/README.md` and the repository skill module reference: fix documentation.

## Validation

| Check                                                           | Actual result                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused System Logs unit tests                                  | 12/12 passed, including two new compatibility/correction cases.                                                                                                                                                                                            |
| Complete frontend unit suite                                    | 141/141 passed, exit 0.                                                                                                                                                                                                                                    |
| `pnpm test:system-logs-integration`                             | 74/74 Playwright cases passed: 26 real forwarded Express/PGlite, 26 real built Next rewrite, 22 existing mocked UI cases. New mobile/desktop scope-conflict cases passed on both real transports.                                                          |
| Offline fixture lifecycle and history integrity                 | 1/1 native fixture test passed, history unchanged and owned services cleaned up.                                                                                                                                                                           |
| Advisory/server compatibility comparison                        | 12,720 source/module/event/operation and paired action/subject combinations matched the unchanged `parseManagementQuery`; every proposed correction was accepted by that parser. Local verification script: `.ci-tools/system-logs-filter-fix-parity.mjs`. |
| Root `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | Passed, exit 0. API/web build also passed within the browser workflow; final format/lint/typecheck gate rerun after the test-fixture correction and report update.                                                                                         |
| Scope and whitespace review                                     | Baseline file hashes confirm only the listed existing files changed; API readers, writers, authorization and activation guards match their pre-task content. `git diff --check` passed.                                                                    |

The initial browser attempt exposed a setup error in the new cases: a mocked-account workspace key was used with the real API account. The setup now uses the actual account ID and asserts the initial workspace; the complete browser workflow then passed. No timeouts, skips or production gates were weakened. The existing pg overlapping-query deprecation warning was non-failing. Logs/results are in `.ci-tools/system-logs-filter-fix-*`; final browser artifacts are in `.ci-tools/system-logs-offline-S6R0Ku`.

The unchanged full backend unit matrix was not repeated for this frontend-only fix. Relevant real API authorization, privacy, signed-cursor, source-failure and default-production-lock regressions ran through the established offline browser fixture. Chromium synthetic viewports do not certify real mobile devices or hosted deployment.

## Remaining limits

Compatibility is advisory and follows the approved source/event catalogs; future catalog changes must keep the advisory aligned with server validation. Malformed identifiers and other invalid query values still use existing validation/error handling. Exact event search, partial source coverage and production restrictions are unchanged.

No API, history reader/writer, authorization, schema, collector, Error Logs, System Health or production activation change is included. Production access remains disabled. No additional features or phases are implemented.
