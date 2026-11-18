# Project Management logs

An active Superadmin with administrative module access and organization-wide read access can open **System Tool → Project Logs** from the Project Management sidebar at `/module/project-management/logs`. The read-only API is `GET /api/project-management-logs`. The viewer uses the shared audit-log table and details panel.

| Area                 | Recorded success events                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Workspaces           | Setup, Staff or Superadmin rename, cancellation, hold, resume, completion, and project team-lead assignment/removal    |
| Plans and milestones | Plan edits, task creation/status, milestone completion/reopening                                                       |
| Deliverables         | Metadata edits, attachment submission/replacement/removal, Department Head approval/rejection, sharing with the Client |
| Client activity      | Brief edits, change/cancellation request submissions and decisions, Client deliverable decisions                       |

Entries include the authenticated actor snapshot, time, project and workspace IDs, affected record, safe field changes, and the server-assigned correlation ID. Grouped workspace actions retain one row per affected project with the same HTTP correlation ID. An unchanged business value or a recognized request replay adds no success entry. Workspace completion also retains the Service Operations request conclusion under the same correlation ID. Service Operations continues to record its workflow and workload mutations at their existing entry points.

Success entries share the business transaction and roll back with it. Unexpected HTTP 5xx errors handled by the API for Project Management routes are recorded separately where possible. These entries contain a static endpoint template, HTTP status, a safe diagnostic, the correlation ID, and the actor when known. A response error can happen after a mutation committed. Check the same correlation ID for a success entry. If incident persistence is unavailable, the API emits a safe diagnostic to server output.

The history covers the project workspace, operational project, administrative project, and Project Management overview API routes. Successful reads, redirects, routine client errors, and conversation activity are outside the event catalog. The viewer has access to attachment presence and supported MIME types. Attachment IDs, filenames, content, briefs, descriptions, notes, raw URLs, request bodies, credential data, and stack traces are excluded. Approved identity and target labels are bounded.

The reader uses rolling 30-day expiry and pages of 25 with newest events first. The API supports date, action/event, area, outcome, actor, project, workspace, target, service request, and correlation ID filters as well as text search. Background cleanup runs at API startup and hourly. Deployment requires the additive `20261118120000_project_management_logs` migration. History begins when the writers are deployed.
