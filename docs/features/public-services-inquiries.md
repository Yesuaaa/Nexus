# Public Services and guest inquiries

## Scope and visitor journey

Converyn's public catalog is at /explore/services. The existing signed-in /services route and its booking workflow are unchanged.

1. Browse or search active services without signing in.
2. Open /explore/services/:id for descriptions, benefits, public plans/prices, and customer preparation requirements.
3. Choose "Inquire about this service" to open /explore/services/:id/inquire with the service prefilled.
4. Submit name, email, contact number, subject, requirements, and an acknowledgement. A receipt confirms pending company review, not a booking or agreement.
5. Administrators review the independent inquiry in /service-inquiries and record follow-up.

Discovery and inquiry submission do not create an account, booking, appointment, staff/team assignment, project, invoice, or payment obligation. No email is automatically sent. Follow-up is recorded by authorized personnel using the visitor's contact details.

The header's Services item and landing-page service/conversation CTAs open the public catalog. Footer items remain hover-only text. The Contact navigation item opens the homepage contact section. That section's conversation CTA opens the catalog so the visitor can choose a service. Catalog cards offer both View details and Inquire, while service details link to the selected service's inquiry form.

## Public data policy

The public controller has its own explicit Prisma field selection. It exposes active services only, including name, description, approved service image URL/alt text, icon, customer requirements, ordered benefits, and active plan descriptions/features. Only pricing explicitly configured as public is returned. Hidden amounts, pricing metadata, internal consultation notes, employee/specialist records, assignments, department identifiers/names, configuration flags, and management timestamps are omitted.

There is no department publication setting, so internal departments are deliberately not exposed. Public lists are paginated (12/page) and searches are trimmed and limited to 120 characters. Disabled/nonexistent services return 404 and cannot receive new inquiries.

## API

All requests are same-origin through Next's existing /api proxy. Public endpoints require no Bearer token and have no cookie session.

| Endpoint                                         | Purpose                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| GET /api/public/services?q=&page=1               | Search active services; returns services, total, page, pageSize.           |
| GET /api/public/services/:id                     | Public service details.                                                    |
| POST /api/public/services/:id/inquiries          | Submit an independent guest inquiry.                                       |
| GET /api/service-inquiries?status=PENDING&page=1 | Authenticated inquiry review inbox, 25/page. Status ALL lists every state. |
| PATCH /api/service-inquiries/:id                 | Save a review with status, internalNote, version.                          |

Submission JSON: fullName (2–100), email (normalized, <=254), contactNumber (shared generic phone predicate), subject (3–160), message (10–6000), agreed=true, website="" (honeypot), submissionKey (UUID v4). The route's service ID is authoritative. The 32 KiB body cap accommodates Unicode. Server validation is independent of frontend validation.

Success: 201 { inquiry: { id, status, createdAt }, replayed: false, message }. An identical submissionKey and normalized content replay returns the existing receipt with 200. A reused key with different content returns 409.

Invalid fields/IDs return 400. Unavailable services return 404. Duplicates/conflicting edits return 409. Rate limits return 429. Oversize payloads return 413. Unavailable database/storage dependencies are handled as unavailable data; the UI provides loading, empty, retry, error, validation, and success states.

## Storage and duplicate/spam safeguards

ServiceInquiry is a separate table:

- id: generated record ID used as receipt/reference.
- serviceId: required Service foreign key, ON DELETE RESTRICT. Inquiry history prevents destructive deletion of its service.
- fullName, email, contactNumber, subject, message: required bounded visitor data.
- submissionKey: unique UUID for safe retries.
- fingerprint: SHA-256 over normalized content and service ID, internal only.
- status: PENDING by default; CONTACTED after follow-up, CLOSED when resolved, SPAM when unwanted.
- internalNote, reviewedById, reviewedAt: latest administrative follow-up. Reviewer deletion sets the reviewer ID to null.
- version: optimistic review concurrency counter.
- createdAt, updatedAt: timestamps.
- indexes: status/time/ID, service/time, email/time, fingerprint/time.

The insertion transaction serializes senders using a parameterized PostgreSQL advisory transaction lock, checks idempotency, locks the active service FOR SHARE, rejects identical content within ten minutes, and caps a sender at five inquiries/hour. The unique submission key resolves concurrent retries. Browsing has a process-local IP limit of 90 requests/minute; submission also has a process-local IP limit of three/minute. Expiring limiter maps have bounded capacity. Honeypot, required acknowledgement, payload and field limits add spam resistance. No IP address or browser fingerprint is persisted. Email-based throttling and duplicate protection are database-backed across replicas; IP limits are per API process, matching the existing limiter's deployment limitations.

There is no public inquiry list, lookup, or review endpoint. Public receipts never include contact details or messages.

## Authorization

New permissions service-inquiries:read and service-inquiries:manage are granted only to ADMIN and SUPERADMIN. Auth middleware checks the live active account and session. STAFF and USER receive neither permission. Review fields are explicitly whitelisted. Client-supplied reviewer IDs, status on submission, assignments, and workflow identifiers are ignored. Review updates require the record's version; conflicts require refresh. Inbox and review responses are no-store.

The portal route policy and Service Management link mirror the server permissions. Administrative inbox navigation does not grant booking/conversation participation.

## Deployment and verification status

Migration: apps/api/prisma/migrations/20261115120000_public_service_inquiries/migration.sql.
Prisma client generation was run. On 2026-11-15, the additive inquiry migration was applied successfully to the configured Supabase database using prisma migrate deploy. The deployment action first refused unrelated pending migrations; only 20261115120000_public_service_inquiries was pending and applied.

No format, lint, typecheck, build, unit, integration, or regression commands were run, per the user's instruction. Implementation is not a claim of passing verification. The successful migration command confirms the schema change only; it is not an application runtime or end-to-end verification.

## Local development route recovery

After the API watcher stopped while resolving a new controller during file creation, restarting nexus-api-1 loaded the completed module. Read-only requests to the API and the existing Next proxy returned HTTP 200 for the catalog and one active service; the detail and inquiry page routes also returned HTTP 200. This was focused diagnosis of the reported failure, not a regression run or validation of inquiry submission. No guest inquiry or other business record was created.
