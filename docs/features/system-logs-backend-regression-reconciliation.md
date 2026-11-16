# Phase 2A.1 — backend regression contract reconciliation

Developed: 2026-11-16. Follow-up to the [Phase 2A reader report](system-logs-management-read-adapters.md). Test corrections only; no System Logs Phase 2B work.

## Verified root causes and corrections

### Administrative project workspace details

The failing assertion used an ordinary Admin to request a group with no projects in the selected department and expected 404. The same test already asserted Admin denial on valid resources. Current [route middleware](../../apps/api/src/features/project-workspace/project-workspace.controller.ts) requires `modules:access-all`, `organization:read-all` and `departments:read`; the [permission map](../../apps/api/src/features/auth/auth.permissions.ts) grants the first two only to Superadmin. The [detail service](../../apps/api/src/features/project-workspace/project-workspace.service.ts) repeats current actor checks, requires typed workspace identity, and filters projects by the selected department and group/ungrouped identity. Empty scoped results return 404. A valid bare identity reaches the service's typed-ID requirement and returns 400 only for an authorized caller.

The intended visibility contract is corroborated by [Superadmin project visibility](superadmin-project-visibility.md), the [authorization audit](superadmin-comprehensive-authorization-audit.md), and neighboring department/project administrative tests. Ordinary roles cannot inspect this administrative resource; 403 before resource lookup is correct. An authorized Superadmin receives 404 when the workspace has no projects in the selected department or when a grouped project is requested as ungrouped.

**Correction:** use the existing Superadmin fixture for the two resource-visibility 404 assertions and typed-identity 400 assertion. Preserve those exact status assertions. Extend the existing Admin/Staff/Client denial loop across an existing group, an out-of-department group and a missing group, asserting both 403 and the generic permission-denial body. No production authorization or resource lookup changed.

### Service specialist / booking test enum

The test asserted a six-value database enum before exercising any endpoint. Current [Prisma schema](../../apps/api/prisma/schema.prisma) defines eight values. Existing [lifecycle enum migration](../../apps/api/prisma/migrations/20261115040000_request_lifecycle_statuses/migration.sql) adds `ACTIVATED` and `CONCLUDED`; the [normalization migration](../../apps/api/prisma/migrations/20261115040100_normalize_request_lifecycle/migration.sql) maps existing request/project state. Workflow activation writes ACTIVATED; workspace completion writes CONCLUDED transactionally. Request filters support both values, and [request lifecycle documentation](department-request-inbox.md) plus `tests/request-lifecycle.test.ts` explicitly cover their meanings.

**Correction:** add the two missing literal values to the exact sorted enum expectation. This retains an independent assertion of all expected database labels rather than deriving the expectation from the same schema under test. Existing legacy labels remain required. The final subtest intentionally constructs a historical six-label fixture to verify submission/replay compatibility; that fixture and its assertions are preserved. No schema, migration, status mapping, API filter or business workflow changed.

## Changed files and preservation

- `apps/api/tests/admin-project-workspace-details.test.ts`: correct the actor used for visibility/input validation and strengthen ordinary-role denial coverage.
- `apps/api/tests/service-specialists.test.ts`: reconcile the exact enum assertion with verified lifecycle behavior.
- This report and the feature index; a dated follow-up link on the Phase 2A report preserves its historical results while identifying the subsequent reconciliation.

All pre-existing uncommitted Phase 1/2A files are preserved. No tests were skipped, statuses loosened, assertions removed, permissions broadened, implementation code refactored or migrations added. All database work in validation uses the offline PGlite harness.

## Validation

Independent reproduction before edits:

| Command (`pnpm --filter @nexus/api test …`)     | Before                                                            | After                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `tests/admin-project-workspace-details.test.ts` | FAIL, exit 1: 403 received / 404 expected                         | PASS, 1 test, exit 0                                              |
| `tests/service-specialists.test.ts`             | FAIL, exit 1: enum missing ACTIVATED and CONCLUDED in expectation | PASS, 5 tests, exit 0; all four formerly blocked subtests execute |

The selected neighboring run passed all 38 tests across:

- `admin-project-management-departments.test.ts`
- `features/auth/administrative-projects.test.ts`
- `features/auth/administrative-project-management.test.ts`
- `project-workspace-scope.test.ts`
- `request-lifecycle.test.ts`
- `request-inbox.test.ts`
- `request-workflow.test.ts`
- `features/services/validation.test.ts`

All paths above are relative to `apps/api/tests/` and were passed together to `pnpm --filter @nexus/api test`.

| Final check                         | Actual result                                    |
| ----------------------------------- | ------------------------------------------------ |
| Complete `pnpm test:api`            | PASS, 425/425 tests, zero failures/skips, exit 0 |
| Selected neighboring suites         | PASS, 38/38 tests, exit 0                        |
| `pnpm format`                       | PASS, exit 0; diff scope inspected               |
| `pnpm lint`                         | PASS, zero warnings, exit 0                      |
| `pnpm typecheck`                    | PASS, API and web, exit 0                        |
| `pnpm build`                        | PASS, API and web, exit 0                        |
| Report links and `git diff --check` | PASS                                             |

The previous Phase 2A full run had 419 passes and two failures out of 421 tests. The corrected full run has 425 passes: the additional four are the specialist parent test's formerly blocked subtests, not newly invented or skipped tests. Both independently reproduced failures are resolved. No additional backend assertion failures remain in the executed full suite.

## Remaining risks and phase boundary

These corrections establish no new production behavior or deployed infrastructure guarantee. Existing non-fatal pg concurrent-query deprecation warnings are separate from assertion failures. No live database, browser suite, web unit suite or deployment is part of this backend-test reconciliation. Phase 2A's production protection/access-audit prerequisites remain unchanged. Stop after Phase 2A.1; Phase 2B is not authorized by this report.
