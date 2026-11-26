# PG-013 Gaps and Dependencies

## Identity reconciliation

Approved PG-013 identity matches current source: /attendance/requests/overview, route wrapper apps/web/src/app/(portal)/attendance/requests/overview/page.tsx, and AttendanceRequestsOverviewPage. Phase 1 route inventory, component mapping, functionality inventory, and authorization matrix agree. No redirect alias or source remapping was found.

One documentation discrepancy exists: PHASE_1_EXISTING_TEST_COVERAGE.md:43 calls the PG-013 coverage indirect, but current committed WC-06-F01 and WC-06-F03 tests in attendance.spec.ts:6499-7071 assert the page directly. Recommend reconciling that row in a future permitted documentation pass. Do not alter Phase 1 reports during this task.

## Coverage gaps to implement in a future authorized Phase 2.2

1. Exact PG-013 route-policy assertions for active ADMIN and eligible SUPERADMIN with employees:read, plus inactive and unsupported-user denial.
2. Cross-page navigation assertions for the three static queue links. Assert the route targets only; selected-scope propagation is not currently a contract.
3. Leave API complete group projection and explicit required/invalid scope, unknown query, anonymous, USER, and unauthorized team cases.
4. Attendance API summary query allowlist, missing-scope personal default, anonymous/USER, and group-response field assertions.
5. A sparse nonempty summary with fixed zero-count statuses and rounded share percentages.
6. Explicit per-section empty copy and a reauthorization-followed-by-retry assertion after a real team denial.
7. Page-specific stale request behavior after unmount/revisit, keyboard use of the view toggle, and responsive presentation at supported widths.

The current test specification assigns these to stable cases and preserves the ten existing direct browser declarations. Existing page output assertions are source-backed; no missing contract is converted into a product requirement.

## Contract questions

### PG-013-C001 — Profileless ADMIN personal view

The frontend canAccessPersonalAttendance helper allows active ADMIN without an Employee profile. Attendance personal summary resolves the Employee and may return 409; Leave personal summary returns 403 when the profile is missing. The page maps 403 to a denial state, while 409 remains a retryable resource error. Product owners must decide whether the toggle should be available, what user-facing state is intended, and whether the two domain endpoints should recover consistently. Until clarified, PG-013-F001-A003-T005 remains contract-blocked. This does not change PG-006's separate historical profileless-ADMIN finding.

### PG-013-C002 — Selected scope on queue navigation

The three summary-card links are static and omit current scope. Target queues may use their own defaults or query controls. Product owners must clarify whether scope carries through. PG-013-F001-A007-T002 remains contract-blocked; assert destination paths only until resolved.

### Cross-endpoint snapshot consistency

Attendance and Leave summaries are separate requests and RepeatableRead transactions. No common timestamp/snapshot is present. A requirement for same-instant cross-domain totals is not established; do not make it an acceptance criterion without contract clarification.

## Security and data-scope boundary

- Frontend route access derives from attendance access/manager/personal permission helpers. UI visibility is not backend enforcement.
- Both routers require authentication. Attendance summary scope is resolved by the management service; Leave summary scope is separately resolved by Leave service.
- Attendance team filters use managementScope and ADMIN HR adjustment scope. Personal summary resolves current user's Employee.
- Leave mine resolves the actor's Employee. Staff team requires Head assignment. Management team requires employees:read; Admin submitted Leave rows use submittedLeaveFallbackScope.
- The route entry and API tests must separately check anonymous/USER, role, current department scope, and personal ownership where source permits.
- A SUPERADMIN can access organization Attendance/Leave team scope with required permission but cannot use personal Attendance adjustment summary through the current role rules. Do not infer personal-access support from the route gate.

## Shared-component risk review

PG-013 uses AttendanceShell, ManagementViewToggle, ResourceStatus, Section, FiguresRow, InlineBar, and RowsSkeleton. Verify visible names, keyboard operation, loading/error feedback, and responsive layout for these uses.

PG-013 does not use the shared row-action menu implicated in PG-004-D-001. No page-specific menu defect is assigned. The historic defect remains open.

The Playwright file is serial, uses a fixed local API fixture port, and includes prior-page scenarios. Those shared execution constraints merit single-worker focused verification and fixture-state isolation. PG-006's 820 px intermittency is a historical risk, not a PG-013 failure.

## Environment and database dependencies

- API and browser/API coverage use PGlite-backed isolated apps; no live database should be used.
- Browser page requests are intercepted and sent to a real Express fixture API. This covers browser-to-Express-to-PGlite but bypasses the production Next proxy.
- No write, transaction race, idempotency, or PostgreSQL-only behavior exists on this dashboard. Disposable PostgreSQL is not necessary.
- The browser helper runs the app with Chromium. The default Playwright webServer performs a web build and serves port 5273; E2E can be affected by stale generated route types or occupied fixture ports.
- No PG-013 test was run in this design phase. Test reliability remains unverified.

## Prior QA findings preserved

No prior finding was changed or closed in this discovery:

- PG-001 whitespace-only token remains contract-blocked.
- PG-002 create/edit/API validation differences and unauthorized list-response navigation remain documented.
- PG-003 query/navigation-state behavior remains contract-blocked.
- PG-004-D-001 shared keyboard row-action menu defect remains confirmed and open.
- PG-005 cleared-date and detail-panel filtering behavior remain contract-blocked.
- PG-006 implementation remains complete with verification partially complete; T018 reproduces the shared menu defect, T024 remains intermittent at 820 px, T025/C001 cleared-history date remains blocked, timezone basis remains unspecified, and profileless ADMIN receives HTTP 409 with limited UI recovery.
- PG-007 implementation/focused verification remains complete with cleared-date and suspended-session UI contracts deferred.
- PG-008 remains implementation complete with partially complete verification; shared-menu defect reproduced; separate assignment-concurrency case environment-blocked; 390 px fixture failure and seven non-working-days contract remain documented.
- PG-009 remains implementation and focused verification complete; report-scope/counter wording and canceled-assignment count contracts remain deferred; no page defect confirmed; PG-006 820 px intermittency was reproduced in related compatibility testing.
- PG-010 remains implementation complete with partially complete verification; 34/35 implementable records passed and T035 reproduced PG-004-D-001 at 390/820/1440; C001 remains deferred; T032 disposable PostgreSQL pass does not resolve PG-008's separate blocker.
- PG-011 remains implemented with partially complete verification; PG-004-D-001 reproduced; two transfer-workflow records remain intermittent; C001/C002 deferred; its PostgreSQL result does not resolve PG-008.
- PG-012 remains implementation complete with partially complete verification; preserve the latest report counts and outcomes: 37 unique case records, 35 implementable, 20 new declarations, 7 additive assertion groups, 8 existing-sufficient cases, 2 contract blockers, 33 passed, one shared-menu defect reproduction at 390/820/1440, and one environment-blocked PostgreSQL guard case. Do not resolve PG-008's separate concurrency blocker from PG-012's PostgreSQL infrastructure evidence.

## Phase 2.2 readiness

Source discovery is complete and the 35-record case specification reconciles to existing assertions, proposed additions, and two explicit blockers. PG-013 is ready for separately authorized Phase 2.2 implementation of its 33 implementable cases. The two contract cases must remain excluded until clarification. No PG-014 work is included.
