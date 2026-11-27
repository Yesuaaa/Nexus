# PG-021 test execution results

Evidence applies to `development` at `bf824f218e3b45a39b1ec68d2ba561abe7cf7052` with the PG-021 test-only worktree. Command counts include existing suite registrations and nested API cases. The unique case results are in [final verification](PG-021_FINAL_VERIFICATION.md).

## Focused API and unit

Command from repository root:

```powershell
pnpm test:api "tests/features/departments/*.test.js" tests/department-integrity.test.ts
```

The initial selection with the two new unit cases passed 73/73, exit 0. A subsequent attempt with both new API cases collided with Prisma generation in a concurrent typecheck and exited 1 with missing generated model files (TS6053); the API tests did not start. The serialized attempt ran 75 declarations/nested tests, of which 73 passed and two failed, exit 1. The new cases built an incorrect `/api/api/departments` path because the harness base already includes `/api`. The correction changed only the two test URLs. `pnpm test:api tests/features/departments/pg021-boundaries.test.ts` then passed 2/2, exit 0. Real router, auth, Prisma and disposable migrated PGlite were exercised.

The expired and deleted server-side sessions returned 401 without protected payload or Department/User/Employee/history mutation. The options test checked exact projection, pagination defaults, trimmed length boundary and invalid filters with unchanged domain data. Earlier PGlite cases provided their original existing-sufficient projections, leadership rules, relationship writes, actor attribution and rollback evidence.

The final full focused command passed 75/75 with zero skips and exit 0. This includes both unit cases, both new API cases and the original department suites.

## Mocked browser

```powershell
pnpm --filter @nexus/web exec playwright test e2e/departments/department-management.spec.ts e2e/shared/departments.spec.ts e2e/shared/department-member-workflows.spec.ts --workers=1 --retries=0
```

Chromium used the default isolated Next and stub public-service servers on loopback 5273 and 5274. The initial subset ran 11 instances (9 passed and 2 failed, exit 1). Both A005 widths failed after the keyboard trigger reported expanded but the View Department menuitem remained absent. This reproduced PG-004-D-001 in this shared menu; downstream keyboard dialog/focus steps were not reached at either width.

The first complete selection ran 21 instances (13 passed and 8 failed, exit 1), including four adjacent compatibility declarations. A002 and A014 used an incorrect Retry locator for components exposing Try again. A021 walked the wrong DOM ancestor to find the Add button; the recovery scopes Add to its semantic list item and observes the card after closing the subview. These are test-only locator corrections. A015 retained the expected absence of the current member from a stale candidate response, A017 retained the assignment error visibility assertion, and A019 retained focus return. Soft checks on A015 and A017 allow independently observable later steps while preserving failure status.

The complete browser command after the initial fixture corrections yielded 15 passed and six failed instances, exit 1. A002 and A021 passed. A014 reached the read-only phase, where the later generic session mock shadowed the earlier exact detail route. The mock was re-registered after session setup and the focused command below passed 1/1, exit 0.

```powershell
pnpm --filter @nexus/web exec playwright test e2e/shared/department-member-workflows.spec.ts --grep PG-021-F001-A014-T001 --workers=1 --retries=0
```

Across the final evidence, 16 of 21 Playwright instances passed and five failed. The failures correspond to four approved cases because A005 has two widths. A006 and A031 share a test declaration and all four adjacent compatibility declarations passed. No retries or skips were added. A015 reached its later candidate-error retry; A017 completed independent removal after recording missing inline feedback. A019 rendered the updated position but failed focus restoration. See [case outcomes](PG-021_FINAL_VERIFICATION.md).

## Real rewrite

```powershell
pnpm --filter @nexus/web exec playwright test --config playwright.pg021.config.ts --workers=1 --retries=0
```

The first attempt exited 1 at the Next build because the test used Promise.withResolvers outside the web TypeScript lib target. The test-only replacement uses a controlled promise compatible with the existing target. Fixed fixture labels/imports and corrected the history projection to actorAccountId. The rerun passed 1/1, exit 0, with independent task-owned Next on 5283 and Express on 5284 backed by disposable migrated PGlite. A locally issued Admin session was seeded into sessionStorage. The browser received same-origin POST 200; Express receipts showed the membership POST and detail GET; reopening showed the candidate as a member. The fixture reported both linked assignments and authenticated actor history. No target API interception occurred.

## Real PostgreSQL contention

The sandbox initially denied Docker pipe access (exit 1). Approved `docker info --format '{{.ServerVersion}}'` succeeded. The isolated shell started a uniquely named, automatically removed `postgres:16` container with database `nexus_pg021` on a Docker-selected loopback port (65275 in this run). It waited for pg_isready, set the disposable URL in process-local environment, and ran:

```powershell
pnpm --filter @nexus/api exec prisma migrate deploy
pnpm test:api tests/features/departments/pg021-head-contention.postgres.ts
```

Both commands exited 0. PostgreSQL 16.16 reported 92 applied migrations and an empty account fixture before setup. Two Admin sessions and two independent PostgreSQL backends targeted one active unassigned Staff candidate with a linked Employee. The first transaction reached its AFTER UPDATE barrier; the observer identified the second backend as blocked by the first at the candidate row lock. The test verified one successful claim, matching User and Employee placement and title, no sub-team drift, and one attributed operation with no losing operation history. The test dropped its barrier and stopped its Express server and connections. The outer finally stopped the named container and the filtered Docker listing returned no matching container.
