# PG-007 Atomic Feature Inventory

**Page:** PG-007, `/attendance/overview`  
**Inventory source:** current page, shared attendance components, route policy, API client, Express attendance management/reporting, and Prisma models. No tests were executed for this discovery.

## A001 - Personal route and navigation access

- **Trigger / handler:** Select Attendance → Overview, or navigate directly to `/attendance/overview`. Sidebar links are constructed from `attendanceNavigation` and filtered by route policy; the portal layout enforces denial.
- **State / input:** Current account role and `isActive`; this page has no local access override.
- **Backend dependency:** None until the page calls the API. Route access does not prove API access.
- **Authorization:** `canAccessPersonalAttendance` permits active STAFF/ADMIN only. USER and SUPERADMIN are excluded on the exact overview route.
- **Data model:** Auth account/session only.
- **Success behavior:** STAFF/ADMIN render Attendance Overview and expose the Attendance self-service navigation group.
- **Failure behavior:** Denied paths are replaced with `/dashboard` for USER and `/module` for other denied roles. `PortalLayout` renders no page content while redirecting.
- **Evidence:** `navigation.ts:1-17`; `route-policy.ts:353-385,743-755`; `permissions.ts:111-116`; `portal-layout.tsx:23-34,59-64`.

## A002 - Default range and initial resource load

- **Trigger / handler:** Page mount initializes `range` with `defaultRange()` and calls `useAsyncResource` for `personalAttendanceOverview`.
- **State / input:** From is UTC date serialization of now minus 30 days; Through is UTC date serialization of now plus one day. Request key is the two date strings; request is enabled only when both are nonempty.
- **Backend dependency:** `GET /api/attendance/me/overview?from=…&to=…`.
- **Authorization:** Page route requires active STAFF/ADMIN; API independently authenticates and resolves the personal employee.
- **Data model:** API `AttendanceOverview` contains check-in counts, time summary, scope, recorded/leave days, status counts, and recent activity.
- **Success behavior:** Loading figures use an `aria-busy` state and section skeletons; a successful response populates the overview.
- **Failure behavior:** The async hook exposes an error and Retry; page-specific fallback content is described under A010.
- **Evidence:** `attendance.ts:103-109`; `attendance-overview-page.tsx:29-44,89-103`; `use-async-resource.ts:25-81`; `attendance-api.ts:120-143,469-477`.

## A003 - Date range controls and query changes

- **Trigger / handler:** Change “Attendance from date” or “Attendance through date”; `RangeFields` calls `setRange`.
- **State / input:** From input uses `max={to}`; Through uses `min={from}`. The page sends only `from` and `to` as query values. No page number or other filter is maintained.
- **Backend dependency:** `parseAttendanceHistory` validates date-only strings and ordering; reporting filters date-valued workdays and approved leave days inclusively.
- **Authorization:** Always personal scope, derived from the authenticated user; no department/employee filter is accepted.
- **Data model:** `AttendanceWorkday.workDate` and `LeaveRequestDay.workDate` are PostgreSQL `DATE`; timestamps are not used as date-filter keys.
- **Success behavior:** With two populated values, each state change creates a request keyed to that range; changing filters aborts the previous request and ignores its late completion.
- **Failure/ambiguity:** Clearing either value disables the request and does not clear the hook's last successful `data`; product intent for blank dates is not specified. See C001 in the gaps report.
- **Evidence:** `attendance-shared.tsx:89-118`; `attendance-overview-page.tsx:30-39,80-84`; `use-async-resource.ts:25-81`; `attendance.schema.ts:44-77`; `attendance.reporting.ts:23-46`.

## A004 - Refresh and pending-action state

- **Trigger / handler:** Click Refresh; the button calls `result.retry`.
- **State / input:** Retry increments the resource revision for the current date range. The button is disabled while `result.loading` is true.
- **Backend dependency:** Repeats the same personal overview GET; no write occurs.
- **Authorization:** Same page/API boundary as A001/A011.
- **Data model:** No new persistence or mutation.
- **Success behavior:** Current data reloads and the loading state ends after response.
- **Failure behavior:** Resource error remains visible with Retry. The request can be retried again.
- **Evidence:** `attendance-overview-page.tsx:52-75`; `use-async-resource.ts:29-57,73-81`; `attendance-shared.tsx:14-40`.

## A005 - Summary figures

- **Trigger / handler:** No separate trigger; the figures render from the current `AttendanceOverview` resource.
- **State / input:** `recordedDays`, `checkIns.total`, `checkIns.closed`, `checkIns.working`, and `checkIns.onBreak`.
- **Backend dependency:** `management.overview` derives counts from report days and sessions.
- **Authorization:** The API response is personal-scope only for this page.
- **Data model:** Recorded attendance workdays, work sessions, breaks, and leave-merged report days.
- **Success behavior:** Attendance days = `recordedDays`; Check-ins = total sessions; Check-outs = closed sessions with `round(closed / total × 100)` note; Still clocked in = `working + onBreak`.
- **Failure behavior:** When the request errors, all four values use an em dash. For a successful empty response, numeric counts display as zero.
- **Evidence:** `attendance-overview-page.tsx:40-50,92-115`; `attendance.management.ts:685-742`; `attendance.reporting.ts:158-173`.

## A006 - Session status breakdown and proportional bars

- **Trigger / handler:** Rendered under “Check-in status” after the overview GET.
- **State / input:** `checkIns.total`, `closed`, `working`, `onBreak`, and the API's `suspended` count.
- **Backend dependency:** Backend classifies unfinished sessions as suspended or open; open unpaid-break sessions are separated from working sessions.
- **Authorization:** Personal endpoint.
- **Data model:** `AttendanceWorkSession` and `AttendanceBreak` state.
- **Success behavior:** For nonzero total, the UI renders three rows: Clocked in (`working`), On unpaid break (`onBreak`), Clocked out (`closed`); each row shows a count, a rounded share of total, and an `InlineBar` accessible label.
- **Failure/ambiguity:** No Suspended row is rendered although `suspended` is returned. Whether suspended sessions should appear in this breakdown or the “Still clocked in” figure is not established by a product contract; see C002.
- **Evidence:** `attendance-overview-page.tsx:118-168`; `attendance.management.ts:694-741`; `overview-panel.tsx:249-293`.

## A007 - Personal attendance summary fields

- **Trigger / handler:** Rendered in the Personal attendance section from selected range and response data.
- **State / input:** Range strings, `recordedDays`, `checkIns.total`, `approvedLeaveDays`, and `asOf`.
- **Backend dependency:** `management.overview` returns scope, recorded days, approved leave counts/hours, and timestamp.
- **Authorization:** Personal scope from session user; no organization/department totals should appear.
- **Data model:** Workdays and merged approved `LeaveRequestDay` records.
- **Success behavior:** Shows Reporting scope “Personal”, date range, sessions per recorded day to one decimal (em dash if there are no recorded days), approved leave days, and last refreshed formatted explicitly in UTC.
- **Failure behavior:** Unavailable calculations use an em dash; date controls still show the current selection.
- **Evidence:** `attendance-overview-page.tsx:172-215`; `attendance.management.ts:716-761`; `attendance.reporting.ts:23-105`.

## A008 - Recent check-in activity

- **Trigger / handler:** Rendered from `checkIns.recentActivity`; page maps each event action to user-facing text.
- **State / input:** Event ID, action, timestamp, and employee name. Page preserves API order.
- **Backend dependency:** API constructs events from recorded workday sessions and breaks, orders descending by timestamp with ID tie-break, and returns at most eight.
- **Authorization:** Personal report filter must exclude other employees; backend obtains the employee from the session.
- **Data model:** `AttendanceWorkSession`, `AttendanceBreak`, and `Employee.fullName`.
- **Success behavior:** Clock-in/out and break start/end use source-defined labels; event timestamps render in UTC with employee name.
- **Failure behavior:** No events produces “No check-in activity in this period.” A request error produces “Recent activity unavailable.”
- **Evidence:** `attendance-overview-page.tsx:219-253`; `attendance.management.ts:705-735`; `attendance.reporting.ts:56-66`.

## A009 - Empty period state

- **Trigger / handler:** Successful response has `checkIns.total === 0`.
- **State / input:** Zero recorded days/session counts; empty recent activity.
- **Backend dependency:** Personal overview returns a valid zero-valued response.
- **Authorization:** Same personal scope as A011.
- **Data model:** No matching recorded workday or session; approved leave rows can still affect personal attendance fields independently.
- **Success behavior:** Figure counts display zero; status table is replaced with “No check-ins in this period.”; activity is replaced with “No check-in activity in this period.”; sessions per day is an em dash when `recordedDays` is zero.
- **Failure behavior:** Distinct from a failed request; no Retry alert appears for a successful empty result.
- **Evidence:** `attendance-overview-page.tsx:40-50,118-124,219-230`.

## A010 - Loading, error, and retry recovery

- **Trigger / handler:** Delayed or rejected GET; Retry calls the async resource revision update.
- **State / input:** `loading`, `error`, retained prior hook data, retry revision.
- **Backend dependency:** API response/error converted by `apiRequest` and `errorMessage`.
- **Authorization:** API errors can include 401/403/409/400 or transient server failures; page presents a generic fallback when the response lacks a usable message.
- **Data model:** Read-only.
- **Success behavior:** Loading skeletons appear; retry may recover and repopulate figures/sections.
- **Failure behavior:** Error alert presents “Couldn't load check-in summaries.” when fallback applies; four figures are unavailable, Check-in status and recent activity have separate unavailable text, and Retry remains available.
- **Evidence:** `attendance-overview-page.tsx:31-39,86-90,92-103,118-124,219-230`; `attendance-shared.tsx:14-40`; `use-async-resource.ts:25-81`.

## A011 - Authentication, role checks, and employee ownership

- **Trigger / handler:** Browser route request and personal GET.
- **State / input:** Session account, active/deleted state, role, and linked Employee.
- **Backend dependency:** Express `requireAuth`, `actor`, `selfEmployee`, then personal overview management.
- **Authorization:** STAFF and ADMIN only on the personal API; anonymous is rejected by authentication; USER/SUPERADMIN are denied by `selfEmployee`. An active allowed role without an Employee link receives 409.
- **Data model:** `User` → `Employee.userId`; report data is scoped to that employee.
- **Success behavior:** Response has `scope: PERSONAL`; its session/event data belongs only to the authenticated employee.
- **Failure behavior:** 401 unauthenticated, 403 disallowed role/inactive/deleted, 409 allowed role without an Employee profile, 400 for query override attempts.
- **Evidence:** `routes.ts:10-11,159-161`; `attendance.service.ts:25-57`; `attendance.management.ts:643-676`; `permissions.ts:111-116`.

## A012 - Range validation and report aggregation

- **Trigger / handler:** GET request with `from`/`to` values or absent bounds.
- **State / input:** Date-only `YYYY-MM-DD`; API defaults missing bounds from its injected server clock; max accepted inclusive range is 366 calendar dates; page does not send page/department/employee parameters.
- **Backend dependency:** `parseAttendanceHistory`, report-day SQL, Prisma transaction.
- **Authorization:** Personal employee predicate is applied before workdays and approved leave days are joined.
- **Data model:** `AttendanceWorkday`, `LeaveRequestDay`/`LeaveRequest`, `AttendanceWorkSession`, `AttendanceBreak`, assignment/policy, employee.
- **Success behavior:** Workdays and approved leave dates merge by employee/workDate; one employee's report counts only that employee; summaries derive statuses and leave totals from the merged report days.
- **Failure behavior:** Invalid date format/calendar date, reversed range, range wider than 366 inclusive days, unknown query keys, or unsupported personal scope override return validation errors; more than 10,000 report rows returns a 400 narrowing request (not expected for an ordinary single-employee 366-day window).
- **Evidence:** `attendance.schema.ts:44-77`; `attendance.management.ts:638-761`; `attendance.reporting.ts:19-105,158-173`; `attendance.summary.ts:20-137`.

## A013 - Responsive and accessible presentation

- **Trigger / handler:** Render page at narrow, tablet, and desktop viewport sizes; use semantic headings, figures, status image labels, date labels, and link/button controls.
- **State / input:** Viewport width; loading state on figure row; selected date strings.
- **Backend dependency:** None for layout except data response needed for populated state.
- **Authorization:** Same route policy.
- **Data model:** None beyond rendered API data.
- **Success behavior:** No horizontal overflow is asserted by existing tests at 390/820/1440 px; named figures expose `aria-busy`, inline bars expose role `img` and labels, page sections are semantic.
- **Failure behavior:** Layout errors should be reported at the tested widths; no design requirement for unsupported controls is inferred.
- **Evidence:** `attendance-overview-page.tsx:92-168,172-253`; `overview-panel.tsx:249-293`; `attendance.spec.ts:1398-1458`.

## Not present on this page

Current source does not provide a search box, sortable table, pagination, employee/department selector, detail panel, correction/approval dialog, policy mutation, clock operation, or other data mutation. These are **NOT APPLICABLE** to PG-007 and should not generate speculative tests.
