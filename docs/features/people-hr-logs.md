# People & HR Logs

Active Superadmins with administrative module access and organization-wide read access can open **System Tool → People & HR Logs** in the People & HR workspace. The read-only endpoint is `GET /api/people-hr-logs`, and the viewer is at `/module/people-hr/logs`.

Each row represents one recorded management operation by an Admin or Superadmin. Rows with multiple changes show the count. The drawer groups changes by affected employee, Staff login, department, or team and shows each action and its recorded values. The reader uses existing `WorkforceManagementChange` entries with employee, department, or team origins and `AccountManagementChange` entries with the employee origin. Account and Client Management activity, Workforce Compliance activity such as leave, and API incidents are outside this catalog.

The viewer uses the shared audit toolbar with search, action, area, and date controls. Search accepts names and IDs. The API accepts `from`, `to`, `source`, `event`, `actorId`, `subjectId`, `operationId`, `search`, and `page`. A match on an individual change returns its operation with all People & HR changes in that operation. Results are paginated by operation, newest first, and the viewer defaults to the last 30 days.

The viewer displays the recorded actor role and IDs. Actor and record display names come from current records, with IDs still available when a name or record is gone. Personal profile edits show field names. Approved statuses, assignments, and login lifecycle values can show before and after values. Credentials, prior personal values, and raw change payloads are excluded. The displayed operation ID groups database history. HTTP correlation IDs are unavailable for this history.

The **What happened** column names the affected record when its display name is available. Profile and membership edits list the recorded fields, and HR status or login changes show the resulting status when the history captured it.
