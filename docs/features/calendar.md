# Role-aware calendar

Developed: 2026-11-10

All portal roles use `/calendar` and the same month grid, selected-day events, upcoming list, event colors, and compact cards. The shared page lives under `features/calendar`, reusing the existing Calendar, page header, Button, and Select components. The desktop calendar/cards split remains 75%/25%; smaller screens stack the cards below the calendar.

## Visibility

- Clients retain their own consultations, service meetings, and explicitly shared deliverables. They do not receive internal tasks or organization filters.
- Staff default to **My schedule**: assigned dated tasks, shared deliverables on assigned projects, and consultations/service meetings belonging to departments they currently head. The current meeting model has no arbitrary staff invitations, so ordinary project membership does not grant access to booking meetings.
- Current department heads, project team leads, and team leads also have **My team**. Heads see their department's project tasks; project leads see tasks on projects they lead. Team leads see tasks in their already-accessible assigned projects involving their team. This does not grant access to unrelated workspaces.
- Admin and Superadmin see organization event metadata, with department, staff, project, and event-type filters. Overview access does not grant workspace or conversation access. Links and meeting URLs are returned only when the user already has the corresponding workflow access; staff-only workspace links are omitted for administrators.

`GET /api/projects/calendar` keeps the client array response. Internal accounts receive `{ events, canViewTeam, organization }`. Staff may request `scope=mine` (default) or `scope=team`; the service checks current role, active status, head assignment, and project membership. Unauthorized team scope returns `403`; invalid scope returns `400`. The sidebar and portal route guard allow the calendar for all four roles.

## Event sources and status

The calendar aggregates existing records without a new event table or migration:

- Workflow consultations and conversation meetings, excluding cancelled records.
- Project work-plan tasks with a due date, interpreted in Philippine time. Tasks without dates are omitted.
- Deliverables at their existing `sentToClientAt` timestamp. Deliverables currently have no separate due-date field, so these are sharing events rather than invented deadlines.

Completion badges come from record status. Unfinished tasks become **Overdue** only after their Philippine due date. Passing an appointment's scheduled time does not mark it completed. Cancelled projects are excluded from the internal calendar.

The internal summary reports overdue tasks and upcoming overlapping appointments sharing a staff assignee. The organization summary also counts upcoming consultations without a department head. These indicators help planning but do not prevent scheduling or change workflow permissions. Selecting an accessible event opens its existing workflow; scheduling and rescheduling stay in those workflows. The page refreshes on visibility/focus changes and provides retry after load errors.

## Verification

- `pnpm --filter @nexus/api test:calendar`: offline PGlite coverage for scope, current head changes, assignment boundaries, admin read-only metadata, client isolation, and unauthenticated access.
- `pnpm --filter @nexus/web test`: includes Philippine-midnight deadline and shared-assignee conflict checks.
- `pnpm --filter @nexus/web test:e2e calendar.spec.ts --workers=2`: all four roles at desktop/mobile widths, scope changes, filtering, and existing workflow links.
