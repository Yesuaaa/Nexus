# Department head request inbox

Developed: 2026-10-30

The **Request Inbox** (`/request-inbox`) lets current department heads review and accept clients' booked services. It follows the existing directory layout, with search, ten requests per page, oldest-first ordering, and a responsive booking details panel. The default view shows bookings awaiting acceptance; the **Under review** view shows accepted bookings.

## Access and routing

Only an active, undeleted `STAFF` account currently assigned to `Department.headId` can use the page or its API. Ordinary staff, team leads, clients, Admins, and Superadmins have no access. Department membership and role permissions alone do not grant access. Authentication responses include `headOf` for navigation; API authorization independently checks the current database assignment on every request.

Requests appear when their service is linked to a department headed by the signed-in user, or the request was accepted by that department. Services linked to several departments appear for each relevant head. Acceptance changes the booking's shared status once and records its accepting department, account and time, so only one head can accept it. It opens [private request messaging](request-messaging.md) between the client and that department's current head. Other linked heads can review the booking but cannot read its messages. No projects or specialist assignments are created. Services without a linked department have no initial inbox destination; Admins configure the service's departments through Service Management.

Existing temporary head handoffs use the current `Department.headId`, so the outgoing head loses access and the assigned temporary head gains access on their next API request. Navigation updates when account information reloads.

## API and acceptance

- `GET /api/request-inbox` supports `search`, `page`, and `view=pending|under-review`. Search matches service, package, reference, client name, or email. The response includes the department, requests, scoped total, page, and page size. Repeated or malformed supported filters return `400`.
- `GET /api/request-inbox/:id` returns submitted booking requirements and the client's name, email, and contact number. Unknown and out-of-department references both return `404`.
- `POST /api/request-inbox/:id/accept` accepts no editable booking fields. It conditionally moves `SUBMITTED` to `UNDER_REVIEW` and records acceptance in a transaction. For historical `UNDER_REVIEW` requests without an accepting department, **Start conversation** explicitly claims the conversation. The update checks department routing and head assignment again. Duplicate acceptance, competing acceptance, and other existing statuses return `409`; an out-of-department reference returns `404`.

The client sees **Under review** in their Service Requests page. Acceptance does not confirm prices, dates, or specialist availability. Safe response projections exclude credentials, submission keys, and internal pricing fields.

## Database deployment

Apply all pending migrations before using acceptance:

```sh
pnpm --filter @nexus/api exec prisma migrate deploy
```

The original inbox migration adds `UNDER_REVIEW` using `IF NOT EXISTS`. Migration `20261030215900_reconcile_inbox_request_statuses` reconciles that label with the client portal's lifecycle migration when both branches' migrations run together. It maps legacy statuses to `SUBMITTED`, `UNDER_REVIEW`, and `CLOSED`, preserving bookings, enum-based history columns, nulls, and defaults. Already normalized databases need no reconciliation. Existing migration files remain unchanged.

## Verification

PGlite API tests cover role and current-head checks, department isolation, safe fields, head handoffs, deactivated accounts, search, stable pagination, simultaneous and duplicate acceptance, terminal statuses, and client-visible updates. Migration tests verify both branches' combined history preserves records and defaults. Mocked browser tests cover desktop and phone review/acceptance, filters, pagination, failure retries, stale booking conflicts, and unauthorized navigation. Client booking browser tests also verify the shared details panel still works.
