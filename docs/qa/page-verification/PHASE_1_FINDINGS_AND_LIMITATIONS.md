# Phase 1 — Findings and Limitations

## Confirmed structural findings

| Finding                                                                                                                       | Classification                             | Evidence                                                                                                                                                            | Effect on later QA                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| The source census contains 71 page.tsx route definitions, 63 rendered surfaces, and eight redirect-only aliases.              | SOURCE VERIFIED                            | Complete file-derived table in PHASE_1_COMPLETE_ROUTE_INVENTORY.md; source root apps/web/src/app                                                                    | Use PG-001–PG-063 for rendered pages and AL-001–AL-008 for alias behavior                                                              |
| Five route definitions contain dynamic segments.                                                                              | SOURCE VERIFIED                            | /module/[moduleId], /project-management/departments/[departmentId]/projects, /projects/[id], /projects/[id]/deliverables/[milestoneId], /project-workspace/[id]     | Test valid, unknown, tampered, and unauthorized identifiers with isolated fixtures                                                     |
| The root and portal layout provide separate route shells; portal session and route restriction are implemented on the client. | SOURCE VERIFIED                            | apps/web/src/app/layout.tsx; apps/web/src/app/(portal)/layout.tsx; apps/web/src/components/layout/portal-layout.tsx:19-75                                           | Browser route tests must distinguish UI redirects from API denial                                                                      |
| The source-defined route policy is a front-end navigation gate; backend authorization is separately implemented.              | SOURCE VERIFIED                            | apps/web/src/features/workspaces/model/route-policy.ts; apps/api/src/features/auth/auth.middleware.ts; domain controllers/services                                  | Phase 2 must include API denial and resource-scope tests, not only hidden-link assertions                                              |
| The route /forgot-password is linked from the auth form but has no matching route source or self-service recovery API.        | SOURCE VERIFIED — ORPHAN DESTINATION       | apps/web/src/features/auth/components/auth-fields.tsx:132-142; no matching page under apps/web/src/app; inspected auth API source has no self-service recovery flow | Confirm with a safe browser navigation during authorized Phase 2; expected not-found destination is source-derived, not runtime-tested |
| Registry entry billing-finance is marked implemented:false and has no App Router page of its own.                             | INTENTIONALLY DISABLED                     | apps/api/src/features/modules/module-registry.json; PG-016 /billing-logs is a separate USER workflow-history page                                                   | Do not count /billing-logs as an implemented finance module                                                                            |
| The mobile app is outside the web page census and remains a Kotlin/Compose starter.                                           | SOURCE VERIFIED                            | apps/mobile source and historical audit; no mobile business route was included                                                                                      | Native verification requires a separate scope and Gradle workflow                                                                      |
| Existing tests cover multiple domain/page groups, but file presence is not an execution result.                               | SOURCE VERIFIED; TEST RESULTS NOT VERIFIED | 251 source files in the categories cataloged in PHASE_1_EXISTING_TEST_COVERAGE.md                                                                                   | Phase 2 must execute focused suites and record actual outputs                                                                          |

## Navigation reconciliation

The current source scan rechecked route files, direct links/redirects, and route-policy references. All eight redirect-only aliases have a page source. Current authored navigation includes:

- Role-dependent landing destinations: USER → /dashboard; internal roles → /module (auth-portal.ts and route-policy.ts).
- Three messages query modes in the sidebar: scope=project, scope=service, and mode=internal.
- Dynamic project and department destinations built from IDs, plus request selection in the query string.
- Registry-generated module destinations and attendance sub-navigation.
- The orphan /forgot-password destination.

The historical audit scanned 459 web source files and identified 52 unique root-relative literal destinations. Since the only commit delta from that audit source is the audit report itself, that static scan remains consistent with current application source. It did not establish the complete set of runtime-generated destinations or browser navigability. No navigation click-through was performed here.

## Relationships deliberately left unverified

These boundaries are listed rather than inferred:

1. Individual handler-to-endpoint call graphs for every nested dialog, form, table action, hook, and inline page have not been flattened. The component map reaches each route's primary page implementation; feature/API documents identify its owning client or mark a partial boundary.
2. The exact HTTP method, complete URL template, request schema, response projection, service function, and Prisma query are not duplicated for every one of the 63 page-feature clusters. Read the owning feature client/controller/service before defining each Phase 2 contract assertion.
3. Calendar and workload page endpoint closure can be data-source-dependent; dashboard cards can request several modules. Those cases are marked PARTIALLY VERIFIED or UNVERIFIED in PHASE_1_PAGE_API_DEPENDENCIES.md.
4. The route-level role policy does not encode all resource ownership, current employee assignment, department, project membership, or workflow-stage rules. Backend authorization must be rechecked per operation.
5. Page-level F001 entries are behavior clusters, not a complete count of every button, keyboard action, control, callback, validator, loading state, or error recovery path. Phase 2 should split these clusters after reviewing the component and current test assertions.
6. Test coverage is matched by test source file/domain and route evidence where available. An assertion-by-assertion map for all existing tests has not been generated, and no test result is claimed.
7. Source does not establish runtime route success, responsive behavior, API availability, database connectivity, migration state, storage/realtime connectivity, or current remote CI status.

## Historical baseline reconciliation

The supplied historical audit reports 71 page definitions, 248 API registration call sites, 76 Prisma models, 44 enums, 91 migration directories, and 251 automated test files. Current route enumeration reconfirms 71 page source files. Git evidence shows the current HEAD adds only the consolidated audit report after historical source HEAD a3d4c2b6b02f760eff31ec298bccb39222e3a24f; the web/API/schema/test source is unchanged across that commit range. The remaining historical counts are adopted as context, not independently recalculated in this page-focused phase.

The ten original detailed reports named by the consolidated audit are not present as separate files under docs/full-audit/. The consolidated report is the available historical artifact. No branch checkout, fetch, reset, or source edit was performed.

## Status limits

This is a source-structure baseline, not a runtime verification report. The source inventory is complete for route files and primary page entry points. Fine-grained handler/API/test-assertion tracing remains a Phase 1 limitation documented for explicit closure before testing dependent behaviors in Phase 2.
