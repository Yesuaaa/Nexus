# PG-003 Functional Discovery

**Phase:** 2.1 discovery and test design only  
**Status:** Complete; implementation authorization is pending  
**Page:** PG-003 — `/attendance`  
**Discovery baseline:** branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `9335f946dd09a9870a20222034488e82317ca58c`; worktree was clean at entry. The supplied request named `e983bc46cb8b4e8c71238af3158899ea02efae79` as the last reported HEAD. This checkout is newer/different; current source was used without changing Git state.

## Identity and implementation

| Concern                       | Verified source                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL and stable ID             | `/attendance`, PG-003, from the approved Phase 1 route inventory.                                                                                                                                                                                                                                                                                                                                                                                     |
| Route entry                   | `apps/web/src/app/(portal)/attendance/page.tsx:1-4`; a thin entry that renders the feature page.                                                                                                                                                                                                                                                                                                                                                      |
| Primary component             | `AttendanceEntryPage` in `apps/web/src/features/attendance/pages/attendance-entry-page.tsx:8-17`.                                                                                                                                                                                                                                                                                                                                                     |
| Feature area                  | Workforce Compliance / Attendance. This page is an entry redirect, not an attendance data view.                                                                                                                                                                                                                                                                                                                                                       |
| Layout                        | `apps/web/src/app/(portal)/layout.tsx:1-7` wraps the route in `PortalLayout`; no attendance-specific layout was found.                                                                                                                                                                                                                                                                                                                                |
| Account provider              | `PortalLayout` loads the current account, applies route policy, and provides `AccountContext` before rendering the route child (`apps/web/src/components/layout/portal-layout.tsx:21-91`).                                                                                                                                                                                                                                                            |
| Direct page API               | None. `AttendanceEntryPage` imports no attendance/leave API client and makes no feature request.                                                                                                                                                                                                                                                                                                                                                      |
| Shared auth API               | `useAccount` calls `getCurrentAccount()` (`apps/web/src/features/auth/hooks/use-account.ts:14-49`); the web client requests same-origin `/api/auth/me` (`apps/web/src/features/auth/api/auth-api.ts:276-278`). Express mounts the auth router at `/api/auth` (`apps/api/src/app.ts:110`); `GET /me` requires authentication and profile-read permission and returns a public user projection (`apps/api/src/features/auth/auth.controller.ts:76-84`). |
| Direct attendance persistence | None. Entry selection performs no read or write against attendance records. Destination pages have their own downstream dependencies and remain outside this page's test scope.                                                                                                                                                                                                                                                                       |

## Runtime behavior observed

1. The portal layout waits for the authenticated account. Before it is available, the shared layout renders “Loading your account…”; a session lookup failure renders its alert; an expired/invalid session is cleared and sent to the role-appropriate login route.
2. For an account that passes the portal route policy, `AttendanceEntryPage` initially renders `<p role="status">Opening attendance…</p>`.
3. Its effect calls `router.replace` with one of two fixed paths. `canAccessPersonalAttendance` is true only for active STAFF or ADMIN accounts, so they go to `/attendance/check-ins`. Other route-eligible accounts go to `/attendance/time-logs/overview`.
4. The route policy separately allows active STAFF and ADMIN, and active SUPERADMIN only when they have `employees:read`. The portal layout sends a denied USER to `/dashboard`, and other denied roles to `/module`.

| Account at route check                     | `/attendance` gate                    | Entry destination / result                    |
| ------------------------------------------ | ------------------------------------- | --------------------------------------------- |
| Active STAFF                               | Allowed                               | `/attendance/check-ins`                       |
| Active ADMIN                               | Allowed                               | `/attendance/check-ins`                       |
| Active SUPERADMIN with `employees:read`    | Allowed                               | `/attendance/time-logs/overview`              |
| Active SUPERADMIN without `employees:read` | Denied by portal layout               | `/module`; entry component does not render    |
| Active USER                                | Denied by portal layout               | `/dashboard`; entry component does not render |
| Inactive STAFF, ADMIN, or SUPERADMIN       | Denied by portal layout               | `/module`; entry component does not render    |
| No valid session                           | Account lookup revokes/clears session | `/login`; entry component does not render     |

The personal destination does not require department-head status or an employee-management permission. The management destination check relies on the portal route gate and the entry component's false personal-access result. No field validation, editable input, attendance mutation, file action, page-level list state, or pagination is present on PG-003.

## Phase 1 reconciliation and contract

- The approved mapping calls PG-003 entry behavior “redirects based on query/attendance navigation state” (`PHASE_1_PAGE_COMPONENT_MAPPING.md:24`). Current source reads neither search parameters nor attendance-navigation state; it selects the target solely from `canAccessPersonalAttendance(account)` and uses hard-coded paths. The broad Phase 1 functionality row (`PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:9`) is consistent with an entry redirect but does not define query semantics.
- The Phase 1 API dependency inventory groups PG-003–PG-015 together (`PHASE_1_PAGE_API_DEPENDENCIES.md:11`). That grouping lists attendance and leave clients for the domain range, but it does not establish a direct API call on PG-003. Current page source has none.
- **Contract C001 — query/navigation state:** clarify whether any approved query parameter or navigation state is intended to change or preserve the destination. Until its name, values, precedence, and expected behavior are specified, no acceptance assertion should be written for query-driven routing. See the case specification and gaps document.

## Scope boundaries

This record covers the route entry, shared portal access gate as it applies to this route, the accessible pending status, and its two route decisions. It does not test or redefine the content or API behavior of PG-006 `/attendance/check-ins` or PG-014 `/attendance/time-logs/overview`, other attendance routes, attendance policy, leave/correction workflows, or their persistence contracts. No test was executed and no application/test source was changed in this phase.

## Evidence anchors

- Approved route: `docs/qa/page-verification/PHASE_1_COMPLETE_ROUTE_INVENTORY.md:13`.
- Approved component map: `docs/qa/page-verification/PHASE_1_PAGE_COMPONENT_MAPPING.md:24`.
- Approved functionality and grouped dependencies: `PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:9`; `PHASE_1_PAGE_API_DEPENDENCIES.md:11`.
- Route access: `apps/web/src/features/workspaces/model/route-policy.ts:352-394,444-448`; predicates in `apps/web/src/features/auth/model/permissions.ts:92-124`.
- Layout/account loading: `apps/web/src/components/layout/portal-layout.tsx:21-91`; `apps/web/src/features/auth/hooks/use-account.ts:14-76`.
- Entry effect: `apps/web/src/features/attendance/pages/attendance-entry-page.tsx:1-17`.
