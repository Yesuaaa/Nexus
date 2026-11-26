# PG-008 Gaps and Dependencies

## Status

PG-008 discovery and test design is complete for source-supported behavior. One business contract case is blocked from implementation until clarified. All existing execution status is UNVERIFIED in this phase because no tests were run.

## Coverage gaps

1. No direct browser matrix was found for canonical /attendance/policies/management access across allowed, denied, and inactive accounts. Existing navigation-helper tests are partial; the backend policy read matrix is separate.
2. Existing loading tests do not assert the exact initial page=1, size=10, status=active query. Initial list error/retry is not found.
3. Policy directory search by name/timezone, page reset, no-match copy, 100-character query boundary, and stale response ordering are not directly asserted.
4. No policy directory test crosses the 10-row pagination boundary or asserts the API's createdAt/id order.
5. Row tests assert names and some schedule/hour data, but not all visible row values, including timezone and assignment count.
6. PG-008 has no keyboard assertion for its RowActionsMenu use. The shared component is associated with confirmed PG-004-D-001 and PG-006 T018; this is a regression risk, not a newly confirmed PG-008 defect.
7. Existing policy create/edit tests do not comprehensively cover invalid trimmed name, 100/101 character boundaries, timezone bounds, all day-minute API boundaries, or form mutation error recovery.
8. Current edit browser test asserts timezone value, but not readOnly state for an assigned policy. API-side assigned-timezone rejection already has direct coverage.
9. Employee selection and partial retry are directly tested with mocks, but the employee and policy-choice loader retry states are not. Mock coverage does not establish database persistence.
10. Assignment details have API/browser coverage for one current row and current/scheduled actions. Multi-page and all-status projection, plus detail loader retry/stale response handling, remain partial.
11. No PG-008-specific PostgreSQL concurrency test was found for simultaneous assignment changes on one employee. PGlite persistence coverage does not prove PostgreSQL row-lock behavior.

## Contract clarification C001 — all-rest policy

The creation form starts with seven unchecked weekdays and permits submission. The API validator requires seven unique weekdays and zero required minutes on rest days but does not require any working day. An existing E2E workflow creates and assigns a policy without selecting working days. The policy directory copy says a policy and assignment enable clock-in, which does not explain the meaning of a policy with no working days.

Do not add an accept/reject product assertion for all-rest configurations until an authoritative requirement resolves whether they are intentionally supported. Preserve the existing compatibility test as written while awaiting clarification. Exclude PG-008-F001-A012-T003 from implementable totals.

Evidence: attendance-policy-panel.tsx:77-93,127-167; attendance.validation.ts:75-145; attendance-settings-page.tsx:277; attendance.spec.ts:1021-1059.

## Source-defined tier differences

- Policy name UI required constraint does not trim whitespace; API text parser trims and rejects blank values. Test the server contract and actual surfaced error without claiming native UI validation is equivalent.
- UI timezone input accepts a free-form string up to maxLength 100; server verifies an exact recognized timezone name and the database timezone list.
- UI fixed break max is 1438; server requires integer minute values and a break shorter than the shift, with maximum 1440. The resulting shift duration further constrains accepted values.
- Edit hides timezone mutation with readOnly when assignment count is nonzero, while API independently returns conflict.
- Assignment page makes the effective date required in UI; API also validates format and policy-timezone date minimum.

These are observable implementation contracts; they do not justify changing either tier during discovery.

## Shared component and browser reliability

- PG-008 imports shared RowActionsMenu. PG-004-D-001 remains a confirmed keyboard-operated row-action menu defect. PG-006 T018 reproduced it. Test PG-008 in its own route context if Phase 2.2 is authorized; do not reassign earlier defect ownership without PG-008-specific reproduction.
- PG-006 T024 remains an intermittent result at 820px. It concerns the earlier page and is not evidence that PG-008 fails. The broad attendance browser spec is serial; retain the current setup and record any new failure with viewport/repeat details.
- attendance-policy-assignment.spec.ts deliberately skips in live mode because it relies on a scoped mock API. Keep the skip; run the mocked case in the offline mode intended by that spec.
- No tests were executed in this phase. All execution reliability and pass/fail statements from prior page reports remain untouched.

## Authorization and data isolation

- Frontend route policy requires an active privileged account with employees:manage. The Attendance API applies requireAuth and its own managementScope checks. Both boundaries need separate evidence.
- Policy CRUD and assignment mutation are global for authorized managers; PG-008 page does not show a department filter. Do not invent department filtering or narrower behavior.
- Employee selector loads all pages through the attendance employee endpoint without passing departmentId. The backend remains responsible for its own scope. Test direct unauthorized calls; do not infer this from the picker hiding.
- API/PGlite tests should use synthetic users and employees. Mocked Playwright is not database, authentication, authorization, or persistence evidence.

## Dependencies and implementation readiness

- Separate authorization is required before Phase 2.2 implementation or test execution.
- Use existing PGlite support, browser fixture, fixed clock, and route mocks; no schema changes or production refactoring are currently required.
- The proposed concurrency test needs a disposable local PostgreSQL environment and an explicit opt-in path. The standard API test glob does not include *.postgres.ts files.
- Product clarification C001 affects only the all-rest case; the other 34 case records are implementable from current source and existing test contracts.
- Before implementation, confirm the current test scripts and focused Playwright selection syntax from package scripts; report actual commands and exit codes then.
- Preserve PG-001 through PG-007 ledger findings exactly as recorded. In particular, PG-006 remains verification-partial; PG-004-D-001 remains confirmed; PG-007 remains complete for source-supported scope with C001/C002 open.
