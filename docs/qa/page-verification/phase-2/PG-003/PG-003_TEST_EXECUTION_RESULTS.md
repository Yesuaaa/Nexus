# PG-003 Test Execution Results

**Execution baseline:** branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `9335f946dd09a9870a20222034488e82317ca58c`.  
**Scope:** focused PG-003 unit/browser tests and existing direct Superadmin entry regressions only. The full Converyn regression suite was not run.

## Results

| Execution                                                  | Command / working directory                                                                                                                                                                       | Result                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New unit tests plus relevant attendance/route-policy tests | From `apps/web`: `node --experimental-strip-types --test test/attendance.test.mjs test/route-policy.test.mjs`                                                                                     | **PASSED:** 28/28 tests, 0 failed, 0 skipped. This includes T001/T002 and existing tests in both focused files.                                               |
| New PG-003 browser tests                                   | Repository root: `pnpm --filter @nexus/web exec playwright test e2e/attendance-entry.spec.ts --workers=1`                                                                                         | **PASSED:** 6/6 Playwright tests (T003, T004, T006–T009), 0 failed, 0 skipped.                                                                                |
| Existing Superadmin entry regressions                      | Repository root: `pnpm --filter @nexus/web exec playwright test e2e/superadmin-module-access.spec.ts e2e/superadmin-attendance.spec.ts --grep "Superadmin selects and enters Workforce Compliance | Superadmin uses existing attendance administration without self-service" --workers=1`                                                                         | **PASSED:** 3/3 tests: Workforce Compliance module entry, and attendance administration at 1440px and 390px. |
| `pnpm format`                                              | Repository root                                                                                                                                                                                   | **PASSED**, exit code 0.                                                                                                                                      |
| `pnpm lint`                                                | Repository root                                                                                                                                                                                   | **PASSED**, exit code 0 (`eslint . --max-warnings 0`).                                                                                                        |
| `pnpm typecheck`                                           | Repository root                                                                                                                                                                                   | **PASSED**, exit code 0 for API and web. Prisma client and Next route type generation completed. The incidental `apps/web/next-env.d.ts` change was restored. |

Playwright's configured web server performed a local Next production build before each browser invocation; both started successfully. The console emitted environment color-variable warnings only; no test failed from them.

## Failed attempt and correction

The first sandboxed invocation of the focused Node command returned `spawn EPERM` before either test file ran. It is classified **BLOCKED — ENVIRONMENT**, not a failed assertion. The identical command was rerun with reviewed process-spawn access and passed 28/28. No code change was made in response to that environment restriction.

## Deferred and not applicable

- T010: **BLOCKED — CONTRACT** (C001 query/navigation semantics remain unspecified); excluded from passing-test counts.
- Attendance API and PGlite/database tests: not applicable to PG-003's own behavior because the entry component makes no attendance request and performs no persistence operation.
- No application defect was identified in the tested PG-003 behavior. No test assertion failed.
- No full regression suite or broad database suite was run.
