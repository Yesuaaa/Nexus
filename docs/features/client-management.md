# Client Management

The directory at `/clients` gives Admin and Superadmin accounts read-only access to registered clients. It follows Employee Management's layout with name/email search, Active/Inactive filtering, sorting and server pagination (20 records per page). The default order is newest registered first; an account ID tie-breaker keeps equal values ordered consistently. Narrow screens use stacked rows and a sort selector.

The eye action opens the client's details drawer. The row menu can open Service requests or Projects directly. The drawer loads current account details, displays related record counts in Overview, and provides working tabs with paginated records. It preserves directory filters, sorting and page, closes with Escape or its close button, and restores focus to the row action. On phones it fills the screen. Each read has loading, empty and retryable error states; superseded responses cannot overwrite a newer selection. The module has no create, edit or delete actions.

## Account fields

Clients are existing `User` records with `role = USER` and `accountDeletedAt = null`. There is no separate Client table. Inactive accounts remain visible. Staff/Admin/Superadmin accounts do not appear. The related-record tables are added by `20261027100000_client_related_records`.

| Directory field | Account field   | Missing value                 |
| --------------- | --------------- | ----------------------------- |
| Client name     | `fullName`      | Name not provided             |
| Email address   | `email`         | Required by account schema    |
| Contact number  | `contactNumber` | Not provided                  |
| Account status  | `isActive`      | Active or Inactive            |
| Date registered | `createdAt`     | Displayed in Asia/Manila time |

The response contains only `id`, `fullName`, `email`, `contactNumber`, `isActive` and `createdAt`. The database query explicitly selects these fields; password hashes, session tokens and permission details are excluded.

## API

`GET /api/clients` requires a valid bearer session and `clients:read`. Only Admin and Superadmin receive that permission. Staff and User receive 403, missing/invalid sessions receive 401, malformed filters receive 400, and an unavailable database receives 503. Responses use `Cache-Control: no-store`.

| Parameter   | Accepted values                                                            | Default     |
| ----------- | -------------------------------------------------------------------------- | ----------- |
| `search`    | Trimmed string, up to 100 characters; case-insensitive name or email match | Empty       |
| `status`    | `ACTIVE`, `INACTIVE`, or empty                                             | All         |
| `sortBy`    | `fullName`, `email`, `isActive`, `createdAt`                               | `createdAt` |
| `sortOrder` | `asc`, `desc`                                                              | `desc`      |
| `page`      | Integer from 1 to 1,000,000                                                | `1`         |

Repeated or structured values for supported parameters are invalid. Unknown parameters do not affect the query. Response: `{ clients: [...], total, page, pageSize: 20 }`. Pages beyond the last page return an empty array; the UI returns to the last available page if records disappear. Changing search, status or ordering resets the UI to page 1. Superseded responses are ignored. Loading, successful results, no accounts, no matches and retryable errors have separate states.

## Related records API

All endpoints below require the same `clients:read` permission and valid bearer session. Only Admin and Superadmin have access. Unknown, deleted or non-USER client IDs return 404. IDs must contain 1-80 ASCII letters, digits, hyphens or underscores; malformed IDs return 400. Related lists accept `page` using the same bounds as the directory, reject repeated/structured pagination values, and use 10 records per page, newest first with an ID tie-breaker. Unknown query parameters are ignored. Out-of-range pages return empty arrays. Reads validate the parent and query within one repeatable-read transaction. None expose credentials or records owned by a different client.

| Endpoint                                       | Response                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/clients/:id`                         | `{ client, serviceRequestCount, projectCount }` with the six safe account fields above |
| `GET /api/clients/:id/service-requests?page=1` | `{ serviceRequests, total, page, pageSize: 10 }`                                       |
| `GET /api/clients/:id/projects?page=1`         | `{ projects, total, page, pageSize: 10 }`                                              |

Requests expose `id`, `title`, `status`, `createdAt` and `service: { id, name }`. Projects expose `id`, `name`, `status`, nullable `startDate` and `createdAt`. Descriptions are stored for future request/project workflows but are excluded from this compact read API. These endpoints are read-only; unsupported writes have no route.

## Database relationships

`ServiceRequest.clientId` and `Project.clientId` reference `User.id`. `ServiceRequest.serviceId` references `Service.id`. One client can have many service requests and projects, and one service can have many requests. Projects do not require a request. Foreign keys preserve referential integrity and prevent deleting a referenced client or service. The existing account API returns 409 when deletion would remove a client with related records; this module does not expose account deletion. Deactivation retains the records.

| Model            | Fields                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServiceRequest` | `id` (generated CUID), `clientId`, `serviceId`, `title`, nullable `description`, `status` (default `PENDING`), `createdAt`, `updatedAt`         |
| `Project`        | `id` (generated CUID), `clientId`, `name`, nullable `description`, `status` (default `PLANNED`), nullable `startDate`, `createdAt`, `updatedAt` |

Request statuses: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. Project statuses: `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED`. The UI displays readable status names. Both models have an index on `(clientId, createdAt, id)`; requests also index `serviceId`.

The migration adds two enums, two tables, indexes and foreign keys without changing existing rows. Deploy it before starting the regenerated API. Prisma generates CUIDs and manages `updatedAt`; direct SQL inserts must supply IDs and `updatedAt` explicitly. No sample rows are inserted into the configured database. New tables initially show genuine empty states until records are created through the corresponding future business workflows or imported with valid foreign keys. Creating and managing requests/projects is outside this read-only Client Management issue.

## Verification

`apps/api/src/client-integration.test.ts` uses a temporary PGlite database to exercise authentication, read permissions, safe field projection, filtering, sorting, pagination, related-record ownership, unsupported writes and foreign-key deletion protection. `apps/web/e2e/clients.spec.ts` checks directory controls, related tabs, states, focus and role restrictions. No production database is seeded or modified by these tests.
