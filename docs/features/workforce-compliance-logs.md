# Workforce Logs

An active Superadmin with administrative module access and organization-wide read access opens **System Tool → Workforce Logs** in Workforce Compliance. The page is `/module/attendance-monitoring/logs` and its read API is `GET /api/workforce-compliance-logs`. Attendance managers continue using **Audit Trail** at `/attendance/audit` with their existing scope.

The viewer combines the existing attendance audit and leave decision histories, including time logs and breaks, policies and assignments, corrections, overtime, and leave. Search covers approved names, action and area codes, and record, actor, operation, and correlation IDs. Action and area filters match individual changes and return the complete operation within the date window. Results sort by recorded event time and a stable identifier in pages of 25. The toolbar offers Last 30 days, Last 7 days, and Last 24 hours. These windows filter the viewer. Source records keep their existing retention rules. The API also accepts an explicit time range of up to 366 days.

New writes record an operation ID and, for authenticated HTTP requests, the server correlation ID and actor role in the same business transaction. For example, a clock-out and the overtime it automatically submits share an operation. Older rows without grouping metadata appear individually. Older actor roles can be unavailable. Current actor and employee names are labeled accordingly.

The **What happened** column identifies clock-ins, clock-outs, break starts and ends, policy assignments, and request decisions. It calls out overtime submitted during the same operation and weekly schedule changes when recorded.

The API projects approved values such as statuses, attendance times, schedule settings, and assignment dates. Policy name changes appear as field names. Free-text reasons and review notes, leave types and dates, original session snapshots, private contact fields, request keys, and raw data are excluded from the response and search. API incidents are outside this viewer's scope.

Deploy the additive `20261120120000_workforce_compliance_log_context` migration before the application update. The existing audit and leave history protection triggers remain in effect.
