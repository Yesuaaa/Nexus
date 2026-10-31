# Client Service Requests

Developed: 2026-10-30

Client accounts (`USER`) can open **Service Requests** at `/service-requests` to track their own requests. The page uses the existing portal header, navy actions, KPI cards, Radix filters, status pills, numbered pagination, and details drawer. Desktop tables switch to cards on smaller screens.

The overview shows total, pending-review, in-review, and closed requests across the client's history. Search matches the request title, reference, service, or package. Status filtering, newest/oldest sorting, and pagination run on the server. The drawer shows submitted requirements, timeline, the pricing snapshot, and the preferred specialist. A specialist preference never finalizes an assignment; the Department Manager makes that decision.

**New Service Request** opens the existing `/services` booking flow. Clients choose a service and package, supply project goals, requirements and an expected timeline, optionally select a preferred specialist, then submit for review. Confirmation links back to request history. Service details are refreshed from the API before opening the service showcase.

## API integration

All five routes require authentication and the `USER` role:

| Method | Route                                  | Purpose                                                                |
| ------ | -------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/client/services`                 | Active services and packages with public pricing and image URLs        |
| GET    | `/api/client/services/:id`             | Current active service details                                         |
| GET    | `/api/client/services/:id/specialists` | Active staff with active, unarchived logins in responsible departments |
| POST   | `/api/client/service-requests`         | Submit the structured booking draft for review                         |
| GET    | `/api/client/service-requests`         | Own request history and overview totals                                |

Submission accepts `serviceId`, nullable `packageId` and `preferredSpecialistId`, UUID `submissionKey`, `goals`, `requirements`, `expectedTimeline`, and optional `additionalDetails`. It shares validation, public-price snapshots, transactional persistence, and retry protection with `/api/service-requests`. Replaying the same draft and key returns the original receipt; changing a submitted draft under that key returns `409`. New receipts include a unique `SR-` reference; older records fall back to their request ID. The previously unused client endpoint's title/description payload has been replaced by this booking contract.

History accepts `page` (default 1, page size 10), `search` (up to 100 characters), `status` (`SUBMITTED`, `UNDER_REVIEW`, `AWAITING_CLIENT_INFO`, `READY_FOR_QUOTATION`, `CLOSED`, `CANCELLED`), and `sortOrder` (`asc` or `desc`, default `desc`). Invalid filters return `400`. Overview totals cover all of the signed-in client's requests regardless of filters. The API derives ownership from the session and ignores supplied client IDs. The history response uses an explicit field selection and omits internal agreed prices, submission keys and account fields.

Service list/detail routes share the catalog's pricing visibility rules. Private service pricing is omitted; private package amounts and billing intervals are cleared. The Prisma enum and page use the manager request lifecycle. Migration `20261030220000_align_service_request_statuses` renames the original pending/in-progress/completed values to submitted/under-review/closed while preserving records, adds the information and quotation states, and also supports databases already using the manager lifecycle. New submissions start as `SUBMITTED`. Overview `pending` counts submitted requests; `inProgress` groups under review, awaiting client information, and ready for quotation; `completed` counts closed requests. Closing a request does not imply project completion.

## Verification

- Offline PGlite API tests cover role access, ownership, service and package availability, specialist eligibility, hidden pricing, structured requirements, retry protection, history filters, sorting, pagination and totals.
- Playwright checks cover desktop/mobile history, details, filters, pagination, empty/error states, forbidden-role redirects, and the existing booking flows through the client routes.
- Run `pnpm format`, `pnpm lint`, and `pnpm typecheck` before handoff.

## Legacy booked-services links and department acceptance

**Service Requests** is the client-facing request history and tracking page. New booking confirmations lead there, and the client sidebar contains no separate **Booked Services** entry. Existing `/booked-services` links remain available for compatibility. `GET /api/service-requests` and `GET /api/service-requests/:id` require an active `USER` session, derive ownership from that session, and return `404` for another client's booking. These read responses omit pricing snapshots, account fields, and submission keys.

Department heads accept bookings through the [Request Inbox](department-request-inbox.md). Acceptance moves a submitted booking into **Under review**, visible in Service Requests and compatible legacy links. Existing pending, in-progress, and completed records are migrated to the shared submitted, under-review, and closed statuses.

Both details panels include an **Open messages** link to the dedicated [Messages page](request-messaging.md), also available from the message icon in the top bar. After acceptance, the client and the accepting department's current head can exchange messages there with live updates, persisted history and retry protection. Before acceptance, the conversation page waits for the department and updates automatically when the conversation opens.
