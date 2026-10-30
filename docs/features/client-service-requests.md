# Client Service Requests

Developed: 2026-10-30

Client accounts (`USER`) can open **Service Requests** at `/service-requests` to track their own requests. The page uses the existing portal header, navy actions, KPI cards, Radix filters, status pills, numbered pagination, and details drawer. Desktop tables switch to cards on smaller screens.

The overview shows total, pending, in-progress, and completed requests across the client's history. Search matches the request title, reference, service, or package. Status filtering, newest/oldest sorting, and pagination run on the server. The drawer shows submitted requirements, timeline, the pricing snapshot, and the preferred specialist. A specialist preference never finalizes an assignment; the Department Manager makes that decision.

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

History accepts `page` (default 1, page size 10), `search` (up to 100 characters), `status` (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), and `sortOrder` (`asc` or `desc`, default `desc`). Invalid filters return `400`. Overview totals cover all of the signed-in client's requests regardless of filters. The API derives ownership from the session and ignores supplied client IDs. The history response uses an explicit field selection and omits internal agreed prices, submission keys and account fields.

Service list/detail routes share the catalog's pricing visibility rules. Private service pricing is omitted; private package amounts and billing intervals are cleared. No schema changes or new migrations are required.

## Verification

- Offline PGlite API tests cover role access, ownership, service and package availability, specialist eligibility, hidden pricing, structured requirements, retry protection, history filters, sorting, pagination and totals.
- Playwright checks cover desktop/mobile history, details, filters, pagination, empty/error states, forbidden-role redirects, and the existing booking flows through the client routes.
- Run `pnpm format`, `pnpm lint`, and `pnpm typecheck` before handoff.
