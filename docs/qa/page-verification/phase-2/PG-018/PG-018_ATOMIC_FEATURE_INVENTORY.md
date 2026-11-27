# PG-018 Atomic Feature Inventory

22 independent behaviors; identifiers are stable. The page is read-only. Per-feature input, validation, outcome and evidence are below; common authorization/persistence constraints apply to every relevant read, not merely the UI.

## PG-018-F001-A001: Portal access

- **Actor / preconditions:** all four active roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/auth/model/permissions.ts:143; apps/web/src/components/layout/portal-layout.tsx:20`.
- **Trigger and inputs:** navigate /calendar; current account/session.
- **Validation:** no extra calendar permission.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** render correct role shell; unauthorized session denied.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** role policy tests and calendar.spec.ts:27; presence is not current execution evidence.

## PG-018-F001-A002: Load and normalize data

- **Actor / preconditions:** all roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:153-216`.
- **Trigger and inputs:** mount or account change; client array/internal envelope.
- **Validation:** read response source contract.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** sort events and render loading/result.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.spec.ts:27 partial; presence is not current execution evidence.

## PG-018-F001-A003: Error and explicit retry

- **Actor / preconditions:** all roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:199-208,342-356`.
- **Trigger and inputs:** failed GET; Try again; revision, retained selected day.
- **Validation:** errorMessage fallback.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** clear data on error, alert then reload.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** P20-WEB-003; presence is not current execution evidence.

## PG-018-F001-A004: Visible refresh and stale response guard

- **Actor / preconditions:** all roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:177-216`.
- **Trigger and inputs:** focus/visibility/reconnect or scope/month change; AbortSignal, inFlight.
- **Validation:** no background polling.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** refresh once; ignore obsolete results on cleanup.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** coverage gap; presence is not current execution evidence.

## PG-018-F001-A005: Month navigation and Today

- **Actor / preconditions:** all roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/components/ui/calendar.tsx:82-178; apps/web/src/features/calendar/pages/calendar-page.tsx:462-469`.
- **Trigger and inputs:** Previous/Next/Today; view month and Manila today.
- **Validation:** year 1-9999 bounds.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** change grid and month query; Today also selects date.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** P20-WEB-001 partial; presence is not current execution evidence.

## PG-018-F001-A006: Grid keyboard navigation

- **Actor / preconditions:** all roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/components/ui/calendar.tsx:111-235`.
- **Trigger and inputs:** Arrow/Home/End/PageUp/PageDown/Enter; focused day.
- **Validation:** clamp destination month/year bounds.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** move roving focus/view; activate selected date.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** P20-WEB-002 partial; presence is not current execution evidence.

## PG-018-F001-A007: Selected day and markers

- **Actor / preconditions:** all roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:275-288,489-580; apps/web/src/components/ui/calendar.tsx:270-438`.
- **Trigger and inputs:** click/activate grid day; filtered date groups.
- **Validation:** Manila date or all-day business date.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** agenda count, milestones first, marker labels/dots.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** P20-WEB-001 and calendar role cases; presence is not current execution evidence.

## PG-018-F001-A008: Upcoming selection

- **Actor / preconditions:** all roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:289-307,592-643`.
- **Trigger and inputs:** accepted events/clock change; selected date, now.
- **Validation:** end/date inclusion boundaries.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** exclude completed/milestones/selected date; first three upcoming.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** coverage gap; presence is not current execution evidence.

## PG-018-F001-A009: Join meeting eligibility and safety

- **Actor / preconditions:** all roles with projected location; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:69-102,297-304`.
- **Trigger and inputs:** time crosses window; activate Join; incomplete meeting, endsAt, HTTPS URL.
- **Validation:** start <=now+15m; end >now; no credentials.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** one eligible safe link, new tab noopener.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** P20-WEB-004 partial; presence is not current execution evidence.

## PG-018-F001-A010: Event and consultation navigation

- **Actor / preconditions:** eligible record viewers; USER book link; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:105-121,333-339,564-565; apps/api/src/features/projects/client-calendar.service.ts:77-150`.
- **Trigger and inputs:** activate View or Book a consultation; projected href.
- **Validation:** href encoding supplied by backend.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** navigate existing workflow/service route; no calendar write.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.spec.ts:112 href only; presence is not current execution evidence.

## PG-018-F001-A011: Internal scope selection

- **Actor / preconditions:** eligible STAFF; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:361-377; apps/api/src/features/projects/calendar.service.ts:43-118`.
- **Trigger and inputs:** choose mine/team; response canViewTeam.
- **Validation:** backend leadership rechecked.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** clear project/staff/department; retain type/day; reload.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.spec.ts:107; calendar.test.ts:233-312; presence is not current execution evidence.

## PG-018-F001-A012: Event-type local filter

- **Actor / preconditions:** internal roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:218-225,380-388`.
- **Trigger and inputs:** select Event types; loaded events.
- **Validation:** one of UI event types/all.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** local type filter changes agenda/metrics.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.spec.ts:129-137; presence is not current execution evidence.

## PG-018-F001-A013: Project local filter

- **Actor / preconditions:** internal roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:218-229,389-397`.
- **Trigger and inputs:** select Projects; loaded project metadata.
- **Validation:** all/project id.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** deduplicated sorted options, local AND filtering.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** coverage gap; presence is not current execution evidence.

## PG-018-F001-A014: Department and staff local filters

- **Actor / preconditions:** ADMIN/SUPERADMIN; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:218-229,399-419`.
- **Trigger and inputs:** select department/staff; loaded organization metadata.
- **Validation:** all or projected id.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** local AND matches department and staffMembers.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.spec.ts:119-128 partial; presence is not current execution evidence.

## PG-018-F001-A015: Clear local filters

- **Actor / preconditions:** internal roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:313-315,421-437`.
- **Trigger and inputs:** Clear filters; one local filter active.
- **Validation:** button only when hasFilters.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** reset type/project/department/staff; preserve scope/day.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.spec.ts:135-139 partial; presence is not current execution evidence.

## PG-018-F001-A016: Metrics and event badges

- **Actor / preconditions:** internal roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/pages/calendar-page.tsx:230-273,508-557`.
- **Trigger and inputs:** data/filter/minute tick; events, allEvents conflicts, now.
- **Validation:** not all sources are month bounded.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** scheduled, overdue, overlap and unassigned counts; status badges.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** coverage gap; presence is not current execution evidence.

## PG-018-F001-A017: Event date and completion status

- **Actor / preconditions:** all roles, pure helpers; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/model/calendar.ts:30-48`.
- **Trigger and inputs:** transform event/today; ISO time or allDay/startDate.
- **Validation:** all-day date preserved.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** Manila date; Completed takes precedence; overdue deadlines only.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar*.test.mjs; presence is not current execution evidence.

## PG-018-F001-A018: Overlap and leave conflicts

- **Actor / preconditions:** internal view/pure helper; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/web/src/features/calendar/model/calendar.ts:50-115`.
- **Trigger and inputs:** compute from events and now; assignees, timed intervals, leave day/timezone.
- **Validation:** half-open timed end; exclude allDay/completed/ended from timed.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** shared-person overlapping events flagged; leave conflicts by business day.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.test.mjs:41 partial; presence is not current execution evidence.

## PG-018-F001-A019: Client projection and isolation

- **Actor / preconditions:** USER; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/api/src/features/projects/client-calendar.service.ts:7-151; apps/api/src/features/projects/calendar.queries.ts:27-67`.
- **Trigger and inputs:** GET calendar; owner userId.
- **Validation:** query cannot select foreign client.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** own consultations/meetings/shared milestones; no internal data.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** P20-API-001; calendar.test.ts:317-338; presence is not current execution evidence.

## PG-018-F001-A020: Internal event scope and projection

- **Actor / preconditions:** STAFF/ADMIN/SUPERADMIN; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/api/src/features/projects/calendar.service.ts:43-175,209-330`.
- **Trigger and inputs:** GET calendar; leadership/assignments, active user.
- **Validation:** no elevated private access by default.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** scoped tasks/milestones/appointments; minimize href/location.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.test.ts:209-351; NEX-015; presence is not current execution evidence.

## PG-018-F001-A021: Approved leave projection

- **Actor / preconditions:** internal roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/api/src/features/projects/calendar.service.ts:176-207,331-362`.
- **Trigger and inputs:** GET internal calendar month; approved positive-day snapshots.
- **Validation:** 42-day window and status/leaveMinutes filters.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** own/head-team/org day events, private projection.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** leave lifecycle assertion:135-148 partial; presence is not current execution evidence.

## PG-018-F001-A022: Internal query validation

- **Actor / preconditions:** internal roles; a current portal account and the listed source data/control are required. Pure helpers need only deterministic input values.
- **Source implementation and evidence:** `apps/api/src/features/projects/projects.controller.ts:34-44; apps/api/src/features/projects/calendar.service.ts:62-82`.
- **Trigger and inputs:** GET scope/month; query strings.
- **Validation:** scope mine/team; month YYYY-MM nonzero year.
- **API dependency:** `GET /api/projects/calendar`; USER has no query, internal scope/month are sent. Local filter/grid/helper actions do not mutate data; month/scope changes may reload the endpoint. Pure helpers have no API call.
- **Authorization:** shared requireAuth; client owner predicates or current internal role/head/assignment scope as detailed in functional discovery. UI visibility does not authorize linked records.
- **State transition / success:** valid defaults or HTTP400/403 with no domain write.
- **Persistence:** domain reads only; no calendar transaction or mutation. Pure helpers/navigation have no direct persistence operation; destination workflows are separate.
- **Failure / cancellation / recovery:** current HTTP failure clears events and displays alert/retry; effect cleanup aborts and ignores obsolete loads. Navigation uses native links; optional absent href/Join is not an error. Pure-helper invalid-input behavior beyond valid event contracts is not invented.
- **Existing coverage:** calendar.test.ts:296-302 partial; presence is not current execution evidence.
