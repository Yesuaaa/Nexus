# PG-001 Atomic Feature Inventory

**Page:** `PG-001`, route `/`  
**Parent cluster:** `PG-001-F001` — “Enter the application; route according to token presence.”  
**Source baseline:** commit `552b0cd65d814aa82cf2e6a9d666d82864fad230`  
**Related Phase 1 records:** [route inventory](../../PHASE_1_COMPLETE_ROUTE_INVENTORY.md), [functionality inventory](../../PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md), [component map](../../PHASE_1_PAGE_COMPONENT_MAPPING.md), and [authorization matrix](../../PHASE_1_PAGE_AUTHORIZATION_MATRIX.md).

## Inventory summary

Three atomic behaviors were identified from the existing implementation. No new application behavior is inferred. `HomeRedirect` has one mount effect, two truthiness outcomes, and uses history replacement for both destinations.

## `PG-001-F001-A001` — Anonymous/falsy-token redirect

| Discovery field            | Source-backed behavior                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature name               | Resolve absent or falsy token as anonymous                                                                                                              |
| UI element or trigger      | Initial client mount of `/`; there is no user control                                                                                                   |
| Component and handler      | `HomeRedirect`; `useEffect` in `home-redirect.tsx:7-12` calls `getToken()`                                                                              |
| State changes              | No React state change. `getToken()` returns `null` for absent storage value or when storage access throws; an empty string is also falsy at the branch. |
| Validation rules           | No user-input validation. Branch condition is JavaScript truthiness.                                                                                    |
| API dependencies           | None in `HomeRedirect`; `getToken()` reads `sessionStorage` only.                                                                                       |
| Expected result            | `router.replace("/login")`                                                                                                                              |
| Error states               | A thrown storage access/read error is caught in `getToken()` and treated as `null`. No root-specific error UI is rendered.                              |
| Authorization requirements | Root is public. No role, permission, ownership, or account status check occurs here.                                                                    |
| Proposed cases             | `PG-001-F001-A001-T001` through `T003`                                                                                                                  |
| Evidence                   | `apps/web/src/features/auth/components/home-redirect.tsx:10-14`; `apps/web/src/features/auth/api/auth-api.ts:31-37`; `apps/web/src/app/page.tsx:3-5`    |

## `PG-001-F001-A002` — Truthy-token redirect and portal handoff

| Discovery field            | Source-backed behavior                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature name               | Resolve a truthy token as present and enter the portal handoff                                                                                                                   |
| UI element or trigger      | Initial client mount of `/`; there is no user control                                                                                                                            |
| Component and handler      | `HomeRedirect`; the same effect tests the `getToken()` return value                                                                                                              |
| State changes              | No React state change in the root component; the route changes to `/dashboard`. Portal account state is downstream.                                                              |
| Validation rules           | No token syntax, expiry, account, or role validation in `HomeRedirect`; any truthy string selects the same target.                                                               |
| API dependencies           | None directly. After handoff, `PortalLayout`/`useAccount` call `getCurrentAccount()` (`GET /api/auth/me`); expired access may call `/api/auth/refresh`.                          |
| Expected result            | `router.replace("/dashboard")`. A `USER` can remain at `/dashboard`; an internal role is redirected by `PortalLayout` to `/module` after account resolution.                     |
| Error states               | A downstream 401 revokes the session and routes to the role’s login path. A non-401 account-load error is shown by `PortalLayout`; this is downstream, not a root error handler. |
| Authorization requirements | No root role gate. Portal route policy and backend endpoint authorization remain separate checks.                                                                                |
| Proposed cases             | `PG-001-F001-A002-T004` through `T007`, plus refresh handoff `T009`                                                                                                              |
| Evidence                   | `home-redirect.tsx:10-12`; `auth-api.ts:163-199,276-278`; `use-account.ts:22-64`; `portal-layout.tsx:21-33,52-65`                                                                |

## `PG-001-F001-A003` — History entry replacement

| Discovery field            | Source-backed behavior                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feature name               | Replace the root history entry on redirect                                                                                                                   |
| UI element or trigger      | Initial client mount and either token outcome                                                                                                                |
| Component and handler      | `HomeRedirect` effect calls Next.js `router.replace()` rather than `router.push()`                                                                           |
| State changes              | Browser/Next navigation history is updated by replacement; component state is unchanged.                                                                     |
| Validation rules           | None.                                                                                                                                                        |
| API dependencies           | None.                                                                                                                                                        |
| Expected result            | After navigating from an earlier page to `/` and redirecting, Back should return to the earlier page rather than revisit `/` as an additional history entry. |
| Error states               | No source-specific navigation error handling.                                                                                                                |
| Authorization requirements | None.                                                                                                                                                        |
| Proposed cases             | `PG-001-F001-A003-T008`                                                                                                                                      |
| Evidence                   | `apps/web/src/features/auth/components/home-redirect.tsx:10-12`                                                                                              |

## Explicitly not discovered

There is no root form, interactive control, input validator, direct feature API call, database model, root-specific authorization matrix, query-driven return destination, or retry UI. Do not add cases for these as if they were implemented requirements. Whitespace-only token treatment remains an unresolved contract question; see [edge-case matrix](PG-001_EDGE_CASE_MATRIX.md) and [gaps](PG-001_GAPS_AND_DEPENDENCIES.md).
