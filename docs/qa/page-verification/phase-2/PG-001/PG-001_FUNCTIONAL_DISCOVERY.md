# PG-001 Functional Discovery

**Status:** Source inspection and test design only; no tests were implemented or run.  
**Repository baseline:** `293-test-full-system-audit-for-verifying-recent-changes`, `552b0cd65d814aa82cf2e6a9d666d82864fad230`  
**Phase 1 identity:** Preserved as `PG-001`; the original behavior cluster remains `PG-001-F001`.

## Page identity

| Field                      | Verified value                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page ID                    | `PG-001`                                                                                                                                                       |
| Route                      | `/`                                                                                                                                                            |
| Module                     | Entry / authentication                                                                                                                                         |
| Route source               | [`apps/web/src/app/page.tsx`](../../../../../apps/web/src/app/page.tsx)                                                                                        |
| Primary component          | `HomeRedirect` in [`apps/web/src/features/auth/components/home-redirect.tsx`](../../../../../apps/web/src/features/auth/components/home-redirect.tsx)          |
| Root layout                | [`apps/web/src/app/layout.tsx`](../../../../../apps/web/src/app/layout.tsx), which wraps children in `AuthProvider`                                            |
| Route-specific UI          | None; `HomeRedirect` renders `null` while its client effect runs                                                                                               |
| Portal layout              | [`apps/web/src/app/(portal)/layout.tsx`](../../../../../apps/web/src/app/%28portal%29/layout.tsx), entered after the authenticated branch selects `/dashboard` |
| Authentication requirement | Root is public. It branches on whether `getToken()` returns a truthy value; it does not validate a token or require an account before navigation.              |
| Authorization requirement  | None in `HomeRedirect`. Role and route policy are resolved later by `PortalLayout` after `/dashboard` loads.                                                   |

## Verified behavior

`page.tsx` returns `HomeRedirect`. On mount, `HomeRedirect` calls `getToken()` and invokes `router.replace("/dashboard")` for a truthy result or `router.replace("/login")` otherwise. It has no page state, controls, forms, data validation, or direct API call. `getToken()` reads `sessionStorage` key `nexus.auth.token`; it catches storage access errors and returns `null`.

The root decision treats any non-empty string as present, including a whitespace-only or expired token. That only selects `/dashboard`; it is not evidence that the session is valid. The subsequent portal flow calls `/api/auth/me`, may refresh an expired access token, and can clear a rejected session. `PortalLayout` also sends non-`USER` accounts away from the legacy `/dashboard` route to `/module`. These are downstream handoff behaviors, not role logic in PG-001.

## Atomic feature map

The broad Phase 1 cluster `PG-001-F001` is decomposed into three independently observable behaviors:

| Atomic feature ID  | Behavior                                            | Primary trigger and handler                             | Main result                                                                                |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PG-001-F001-A001` | Resolve absent or falsy token as anonymous          | Initial mount; `HomeRedirect` effect calls `getToken()` | Replace the current route with `/login`                                                    |
| `PG-001-F001-A002` | Resolve a truthy stored token as present            | Initial mount; `HomeRedirect` effect calls `getToken()` | Replace the current route with `/dashboard`; validity and role resolution occur downstream |
| `PG-001-F001-A003` | Replace the current history entry for either branch | Same effect; `useRouter().replace()`                    | The root entry is replaced by the selected destination                                     |

The atomic inventory records state, validation, API, errors, access rules, and source references for each behavior in [PG-001_ATOMIC_FEATURE_INVENTORY.md](PG-001_ATOMIC_FEATURE_INVENTORY.md).

## Scope boundaries

- No user-entered input exists on this route, so required-field, format, length, and input-boundary validation do not apply.
- The root component performs no API request and reads no database data. It does not directly mutate browser storage.
- `sessionStorage` read failure is handled by `getToken()` as `null`, so the source path is the anonymous redirect. That helper behavior is separately testable without a browser.
- Authentication validity, refresh, current account, and role-based destinations are downstream concerns. Proposed end-to-end cases that start at `/` label those assertions as handoff coverage.
- Root-specific keyboard and responsive interaction checks do not apply because this route has no rendered controls or page content.
- The intended treatment of whitespace-only token values is not stated in a product contract. Current code treats them as truthy; keep that expected outcome marked `CONTRACT CLARIFICATION REQUIRED` rather than making it a permanent acceptance rule.

## Phase 1 records and audit

These source-approved records are the baseline for this Phase 2.1 pass:

- [Complete route inventory](../../PHASE_1_COMPLETE_ROUTE_INVENTORY.md)
- [Page component mapping](../../PHASE_1_PAGE_COMPONENT_MAPPING.md)
- [Page functionality inventory](../../PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md)
- [Page API dependencies](../../PHASE_1_PAGE_API_DEPENDENCIES.md)
- [Page authorization matrix](../../PHASE_1_PAGE_AUTHORIZATION_MATRIX.md)
- [Existing test coverage](../../PHASE_1_EXISTING_TEST_COVERAGE.md)
- [Phase 2 test planning baseline](../../PHASE_2_TEST_PLANNING_BASELINE.md)
- [Findings and limitations](../../PHASE_1_FINDINGS_AND_LIMITATIONS.md)
- [Page structure report](../../PHASE_1_PAGE_STRUCTURE_REPORT.md)
- [Consolidated master system audit](../../../../full-audit/CONVERYN_Complete_System_Audit_Report_2026-11-23.md)

Phase 1 classified the token-presence redirect as source-verified but runtime-unverified and coverage as partial. This pass confirms direct existing anonymous-route assertions, while the token-present branch, storage failure, and history replacement remain uncovered at `/`.

## Source evidence

- `apps/web/src/app/page.tsx:1-5` — root page renders `HomeRedirect`.
- `apps/web/src/features/auth/components/home-redirect.tsx:1-17` — client effect and the two fixed `router.replace` destinations; component returns `null`.
- `apps/web/src/features/auth/api/auth-api.ts:8-9,31-37` — session token key and guarded `sessionStorage` read.
- `apps/web/src/app/layout.tsx:30-36` — root `AuthProvider` wrapper.
- `apps/web/src/app/(portal)/layout.tsx:5-7` — portal layout wrapper.
- `apps/web/src/components/layout/portal-layout.tsx:21-33,52-65` — current-account loading boundary, route denial, and internal dashboard handoff.
- `apps/web/src/features/auth/hooks/use-account.ts:22-29,30-64` — downstream session revocation and account-load error behavior.
- `apps/web/src/features/auth/api/auth-api.ts:163-199,276-278` — authenticated request, expired-token refresh handling, and `/api/auth/me` client call.
