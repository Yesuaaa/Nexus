# Client booked services

Developed: 2026-10-30

Clients can open **Booked Services** (`/booked-services`) from the sidebar to view their submitted services. The page lists service, request reference, package, status, submission date, and expected timeline. Search, status filters, and pagination support finding older bookings.

**View booking** opens a details panel with the submitted project goals, requirements, additional details, and preferred specialist. The booking confirmation also links directly to this panel. The requested timeline and specialist preference remain subject to review; submitting a request does not confirm an assignment or start date.

## Access and data

- `GET /api/service-requests` lists only the authenticated client's requests, with 10 records per page and stable newest-first ordering. It supports `search`, `status`, and `page`.
- `GET /api/service-requests/:id` returns only an owned request. Another client's request returns the same `404` as an unknown request.
- Both reads and the existing `POST /api/service-requests` require an active authenticated `USER`. Internal roles cannot access these client endpoints.
- Responses select the booking fields explicitly and exclude account details, submission keys, internal workflow data, and pricing details.

The existing four-step Services flow still collects the service, package, requirements, and optional preferred specialist. Submission remains atomic and protected against duplicate retries.

Submission uses the database's existing status default: `PENDING` on databases created from this checkout's migrations or `SUBMITTED` on deployments with the earlier status normalization. Both status families remain readable. No new database migration is needed.

Department heads can accept a booking through the [Request Inbox](department-request-inbox.md). Accepted bookings display **Under review** here. That separate feature adds a safe enum migration for databases that do not yet have `UNDER_REVIEW`.

## Verification

Offline PGlite API tests cover ownership, role restrictions, safe responses, query validation, filtering, pagination, and submission compatibility. Mocked browser tests cover desktop and mobile list/detail views, filters, retry states, and client-only navigation.
