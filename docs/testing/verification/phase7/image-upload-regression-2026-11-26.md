# Image Upload Regression QA Report

- **Branch:** `302-featimages-accept-jpeg-png-and-webp-uploads-and-normalize-storage-to-webp`
- **Comparison base:** `origin/development`
- **Execution date:** 2026-11-26
- **Environment:** local isolated API tests with PGlite and injected image storage; mocked Playwright browser environment; no production data or live Supabase storage

## Scope and affected behavior

The branch changes primary Service images and profile avatars. JPEG, PNG, and WebP inputs are decoded, checked for format agreement, limited to one frame and 25 megapixels, auto-oriented, resized without enlargement, and stored as WebP. Service images fit within 2560×2560; avatars fit within 1024×1024. Profile banners and portfolio images retain their original encoding and legacy signature validation.

The QA follow-up adds stricter profile request-body validation, rejects empty files in the Service browser form, and covers authorization, malformed content, cleanup, rollback, replacement, and error handling. No database schema or migration changes are included.

## Authorization matrix

| Operation                          | Unauthenticated | USER    | STAFF                               | ADMIN                          | SUPERADMIN                                                          |
| ---------------------------------- | --------------- | ------- | ----------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| Create/update/delete Service image | 401             | 403     | 403                                 | Allowed with `services:manage` | Allowed when the effective permission map grants Service management |
| Upload own avatar/banner           | 401             | Allowed | Allowed                             | Allowed                        | Allowed                                                             |
| Upload portfolio project image     | 401             | 403     | Allowed only with a linked Employee | 403                            | 403                                                                 |

All profile writes derive the target account from the authenticated session. The request does not accept a target user ID. UI visibility is not treated as authorization; API denials are tested directly.

## Automated test matrix

| ID           | Module                  | Scenario                                                                                  | Priority | Preconditions                                                         | Test data and steps                                                                              | Expected result                                              | Actual result                                    | Status |
| ------------ | ----------------------- | ----------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------ | ------ |
| IMG-API-001  | Services RBAC           | Reject unauthorized Service-image creation                                                | Critical | Isolated API; one department; USER, STAFF, ADMIN, SUPERADMIN sessions | POST the same PNG Service payload anonymously, as USER, and as STAFF                             | 401/403 responses; no object write or Service row            | Expected statuses; zero uploads and rows         | Passed |
| IMG-API-002  | Services validation     | Reject conflicting, missing-alt, spoofed, corrupt, animated, SVG, and invalid-flag inputs | Critical | ADMIN session and injected storage                                    | POST eight invalid payload variants                                                              | 400 for every variant; zero storage and database writes      | Eight variants rejected; zero writes             | Passed |
| IMG-API-003  | Services normalization  | Normalize and resize oversized PNG on create                                              | High     | ADMIN session; injected storage                                       | POST a 3000×1500 PNG with alt text                                                               | 201; stored RIFF/WEBP; 2560×1280; private path omitted       | Canonical WebP stored at 2560×1280               | Passed |
| IMG-API-004  | Services error handling | Handle storage outage                                                                     | Critical | Next injected upload configured to fail                               | POST otherwise-valid Service image                                                               | 503; no Service row                                          | 503 returned; no row created                     | Passed |
| IMG-API-005  | Services rollback       | Clean up uploaded object after duplicate-name conflict                                    | Critical | Existing Service with image                                           | POST duplicate name with a new JPEG                                                              | 409; newly uploaded WebP removed                             | Conflict returned; new object removed            | Passed |
| IMG-API-006  | Services lifecycle      | Replace, explicitly remove, re-add, and delete image                                      | High     | Existing Service image; ADMIN/SUPERADMIN sessions                     | PUT JPEG replacement, PUT `removeImage`, re-add WebP, deactivate, DELETE                         | Old objects removed at each transition; final storage empty  | Expected object lifecycle observed               | Passed |
| IMG-UNIT-001 | Image normalization     | Accept JPEG, PNG, and WebP and emit canonical WebP                                        | High     | Sharp available                                                       | Normalize one image per supported format                                                         | WebP result with safe dimensions                             | All formats normalized                           | Passed |
| IMG-UNIT-002 | Image normalization     | Preserve aspect ratio and never enlarge                                                   | High     | Normalization options configured                                      | Normalize large and small inputs                                                                 | Large input fits bounds; small input remains native size     | Expected dimensions observed                     | Passed |
| IMG-UNIT-003 | Image security          | Reject MIME mismatch, corrupt input, unsafe dimensions, and oversized output              | Critical | Normalization options configured                                      | Submit each unsafe content class                                                                 | `ImageNormalizationError` before storage                     | All unsafe classes rejected                      | Passed |
| IMG-UNIT-004 | Image parsing           | Reject malformed Base64 and decoded bytes above limit                                     | High     | Normalization options configured                                      | Submit invalid Base64 and over-limit bytes                                                       | Validation error                                             | Both inputs rejected                             | Passed |
| IMG-UNIT-005 | Image metadata          | Apply EXIF orientation and reject animated/malformed envelopes                            | High     | Sharp-generated oriented JPEG and animated WebP                       | Normalize oriented JPEG; submit animated and malformed inputs                                    | Dimensions rotate from 12×6 to 6×12; invalid inputs rejected | Orientation applied; all invalid inputs rejected | Passed |
| PROF-API-001 | Profile validation      | Reject invalid request bodies and avatar content                                          | Critical | Active authenticated profile session                                  | Submit null, empty object, unsupported/string-array kinds, missing/empty data, and animated WebP | 400 for each; no storage write                               | Every variant returned 400; uploads unchanged    | Passed |
| PROF-API-002 | Profile RBAC            | Restrict project images to linked STAFF                                                   | Critical | USER, SUPERADMIN, unlinked STAFF sessions                             | POST a valid project PNG as each actor                                                           | 403 for every ineligible actor; no storage write             | All three actors denied; uploads unchanged       | Passed |
| WEB-E2E-001  | Service form            | Accept supported browser file types                                                       | High     | ADMIN mock session; Create Service dialog open                        | Select JPEG, PNG, and WebP files one at a time                                                   | Preview/remove control appears without alert                 | All three types accepted                         | Passed |
| WEB-E2E-002  | Service form            | Reject GIF, SVG, empty PNG, and oversized WebP                                            | High     | ADMIN mock session; Create Service dialog open                        | Select four invalid files                                                                        | Validation alert; no selected-image control                  | All four files rejected                          | Passed |
| WEB-E2E-003  | Service table           | Keep delayed search skeleton deterministic                                                | Medium   | ADMIN mock session; fake clock installed                              | Search for absent Service and advance 200 ms                                                     | Ten aligned skeleton rows, then empty result                 | Expected loading and empty states observed       | Passed |

## Execution results

| Command                                                                                                                                                                                                                                  | Scope                       |  Passed | Failed | Skipped/blocked | Result     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------: | -----: | --------------: | ---------- |
| `pnpm --filter @nexus/api test -- tests/features/services/image-normalization.test.ts tests/features/services/validation.test.ts tests/features/services/image-endpoints.test.ts tests/profile.test.ts tests/profile-regression.test.ts` | Focused API/unit regression |      23 |      0 |               0 | Exit 0     |
| `pnpm --filter @nexus/web test`                                                                                                                                                                                                          | Complete web unit suite     |     143 |      0 |               0 | Exit 0     |
| `pnpm --filter @nexus/web exec playwright test services/services.spec.ts profile/profile.spec.ts --workers=2`                                                                                                                            | Affected browser workflows  |      16 |      0 |               0 | Exit 0     |
| **Executed total**                                                                                                                                                                                                                       |                             | **182** |  **0** |           **0** | **Passed** |

The Playwright command also completed the production Next.js build used by its configured web server. Logged 503 stack traces in the API run were expected assertions for injected storage failures, not test failures.

The entire API suite and entire Playwright inventory were not rerun in this follow-up. Earlier unsaved claims of a complete baseline are not treated as execution evidence. Only the commands and counts above are certified by this report.

## Quality gate

The mandatory gate was rerun after the documentation update: `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `git diff --check` all exited 0 on the final candidate tree.

## Root causes and targeted fixes

| Finding                                                           | Classification                | Root cause                                                    | Resolution                                                                              |
| ----------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Array or primitive profile bodies could reach kind coercion       | Application validation defect | The handler cast untrusted input and used `String(body.kind)` | Require a non-array object and a string allowlisted kind before database/storage access |
| Empty supported-type file passed the Service form's initial check | Application validation defect | Client validation checked MIME and upper size only            | Reject `file.size === 0`; API validation remains authoritative                          |
| Search loading assertion could race the debounce clock            | Test reliability defect       | Fake time was installed but not explicitly paused             | Pause the Playwright clock before editing the search field                              |

No confirmed regression remains from the focused execution.

## Manual QA walkthrough

These checks are provided for release/user-acceptance testing and were not executed against a live deployment.

| ID      | Scenario                             | Preconditions and test data                                        | Steps                                                                                   | Expected result                                                                    | Actual result | Status       |
| ------- | ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------- | ------------ |
| MAN-001 | Admin creates Service with PNG       | ADMIN account; PNG under 2 MiB; alt text                           | Open Services, create a Service, select the PNG, enter alt text, submit, reopen details | Service saves; image renders; no broken preview                                    | Not executed  | Not Executed |
| MAN-002 | Admin replaces/removes Service image | Existing editable Service with image; JPEG under 2 MiB             | Edit, replace image, save; edit again, remove image, save                               | Replacement persists, then image and alt text clear                                | Not executed  | Not Executed |
| MAN-003 | Invalid Service file feedback        | ADMIN account; GIF, SVG, empty PNG, file over 2 MiB                | Select each file in Create Service                                                      | Clear JPEG/PNG/WebP 2 MiB error; invalid selection is not retained                 | Not executed  | Not Executed |
| MAN-004 | Profile avatar normalization         | Active account of any fixed role; oriented JPEG under 2 MiB        | Open Profile, choose avatar, preview, save, refresh                                     | Correctly oriented avatar persists and renders                                     | Not executed  | Not Executed |
| MAN-005 | Project-image role boundary          | USER, ADMIN, SUPERADMIN, unlinked STAFF, and linked STAFF accounts | Attempt portfolio project image upload as each actor                                    | Only linked STAFF succeeds; all others receive a safe denial                       | Not executed  | Not Executed |
| MAN-006 | Storage outage recovery              | Test environment with image storage temporarily unavailable        | Attempt Service and avatar uploads, restore storage, retry                              | First attempt shows retryable failure without partial domain write; retry succeeds | Not executed  | Not Executed |

## Remaining gaps

- Live Supabase bucket policy, signed/public URL behavior, CDN caching, and object lifecycle were not exercised.
- Concurrent Service-image replacements and storage deletion failures were not stress-tested.
- Banner and portfolio images intentionally retain legacy storage format; their eventual normalization is outside this branch.
- Full API and full Playwright baselines remain optional broader regression work and must not be reported as passed without execution.
