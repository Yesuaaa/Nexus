# Workforce Logs

An active Superadmin with administrative module access and organization-wide read access opens **System Tool → Workforce Logs** in Workforce Compliance. The page is `/module/attendance-monitoring/logs` and its read API is `GET /api/workforce-compliance-logs`. Attendance managers continue using **Audit Trail** at `/attendance/audit` with their existing scope.

The viewer combines the existing attendance audit and leave decision histories, including time logs and breaks, policies and assignments, corrections, overtime, and leave. Search covers approved names, action and area codes, and record, actor, operation, and correlation IDs. Action and area filters match individual changes and return the complete operation within the date window. Results sort by recorded event time and a stable identifier in pages of 25. The toolbar offers Last 30 days, Last 7 days, and Last 24 hours. These windows filter the viewer. Source records keep their existing retention rules. The API also accepts an explicit time range of up to 366 days.

Area searches are case-insensitive. Both the display term `Time Logs` and the exact area code `time-logs` match time-log effects. An exact code search can be combined with the existing structured filters.

The first load establishes an exclusive time cutoff and an opaque `snapshot` token. Send both the returned `asOf` and `snapshot` with the same filters on subsequent pages. The token is bound to the authenticated session. Text searches keep the matching group IDs in their original order for that window. Display names come from current accounts and employee records, so a name displayed in an earlier search can reflect a subsequent rename. **Refresh logs** or a filter change starts a new window on page one. The optional `range` values `24h` and `7d` calculate the start of the window relative to its end when no explicit `from` is supplied.

Each API process keeps up to 64 windows for ten minutes and evicts the oldest when full. An expired, unavailable, or mismatched token returns 409. The viewer can start a new window from page one. A malformed token or a token without `asOf` returns 400. Text searches that match over 10,000 operation groups return 422 and ask the caller to narrow the search. Unsearched lists retain their existing paging limits.

New writes record an operation ID and, for authenticated HTTP requests, the server correlation ID and actor role in the same business transaction. For example, a clock-out and the overtime it automatically submits share an operation. Older rows without grouping metadata appear individually. Older actor roles can be unavailable. Current actor and employee names are labeled accordingly.

When an authenticated department placement change affects pending or verified attendance requests, Workforce Logs shows the department ID change and any verification resets under the same management operation and HTTP correlation ID. A move of pending requests can show a placement effect by itself. Direct database moves use the attendance audit's database fallback for resets.

The **What happened** column identifies clock-ins, clock-outs, open-session suspensions, manager reconciliations, break starts and ends, policy assignments, and request decisions. Suspension details include the recorded suspension time. Session close details include the recorded end time. The viewer uses recorded session transitions and actor context to distinguish manager reconciliation from a clock-out. Older closes with insufficient evidence appear as an ended attendance session. Overtime submitted during the same operation and recorded weekly schedule changes remain visible.

The API projects approved values such as statuses, attendance times, schedule settings, and assignment dates. Policy name changes appear as field names. Free-text reasons and review notes, leave types and dates, original session snapshots, private contact fields, request keys, and raw data are excluded from the response and search. API incidents are outside this viewer's scope.

Deploy the additive `20261120120000_workforce_compliance_log_context` migration before the application update. The existing audit and leave history protection triggers remain in effect.

Deploy `20261122130000_attendance_transfer_attribution` for the attendance review placement effect.
