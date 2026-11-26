# PG-017 Atomic Feature Inventory

16 source-backed atomic features; user-facing operations are reads or navigation. References with `page`, `service`, or `request-details-drawer` mean `apps/web/src/features/bookings/pages/booked-services-page.tsx`, `apps/api/src/features/service-requests/service-requests.service.ts`, and `apps/web/src/features/bookings/components/request-details-drawer.tsx`; other relative references resolve within the source or test paths in the discovery and baseline.

## PG-017-F001-A001 ? Initial client list

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:55; service:41`; open page.
- **Inputs and validation:** GET list, default page 1.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** list success / loading or retry.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:210; booked-services.test.ts:71`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A002 ? Search and preview

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:34,124; use-paginated-list.ts:112`; enter search.
- **Inputs and validation:** trimmed search up to 100; page 1.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** preview then accepted result / error retry.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `combined-filters.spec.ts:5; table-interactions.spec.ts:318`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A003 ? Select status

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:135; service-requests.schema.ts:12`; select lifecycle option.
- **Inputs and validation:** enum status; page 1.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** filtered result / error retry.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:293`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A004 ? Clear filters

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:80,145`; press Clear filters.
- **Inputs and validation:** no input; reset search/status/page.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** unfiltered first page / error retry.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `combined-filters.spec.ts:113`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A005 ? Page through list

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:180; pagination.ts:15`; choose next/previous.
- **Inputs and validation:** decimal page 1?100000; size 10.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** matching page / error retry; clamp stale page.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.test.ts:94; booked-services.spec.ts:260`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A006 ? List states and retry

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:155; booked-services-table.tsx:61`; load empty/error or click retry.
- **Inputs and validation:** server response; no input.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** skeleton, appropriate empty, error then reload.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:409,449`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A007 ? Refresh list and open details

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:55,64,98; use-paginated-list.ts:154`; click Refresh or visible focus/reconnect.
- **Inputs and validation:** no polling; skip in-flight.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** reload, refresh open detail; background 5xx retains rows.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:35`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A008 ? Select and read details

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:163,189; service:91`; press View.
- **Inputs and validation:** valid owner id.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** show selected detail / 404 or error and retry.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.test.ts:146; booked-services.spec.ts:332`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A009 ? Async detail lifecycle

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `request-details-drawer.tsx:56; use-async-resource.ts:49`; open/change/close or retry.
- **Inputs and validation:** id and refresh key; AbortSignal.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** pending then current data / error; ignore stale.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:409,449`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A010 ? Close details and restore focus

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `request-details-drawer.tsx:76; side-panel.tsx:99`; Escape or close button.
- **Inputs and validation:** open SidePanel.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** close; focus captured opener or attempt fallback.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:332,390`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A011 ? Booking deep link

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `apps/web/src/app/(portal)/booked-services/page.tsx:4`; load URL.
- **Inputs and validation:** one booking string <=200; otherwise null.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** open detail if truthy / detail error and retry.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:390`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A012 ? Detail content and workspace link

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `booking-details-drawer.tsx:93; request-details-body.tsx:73`; view loaded detail or follow link.
- **Inputs and validation:** detail fields, optional values.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** render fallbacks and encoded messages link / detail error.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:347; request-conversations.spec.ts:472`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A013 ? Browse Services navigation

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `page:109`; activate link.
- **Inputs and validation:** none.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** navigate /services / destination behavior separate.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.spec.ts:238`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A014 ? Authentication and ownership

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `service-requests.controller.ts:12; auth.middleware.ts:23; service:41,91`; protected GET.
- **Inputs and validation:** active session, role USER; clientId from session.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** own rows/detail; 401/403/404 otherwise.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.test.ts:132,146`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A015 ? Validate query and ID

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `service-requests.schema.ts:23; service-requests.controller.ts:14`; send list/detail request.
- **Inputs and validation:** single search/status, valid page and record ID.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** 200 on valid / 400 invalid.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.test.ts:174`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.

## PG-017-F001-A016 ? Projection and snapshot ordering

- **Actor and preconditions:** Active authenticated USER in the portal; for security API cases also anonymous, inactive, STAFF, ADMIN, SUPERADMIN, and a second synthetic USER. Page controls require the relevant list or dialog to be present.
- **Component / trigger:** `service:27,48,91; pagination.ts:43`; list or detail GET.
- **Inputs and validation:** same owner and filters.
- **API / authorization:** `GET /api/service-requests` or `GET /api/service-requests/:id` as applicable; the server authenticates USER and applies `clientId` from the session. Navigation itself makes no booking mutation.
- **State, success, failure and recovery:** selected fields, createdAt desc/id asc, repeatable-read rows/count.
- **Persistence:** Own ServiceRequest and Service reads; no page-initiated domain write. Authentication/session bookkeeping is separate.
- **Existing coverage:** `booked-services.test.ts:71,146,190,205`; assertion locations and boundaries in the baseline. Source declarations are not evidence of a current pass.
