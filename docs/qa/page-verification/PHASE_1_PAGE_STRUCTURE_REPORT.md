# Phase 1 — Page Structure Verification Report

**Project:** Converyn (formerly Nexus)  
**Snapshot:** branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD cb9dcb10f29634f79ce66942babe0f3588d6c058  
**Historical audit:** a3d4c2b6b02f760eff31ec298bccb39222e3a24f, dated 2026-11-23  
**Scope:** Phase 1 source inventory and documentation only. No application or test source was changed; no test suite or runtime workflow was run.

## Status

**COMPLETE — SOURCE INVENTORY.** This status means the route definitions, aliases, shared layouts, policy sources, primary feature entry points, API families, schema domains, and existing test files have been inventoried from the checked-out source. It does not mean any route, workflow, API, database connection, or test has passed at runtime. Relationships whose full chain could not be established are marked UNVERIFIED.

## Repository baseline

| Item                              | Current evidence                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                            | 293-test-full-system-audit-for-verifying-recent-changes                                                                                                                                                                                         |
| HEAD                              | cb9dcb10f29634f79ce66942babe0f3588d6c058                                                                                                                                                                                                        |
| Initial working tree              | Clean; git status --short --branch showed only the branch/upstream line                                                                                                                                                                         |
| Change from historical audit HEAD | git diff a3d4c2b6b02f760eff31ec298bccb39222e3a24f..HEAD --stat shows only the added historical report docs/full-audit/CONVERYN_Complete_System_Audit_Report_2026-11-23.md; no application, schema, or test source changed between those commits |
| Workspace                         | pnpm workspace includes apps/* (pnpm-workspace.yaml)                                                                                                                                                                                            |
| Web                               | Next.js 16 App Router, React 19, TypeScript; app routes in apps/web/src/app, behavior in apps/web/src/features                                                                                                                                  |
| API                               | Express 5; app assembly in apps/api/src/app.ts, startup in apps/api/src/index.ts                                                                                                                                                                |
| Persistence                       | Prisma schema at apps/api/prisma/schema.prisma; shared API database client at apps/api/src/lib/db.ts                                                                                                                                            |
| Mobile                            | Kotlin/Compose starter; excluded from web route counts                                                                                                                                                                                          |

The historical report is present at docs/full-audit/CONVERYN_Complete_System_Audit_Report_2026-11-23.md. The ten separate original audit reports are not present under docs/full-audit/; the consolidated report says it incorporated them. It is used as historical context only. Its HEAD is not the current HEAD.

## Current route census

- 71 source page.tsx definitions.
- 63 rendered page surfaces and eight redirect-only aliases.
- Five parameterized route patterns: /module/[moduleId], /project-management/departments/[departmentId]/projects, /projects/[id], /projects/[id]/deliverables/[milestoneId], and /project-workspace/[id].
- Three public authentication pages (/login, /internal/login, /register), one conditional root entry (/), and 67 portal-group page definitions. The portal group includes 59 rendered authenticated pages and eight aliases; portal access is mediated by PortalLayout.
- Two layouts: root apps/web/src/app/layout.tsx and portal apps/web/src/app/(portal)/layout.tsx.
- One fallback apps/web/src/app/not-found.tsx.
- No App Router template.tsx, loading.tsx, error.tsx, global-error.tsx, route.ts, or default.tsx files were found under apps/web/src/app.

The complete stable inventory is in PHASE_1_COMPLETE_ROUTE_INVENTORY.md. PG-001 through PG-063 identify rendered page surfaces in ordinal route-path order. AL-001 through AL-008 identify redirect-only source routes separately.

## Architecture and routing

The root layout wraps all route groups in AuthProvider. Public auth routes use the same root layout and the shared auth page component. Portal routes use the portal layout, which loads the current account, applies the client route policy, and renders account/preferences/breadcrumb/workspace providers (apps/web/src/app/layout.tsx:1, apps/web/src/app/(portal)/layout.tsx:1, apps/web/src/components/layout/portal-layout.tsx:19).

The Next.js rewrite proxies /api/:path* to API_PROXY_TARGET, defaulting to http://localhost:3001 (apps/web/next.config.ts:62-67). Express mounts the domain API routers in apps/api/src/app.ts:63-145. These are source-defined connections; no server was started and no request was made.

Redirect-only routes and the /forgot-password destination were rechecked against current source. The eight redirect aliases are enumerated separately in the route inventory. The recovery link remains an orphan: apps/web/src/features/auth/components/auth-fields.tsx:132-142 renders /forgot-password, but no matching App Router page or self-service recovery API exists in the inspected source. This is a source-confirmed structural defect, not a browser observation.

## Authorization structure

Fixed roles are SUPERADMIN, ADMIN, STAFF, and USER (apps/web/src/features/auth/model/roles.ts:1-16, apps/api/src/features/auth/auth.permissions.ts:3-100). Portal-level route decisions are in apps/web/src/features/workspaces/model/route-policy.ts; shared eligibility helpers are in apps/web/src/features/auth/model/permissions.ts. API routers independently apply bearer-session, role, permission, capability, ownership, assignment, department, participant, and workflow-state checks. Navigation visibility is not evidence of API permission.

The route-by-role and route-by-API summaries are in PHASE_1_PAGE_AUTHORIZATION_MATRIX.md and PHASE_1_PAGE_API_DEPENDENCIES.md. Resource-specific access cannot be reduced to a role-only matrix, so ownership, department/head assignment, project membership, and workflow stage are recorded as conditions.

## Page behavior and test inventory

The functionality inventory assigns one stable primary behavior cluster (F001) to each rendered page. It records the source-defined action family and delegates deeper control-level breakdown to the owning feature component. This produces 63 stable page-feature anchors; it is not a count of every button, event callback, or assertion. The entry-point and feature sources are mapped in PHASE_1_PAGE_COMPONENT_MAPPING.md and PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md.

Current source contains 34 web unit files, 95 Playwright E2E files, 114 API test files, four integrated payroll Playwright specs, one separately named PostgreSQL concurrency integration file, and three Kotlin test files: 251 files in the historical audit's matching categories. This Phase 1 run did not execute any of them. The per-page mapping and direct/indirect/gap labels are in PHASE_1_EXISTING_TEST_COVERAGE.md.

## Phase 1 deliverables

1. PHASE_1_PAGE_STRUCTURE_REPORT.md
2. PHASE_1_COMPLETE_ROUTE_INVENTORY.md
3. PHASE_1_PAGE_COMPONENT_MAPPING.md
4. PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md
5. PHASE_1_PAGE_API_DEPENDENCIES.md
6. PHASE_1_PAGE_AUTHORIZATION_MATRIX.md
7. PHASE_1_EXISTING_TEST_COVERAGE.md
8. PHASE_1_FINDINGS_AND_LIMITATIONS.md
9. PHASE_2_TEST_PLANNING_BASELINE.md

## Quality gate and stop

| Required command | Result                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| pnpm format      | PASS, exit 0                                                                       |
| pnpm lint        | PASS, exit 0                                                                       |
| pnpm typecheck   | PASS, exit 0; web route type generation and API Prisma client generation completed |

The local pnpm 12.15.0 executable was used with package-manager version switching disabled because access to the global pinned-version store lock was denied. Typecheck regenerated apps/web/next-env.d.ts; the file was restored from the checked-out index, and its content hash matches HEAD. The historical audit report was also restored to its indexed bytes after the repository-wide formatter touched it. Git reports no tracked content diff; only the new QA documentation directory contains intended content changes. No test command, browser run, server startup, build, or database operation was executed.

**Phase control:** Phase 1 only. Phase 2 and Phase 3 remain unauthorized and unexecuted.
