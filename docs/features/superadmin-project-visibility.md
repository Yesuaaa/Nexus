# Superadmin project visibility (Phase 3A.1)

Developed: 2026-11-14

Follow-up, 2026-11-15: [test regression recovery](testing-regression-recovery.md) resolves the Client-milestone assertion mentioned below without exposing internal milestones to Clients.

The subsequent [Phase 3A.2 management phase](superadmin-project-management.md) enables only request-linked workspace renaming, with backend authorization and actor attribution. Other inspection and operational boundaries remain unchanged.

Project Management's administrative entry at `/module/project-management` now lists all projects across departments, including planned, active, held, completed, cancelled, and standalone projects. Search, status and responsible-department filters use paginated server queries. `?project=<id>` opens an inspection view and survives reload.

The separate GET endpoints `/api/administrative-projects` and `/api/administrative-projects/:id` require both Phase 2A module access and organization-wide read capabilities against the current authenticated account. Admin, Staff and Client gain no new access. Existing operational endpoints and membership/ownership rules are unchanged.

Responses use explicit field selection and sanitized work-plan JSON. They include project status, basic client identity, department, workspace group metadata, phases/tasks, milestones and assigned employee names/positions/statuses. Credentials, private conversations, workflow events, payment/quotation records, file contents and download links are excluded. Responses explicitly deny management, approval, release, file download and participation capabilities. No assignments or records are created by reads.

The UI reuses the existing workspace table, task overview, search, filters and pagination patterns. Read-only rendering is opt-in on shared components, leaving Staff behavior unchanged. No edit, upload, approval, release, staffing or operational controls are mounted in the administrative view.

Tests cover cross-department inspection without membership, unchanged Staff/Client scoping, ordinary-role denial, live role changes, denied mutation methods, filtering and private-field exclusion. Browser tests cover list/detail inspection, reload, absence of operational controls and denied reads.

Administrative mutations, approvals, file access, private conversations, Diagnostics and System Logs remain outside this phase. The previously identified workflow test that assumes Client-visible internal milestones remains a separate pre-existing failure.
