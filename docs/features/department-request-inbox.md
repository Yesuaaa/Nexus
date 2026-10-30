# Department head request inbox

Developed: 2026-10-30

The **Request Inbox** (`/request-inbox`) lets current department heads review and accept clients' booked services. It follows the existing directory layout, with search, ten requests per page, oldest-first ordering, and a responsive booking details panel. The default view shows bookings awaiting acceptance; the **Under review** view shows accepted bookings.

## Access and routing

Only an active, undeleted `STAFF` account currently assigned to `Department.headId` can use the page or its API. Ordinary staff, team leads, clients, Admins, and Superadmins have no access. Department membership and role permissions alone do not grant access. Authentication responses include `headOf` for navigation; API authorization independently checks the current database assignment on every request.

Requests appear when their service is linked to a department headed by the signed-in user. Services linked to several departments appear for each relevant head. Acceptance changes the booking's shared status once, so only one head can accept it. This feature does not create department ownership records, projects, or specialist assignments. Services without a linked department have no inbox destination; Admins configure the service's departments through Service Management.

Existing temporary head handoffs use the current `Department.headId`, so the outgoing head loses access and the assigned temporary head gains access on their next API request. Navigation updates when account information reloads.

## API and acceptance

- `GET /api/request-inbox` supports `search`, `page`, and `view=pending|under-review`. Search matches service, package, reference, client name, or email. The response includes the department, requests, scoped total, page, and page size. Repeated or malformed supported filters return `400`.
- `GET /api/request-inbox/:id` returns submitted booking requirements and the client's name, email, and contact number. Unknown and out-of-department references both return `404`.
- `POST /api/request-inbox/:id/accept` accepts no editable booking fields. It conditionally moves `PENDING` or `SUBMITTED` to `UNDER_REVIEW` in a transaction. The update checks department routing and head assignment again. Duplicate acceptance, competing acceptance, and other existing statuses return `409`; an out-of-department reference returns `404`.

The client sees **Under review** in their existing Booked Services page. Acceptance does not confirm prices, dates, or specialist availability. Safe response projections exclude credentials, submission keys, and internal pricing fields.

## Database deployment

Apply migration `20261030153000_department_request_inbox` before using acceptance:

```sh
pnpm --filter @nexus/api exec prisma migrate deploy
```

It only adds the `UNDER_REVIEW` enum label using `IF NOT EXISTS`. Earlier normalized databases already have this label, so the migration succeeds on those deployments too. Existing status defaults and bookings are preserved. Inbox filtering supports both the original `PENDING` and normalized `SUBMITTED` initial statuses without querying enum labels absent from the database.

## Verification

PGlite API tests cover role and current-head checks, department isolation, safe fields, head handoffs, deactivated accounts, search, stable pagination, simultaneous and duplicate acceptance, terminal statuses, client-visible updates, and both database enum families. Mocked browser tests cover desktop and phone review/acceptance, filters, pagination, failure retries, stale booking conflicts, and unauthorized navigation. Client booking browser tests also verify the shared details panel still works.
