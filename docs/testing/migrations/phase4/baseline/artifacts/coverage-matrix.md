# Coverage matrix for all 18 official pages

Counts are non-exclusive targeted route memberships. Shared redirects and incidental setup/reference pages are excluded. Cross-page workflows count for each targeted route. Link-only destinations are preserved as assertions but do not count as route exercise. Native shared auth asset coverage is assigned to login/register. Counts include optional live cases; they are not 292 disjoint page totals. M = mocked application API; F = frontend/server/security fixture; L = optional live backend, skipped in this run.

| Route | Cases M/F/L | Source files |
|---|---:|---|
| `/login` | 37 (20/12/5) | [auth-performance.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts), [auth-styles.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts), [jwt-session.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts), [login-validation.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts), [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts) |
| `/register` | 13 (7/6/0) | [auth-performance.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts), [auth-styles.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts) |
| `/dashboard` | 29 (23/1/5) | [auth-styles.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts), [jwt-session.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts), [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts), [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts), [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/accounts` | 20 (14/2/4) | [admin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts), [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts), [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts), [superadmin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts) |
| `/clients` | 19 (14/1/4) | [admin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts), [client-mutations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts), [clients.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts), [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts), [responsive-data-table.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/employees` | 20 (15/1/4) | [admin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts), [departments.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts), [employee-login.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts), [employees.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts), [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts), [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/departments` | 15 (10/1/4) | [admin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts), [departments.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts), [dropdown-positioning.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts), [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts), [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts) |
| `/services` | 46 (41/1/4) | [admin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts), [client.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts), [clients.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts), [dropdown-positioning.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts), [pricing-templates.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts), [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts), [services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts), [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts) |
| `/service-requests` | 10 (10/0/0) | [client-service-requests.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/request-inbox` | 20 (20/0/0) | [operational-loading.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts), [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts), [request-inbox.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/booked-services` | 11 (11/0/0) | [booked-services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/messages` | 90 (90/0/0) | [internal-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts), [messages-topbar.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts), [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts), [request-workflow.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts) |
| `/projects/[id]` | 6 (6/0/0) | [project-pages-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts), [project-workspace.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts) |
| `/project-workspace` | 6 (6/0/0) | [operational-loading.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts), [project-pages-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/project-workspace/[id]` | 4 (4/0/0) | [project-pages-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) |
| `/staff-workload` | 9 (9/0/0) | [operational-loading.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts), [portal-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts), [staff-workload.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts) |
| `/profile` | 4 (4/0/0) | [profile.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts) |
| `/settings` | 14 (14/0/0) | [portal-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts), [profile.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts), [session-revocation.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts), [settings.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts) |

## /login

Original test IDs: PW-011, PW-013, PW-014, PW-015, PW-016, PW-017, PW-018, PW-019, PW-021, PW-087, PW-088, PW-089, PW-090, PW-124, PW-125, PW-126, PW-127, PW-128, PW-129, PW-130, PW-131, PW-132, PW-133, PW-135, PW-136, PW-137, PW-142, PW-144, PW-146, PW-147, PW-151, PW-152, PW-153, PW-154, PW-155, PW-156, PW-157.

- Positive: Successful mocked login, loader/toast, session storage, refresh, logout, localization, SSR, font/image loading and CSP.
- Negative: Invalid/blank/overlong input, repeated submit, invalid credentials, 503 retry, invalid/expired/revoked sessions; URL query injection does not prefill credentials.
- Validation/assertions: Detailed login email/password boundaries and focus/ARIA; duplicate requests held and counted.
- Authorization: Guest redirect and all-role session restoration. Five live-account cases exist but were skipped.
- Gaps/limits: Real JWT/session/login authorization remains unverified in this browser run. Live suite needs a verified isolated API and designated accounts.

Evidence: [login-validation.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts:4), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:19), [auth-performance.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts:4), [jwt-session.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts:85).

## /register

Original test IDs: PW-012, PW-015, PW-020, PW-143, PW-144, PW-148, PW-149, PW-150, PW-151, PW-152, PW-153, PW-154, PW-155.

- Positive: Exact registration payload, mocked success into USER dashboard, session tokens; language persistence, styles, font preload, server HTML.
- Negative: Duplicate email and invalid form remain on page; authenticated roles redirect without auth mutations; removed social controls absent.
- Validation/assertions: One invalid-form case fills several invalid values but directly checks only the name error and retained route. It does not independently assert each field error or zero submission count.
- Authorization: All four authenticated-role redirects; no real account registration run.
- Gaps/limits: Independent contact/email/password/confirmation validation assertions and real isolated registration persistence are not established by existing browser tests.

Evidence: [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:470), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:493), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:522), [auth-styles.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts:4).

## /dashboard

Original test IDs: PW-021, PW-087, PW-124, PW-125, PW-126, PW-127, PW-128, PW-130, PW-131, PW-132, PW-133, PW-138, PW-139, PW-145, PW-146, PW-150, PW-152, PW-153, PW-154, PW-155, PW-158, PW-162, PW-163, PW-269, PW-270, PW-271, PW-272, PW-281, PW-282.

- Positive: All-role layout/nav restoration, authenticated session refresh, USER registration landing, topbar-to-messages and workspace navigation.
- Negative: Anonymous/invalid/expired sessions redirect; role-based links and deep-link decisions asserted.
- Validation/assertions: Session/permission state assertions; no dashboard form validation scenario identified.
- Authorization: Four role fixture expansions; live login/dashboard cases skipped.
- Gaps/limits: No dedicated comprehensive dashboard content/component suite; actual server data and live role enforcement unverified.

Evidence: [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:14), [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:58), [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:716), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:115).

## /accounts

Original test IDs: PW-001, PW-002, PW-124, PW-125, PW-126, PW-127, PW-141, PW-145, PW-269, PW-270, PW-271, PW-272, PW-273, PW-274, PW-275, PW-276, PW-277, PW-278, PW-279, PW-280.

- Positive: Search preview, role change, deactivate/reactivate, password reset, Trash, restore and permanent deletion.
- Negative: Self role/status actions unavailable; password validation/failure recovery; restore failure/retry and confirmation; withheld permission/session failure; guest/non-SUPERADMIN denial.
- Validation/assertions: Password form/payload and confirmation checks; exact mutation and input retention assertions.
- Authorization: SUPERADMIN fixture, all-role navigation, withheld permission and optional live direct-read authorization.
- Gaps/limits: No complete browser account-creation scenario identified. Actual account mutations are mocked; optional live cases only read/login/logout.

Evidence: [superadmin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:73), [superadmin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:197), [superadmin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts:280), [admin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts:16).

## /clients

Original test IDs: PW-009, PW-010, PW-031, PW-032, PW-053, PW-054, PW-055, PW-056, PW-059, PW-062, PW-124, PW-125, PW-126, PW-127, PW-145, PW-249, PW-250, PW-283, PW-288.

- Positive: Admin create, validation and conflict retry; read-only detail tabs, empty related records; search/sort/filter/states/accessibility and responsive rows.
- Negative: Cancel preserves input; no Edit/More actions or PATCH/DELETE; other roles/withheld permission/session failure blocked.
- Validation/assertions: Required fields, malformed email, focus/accessible error and 409 retention; read-only fields remain protected by UI assertions.
- Authorization: ADMIN allowed; SUPERADMIN/STAFF/USER denied in browser fixtures. API rejection tests are separate Node integration tests.
- Gaps/limits: Populated related-record journeys and real persistence are not established by these browser fixtures. Editing/deletion are intentionally unsupported and are NOT missing coverage.

Evidence: [client-mutations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:5), [clients.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:14), [responsive-data-table.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts:113), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:273).

## /employees

Original test IDs: PW-005, PW-006, PW-063, PW-071, PW-072, PW-073, PW-074, PW-075, PW-076, PW-124, PW-125, PW-126, PW-127, PW-145, PW-269, PW-270, PW-271, PW-272, PW-284, PW-289.

- Positive: Search/motion, row-menu exclusivity, employee profile/login controls, password reset and account retirement preserving HR records.
- Negative: Retired employment-status action absent; confirmation/validation and guarded access for other roles/session failure.
- Validation/assertions: Employee/login dialogs and payload checks are preserved; exact form assertions in baseline.
- Authorization: ADMIN fixture and all-role navigation guard expansions; optional live direct reads skipped.
- Gaps/limits: Real transactional employee/account writes and complete independent field-boundary coverage are not proven by browser mocks.

Evidence: [employee-login.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts:5), [employees.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:14), [employees.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts:155), [departments.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:13).

## /departments

Original test IDs: PW-003, PW-004, PW-064, PW-065, PW-067, PW-069, PW-124, PW-125, PW-126, PW-127, PW-145, PW-269, PW-270, PW-271, PW-272.

- Positive: Department create/edit/delete and member-management entry; scrolling preset dialog geometry.
- Negative: Team creation authorization error leaves team absent; non-Admin UI, missing read permission and failed session guarded.
- Validation/assertions: Department form and confirmations asserted; team error recovery asserted.
- Authorization: Admin management UI; browser roles and optional live API reads distinguish UI guard from broader department read access.
- Gaps/limits: Successful team creation/member reassignment and real department persistence are not established by the inspected browser scenarios.

Evidence: [departments.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:36), [departments.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:116), [dropdown-positioning.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts:81), [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts:14).

## /services

Original test IDs: PW-007, PW-008, PW-041, PW-042, PW-043, PW-044, PW-045, PW-046, PW-047, PW-048, PW-049, PW-050, PW-051, PW-052, PW-057, PW-058, PW-060, PW-061, PW-066, PW-068, PW-070, PW-106, PW-107, PW-108, PW-109, PW-124, PW-125, PW-126, PW-127, PW-134, PW-140, PW-145, PW-251, PW-252, PW-253, PW-254, PW-255, PW-256, PW-257, PW-258, PW-259, PW-260, PW-269, PW-270, PW-271, PW-272.

- Positive: Admin create/edit/deactivate/delete; consultation, recurring pricing, packages and pricing templates; USER package cards/catalog, submission, receipt and retry workflows.
- Negative: Read-only permission hides mutations; XSS markup rendered as text; 403/500 recovery; required department and rejected edits; submission retries reuse reference/payload.
- Validation/assertions: Pricing/package wizard validation, department required, retry/cancel payload preservation; desktop/mobile geometry.
- Authorization: Admin manage, USER catalog, STAFF/SUPERADMIN guard paths; synthetic read-only ADMIN permission fixtures are not custom production roles.
- Gaps/limits: Actual backend catalog mutations/request persistence and full live booking journey remain unverified.

Evidence: [services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:15), [services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts:395), [pricing-templates.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts:58), [client.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts:94), [clients.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:59).

## /service-requests

Original test IDs: PW-033, PW-034, PW-035, PW-036, PW-037, PW-038, PW-039, PW-040, PW-287, PW-292.

- Positive: History summaries, statuses, filters/search/pagination/details; explicit refresh and reconnect/no-poll behavior; search preview.
- Negative: List failure/retry, first-request empty state; ADMIN/STAFF/SUPERADMIN denied without client API reads.
- Validation/assertions: Query/filter/detail behavior; creation forms are exercised on /services, not this history route.
- Authorization: USER fixture; explicit negative role expansions.
- Gaps/limits: Real ownership scoping and database-backed history transitions are not browser-verified.

Evidence: [client-service-requests.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:76), [client-service-requests.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:231), [client-service-requests.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts:280), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:273).

## /request-inbox

Original test IDs: PW-096, PW-099, PW-168, PW-169, PW-205, PW-206, PW-207, PW-208, PW-209, PW-210, PW-211, PW-212, PW-213, PW-214, PW-215, PW-216, PW-217, PW-218, PW-286, PW-291.

- Positive: Head review/accept, statuses/filter/sort/search/pagination, detail drawer, pending controls, exact-request chat; skeleton and search preview.
- Negative: Failed delete cancellation/retry preserves booking; list/detail/accept failures and competing acceptance; role/head denial.
- Validation/assertions: Mutation method, bearer header, no duplicate actions and failure-state preservation.
- Authorization: STAFF with mocked head assignment for positive cases; explicit non-head STAFF and head-flag ADMIN/SUPERADMIN/USER denial.
- Gaps/limits: Successful decline/delete: BLOCKED BY UNDEFINED APPLICATION CONTRACT. No decline-control interaction test. Existing failed-delete and recovery coverage must be preserved.

Evidence: [request-inbox.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:399), [request-inbox.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:450), [request-inbox.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:618), [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:812).

## /booked-services

Original test IDs: PW-022, PW-023, PW-024, PW-025, PW-026, PW-027, PW-028, PW-029, PW-030, PW-285, PW-290.

- Positive: List browse/filter/paginate, details and focus return, deep link, status refresh/reconnect, skeleton and search preview.
- Negative: List/detail failure retry; ADMIN/STAFF/SUPERADMIN denied with zero list/detail requests.
- Validation/assertions: Filters, selected booking and query/deep-link alignment; no creation form belongs to this route.
- Authorization: USER allowed; internal roles blocked using mocked sessions.
- Gaps/limits: Real ownership/persistence and live bookings read scope are not verified by browser run.

Evidence: [booked-services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:210), [booked-services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:409), [booked-services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts:484), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:273).

## /messages

Original test IDs: PW-077, PW-078, PW-079, PW-080, PW-081, PW-082, PW-083, PW-084, PW-085, PW-086, PW-091, PW-092, PW-093, PW-094, PW-159, PW-160, PW-161, PW-162, PW-163, PW-164, PW-165, PW-166, PW-167, PW-168, PW-169, PW-170, PW-171, PW-172, PW-173, PW-174, PW-175, PW-176, PW-177, PW-178, PW-179, PW-180, PW-181, PW-182, PW-183, PW-184, PW-185, PW-186, PW-187, PW-188, PW-189, PW-190, PW-191, PW-192, PW-193, PW-194, PW-195, PW-196, PW-197, PW-198, PW-199, PW-200, PW-201, PW-202, PW-203, PW-204, PW-219, PW-220, PW-221, PW-222, PW-223, PW-224, PW-225, PW-226, PW-227, PW-228, PW-229, PW-230, PW-231, PW-232, PW-233, PW-234, PW-235, PW-236, PW-237, PW-238, PW-239, PW-240, PW-241, PW-242, PW-243, PW-244, PW-245, PW-246, PW-247, PW-248.

- Positive: Internal/client chats, unread badges, exact conversations, send/edit/delete, reconnect/history/polling, head handoff, shared booking context, meetings, quotation, documents, payment and activation workflows.
- Negative: Failed send/edit/create and retry IDs; revocation; empty/error inbox; recipient unavailable; ended/no current bookings; cancel/required-reason/expired-quotation controls.
- Validation/assertions: Quotation amounts/date/time and multi-step retention; five-attachment limit; required details/payment reason; exact action/version/UUID and upload replay payloads.
- Authorization: USER and internal role fixtures; workflow capabilities/head/client scopes simulated. STAFF head database assignment not proven by fixture capability booleans.
- Gaps/limits: Real application SSE/concurrent persistence/auth/upload/payment processing unverified. Local SSE server tests transport only. Legacy archive UI block is inactive history, not runnable or missing current-contract coverage.

Evidence: [internal-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts:144), [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:19), [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:812), [request-workflow.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:292), [messages-topbar.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts:7).

## /projects/[id]

Original test IDs: PW-115, PW-118, PW-120, PW-121, PW-122, PW-123.

- Positive: Client milestone display/conversation href; assigned STAFF complete/reopen and failure retry; failed load then reload.
- Negative: USER mutation control absent; failed milestone preserves progress; failed detail hides heading.
- Validation/assertions: PATCH method/bearer and repeated completed payload; progress counts.
- Authorization: USER read-only and STAFF contributor fixture; no comprehensive direct unauthorized-role matrix.
- Gaps/limits: Real project ownership and milestone persistence; 403/404 scope cases not established. project-workspace.spec.ts targets this route despite filename.

Evidence: [project-workspace.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:69), [project-workspace.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts:94), [project-pages-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:98).

## /project-workspace

Original test IDs: PW-097, PW-100, PW-114, PW-117, PW-281, PW-282.

- Positive: STAFF list, archive/active separation, search/filter/sort/row transitions, skeleton and navigation.
- Negative: No-match/archive empty rows; noncreator New project control absent.
- Validation/assertions: Search clearing/status filters and viewport behavior; no creation-form validation test.
- Authorization: STAFF fixtures; absence of create permission; full denied-role matrix not found.
- Gaps/limits: Existing create/template/rename/cancel UI flows lack direct Playwright mutation coverage. Workflow activation tests on /messages do not verify these flows.

Evidence: [project-pages-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:22), [operational-loading.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts:92), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:115).

## /project-workspace/[id]

Original test IDs: PW-116, PW-119, PW-281, PW-282.

- Positive: Detail failure/reload recovery; Overview/Deliverables/Team/Activity sections; work/team/deliverable table transitions and search.
- Negative: Failed load hides heading; nonmanager status action absent; empty sections asserted.
- Validation/assertions: Read/search/section assertions only; no task/plan/deliverable mutation validation baseline.
- Authorization: STAFF nonmanager fixtures; full role/ownership matrix not found.
- Gaps/limits: Existing plan/task editing, project status and deliverable upload/remove/review/send workflows lack direct Playwright mutation coverage.

Evidence: [project-pages-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts:98), [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts:115).

## /staff-workload

Original test IDs: PW-095, PW-098, PW-101, PW-102, PW-103, PW-104, PW-105, PW-267, PW-268.

- Positive: Head capacity, allocation/reassign/remove including former staff, Monday week/reload, calendar, utilization and accessible charts, mobile layout/skeleton.
- Negative: Time off exceeds capacity, invalid fields, unavailable/former candidates; nonheads and other roles denied.
- Validation/assertions: Payloads/hours/date bounds, ARIA errors/focus, numerical summaries and no NaN.
- Authorization: STAFF head fixture positive; all-role nonhead portal negatives.
- Gaps/limits: Title containing real allocation state still uses page.route mocks. Actual workload scope, persistence/concurrency and database head revocation need separate API/live evidence.

Evidence: [staff-workload.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:5), [staff-workload.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts:487), [portal-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:13), [portal-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:44).

## /profile

Original test IDs: PW-110, PW-111, PW-112, PW-113.

- Positive: All-role details, image selection/cancel/partial-failure retry, banner/avatar persistence in mock state; STAFF specialist projects; mobile layout and Settings handoff.
- Negative: Readonly email, no upload before Save, partial upload failure; non-STAFF specialist controls absent; password mismatch after Settings handoff.
- Validation/assertions: Image content type/payload and staged writes; personal detail update and password mismatch.
- Authorization: Four role expansions; specialist control conditioned by role fixture.
- Gaps/limits: Actual object storage/profile writes and independent basic-details API failure/boundary coverage remain unverified.

Evidence: [profile.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:5).

## /settings

Original test IDs: PW-101, PW-102, PW-103, PW-104, PW-110, PW-111, PW-112, PW-113, PW-261, PW-262, PW-263, PW-264, PW-265, PW-266.

- Positive: All-role notification/preference/time-zone persistence on reload; session metadata, revoke session, password update and logout choice; mobile layout.
- Negative: Password mismatch prevents write, cancel retains session, two-context revocation and transient check failures.
- Validation/assertions: Password confirmation, preference data, session/token state and time rendering.
- Authorization: Four role expansions; two-context USER mocked sessions.
- Gaps/limits: Real session revocation/password/preferences persistence not verified in browser; live suite does not exercise Settings.

Evidence: [settings.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts:4), [session-revocation.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:119), [portal-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts:13), [profile.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts:5).

## Existing workspace mutation implementation behind identified gaps

[apps/web/src/features/project-workspace/pages/new-workspace-page.tsx:159](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/project-workspace/pages/new-workspace-page.tsx:159) calls creation; [apps/web/src/features/project-workspace/components/workspace-list-row-actions.tsx:45](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/project-workspace/components/workspace-list-row-actions.tsx:45) calls rename/cancel; [apps/web/src/features/project-workspace/pages/workspace-detail-page.tsx:52](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/project-workspace/pages/workspace-detail-page.tsx:52) calls plan/status updates; [apps/web/src/features/project-workspace/components/task-row-actions.tsx:65](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/project-workspace/components/task-row-actions.tsx:65) saves plans; [apps/web/src/features/project-workspace/components/workspace-deliverables.tsx:756](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/project-workspace/components/workspace-deliverables.tsx:756) handles deliverable mutation flows. API client validation and endpoints: [apps/web/src/features/project-workspace/api/project-workspace-api.ts:167](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/project-workspace/api/project-workspace-api.ts:167). The existing browser inventory has no matching direct mutation flow; /messages activation and /projects milestone checks remain separate coverage.
