# Messaging and API test regression recovery

Developed: 2026-11-15

## Confirmed causes and fixes

| Concern                                 | Cause                                                                                                                                                                                                                                                                 | Correction                                                                                                                                                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Four Messaging archive-control timeouts | The search field retained a fixed desktop width inside a narrower flex child. Its label extended over the archive button and intercepted pointer events.                                                                                                              | Make the search field fill its own flex container at every breakpoint. Existing click assertions remain unchanged; no forced clicks or authorization changes.                                                                                    |
| Mobile Admin shared-thread test         | The test tried to click an authorized module card outside the visible carousel slot.                                                                                                                                                                                  | Focus the intended card before clicking, using the carousel's existing focus behavior. Keep navigation, shared-thread persistence and single-send assertions.                                                                                    |
| Client-milestone workflow assertion     | The test obtained internal milestone IDs from a Client project response, whose deliberate contract is an empty internal milestone array.                                                                                                                              | Assert the Client's empty milestones and denied management capability. Obtain milestone IDs through the assigned Staff endpoint, then retain completion/reopening and assignment-revocation checks. No production project authorization changes. |
| `tsx` test startup                      | On this restricted Windows host, both the CLI and Node import loader call `os.userInfo()` while initializing their temporary/IPC directory; `uv_os_get_passwd ENOMEM` occurs before application code runs. Disabling the CLI alone does not avoid the loader's probe. | API test scripts and the real-API browser fixture now compile with the existing TypeScript configuration and execute through native Node. No OS identity override, dependency patch, live database or manual compiler staging is needed.         |

The full API run also exposed three obsolete Client-directory assertions from before Superadmin administrative access was implemented. They now verify the already-authorized Superadmin read/create behavior, identical safe read projections, and forced Client role on creation. Staff/Client access denial and Admin edit/delete denial remain covered. No Client controller or permission mapping was changed in this follow-up.

## Test runner and real API fixture

`apps/api/scripts/run-tests.mjs` compiles the complete API/test tree before execution. Each invocation uses an isolated generated directory under `apps/api/.test-build`, preventing stale output or concurrent fixture/test collisions. It stages the existing SQL migrations and public database CA certificate at their expected relative paths, without copying environment files or credentials. Cleanup checks that its resolved target remains its own generated workspace directory. Git, Prettier and ESLint exclude the generated tree.

`pnpm test:api`, API `test`, `test:project-chat`, `test:calendar`, `test:smoke` and `test:api-regression` all use this runner. Native tests use two workers by default to bound PGlite memory use. A selected suite can be run with:

```sh
pnpm --filter @nexus/api test tests/request-workflow.test.ts
```

The `--fixture tests/support/attendance-browser-server.ts` mode loads the compiled offline fixture in the launcher process itself. Playwright therefore terminates the actual API process during teardown, rather than leaving a grandchild server behind. Windows force termination can leave an isolated ignored build directory, but subsequent invocations never reuse it.

Attendance browser code retains same-origin `/api/...` requests, forwarded to the actual loopback Express/PGlite fixture through test-only context routing. This works regardless of the API target baked into the shared Next build and also covers additional pages opened by tests. Requests and response bodies are not mocked. Native browser forwarding preserves navigation cancellation without a fetch/fulfill replay or error suppression. Forwarding remains active until the browser context closes, so background polling cannot fall through to a developer backend during teardown. Production proxying and authentication are unchanged.

Raw `tsx` remains an environment limitation for unrelated developer/seed commands; those commands were not changed. All automated API test and browser-fixture launch paths avoid the failing OS-user probe.

## Changed files

- Production UI: `apps/web/src/features/request-conversations/components/conversation-search.tsx`.
- API tests: `apps/api/tests/request-workflow.test.ts`, `apps/api/tests/client-integration.test.ts`.
- Browser tests: `apps/web/e2e/internal-conversations.spec.ts`, `apps/web/e2e/attendance.spec.ts`.
- Tooling: new `apps/api/scripts/run-tests.mjs`; `apps/api/package.json`; `.gitignore`, `.prettierignore`, `eslint.config.mjs`.
- Documentation: this report, the feature index and follow-up links from earlier audit reports.

## Verification

- All 281 backend tests passed through the normal `pnpm test:api` command. This includes the previously failing Client-milestone workflow suite, current Client-directory permissions, Messaging participation/security and all earlier Superadmin authorization coverage.
- All 105 web unit tests passed.
- All 134 selected browser tests passed in one combined run: the 104 Messaging/oversight/navigation regressions, all 24 real Express/PGlite Attendance tests, and 6 Superadmin Attendance regressions. All five formerly failing Messaging scenarios now pass. No selected browser test was skipped or blocked.
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, the API/web production build and `git diff --check` passed.

Initial runs exposed stale Client-directory assertions and asynchronous fetch/fulfill forwarding races in the newly executable browser fixture. The final runs above supersede those failures; no test was disabled, forced through a click, or granted broader production permissions to make it pass.

Earlier uncommitted changes remain preserved. This follow-up changes no roles, operational eligibility, private-conversation policy, Client ownership, workflow stages, attendance calculations or approval authority.
