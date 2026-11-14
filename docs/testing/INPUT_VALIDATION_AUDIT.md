# Input Validation Audit: Login Page

**Page:** `/login`  
**Audit scope:** Login form, language selector, and `POST /api/auth/login`  
**Status:** Complete  
**Counting method:** An input surface is a distinct user-editable value or selection. Actions such as submit and password visibility are recorded as controls, not counted as input surfaces. API request properties are reported separately from UI surfaces.

## Executive Summary

- **Overall validation status:** Pass after fixes. The login UI and API reject missing or malformed credentials, preserve valid credential contents, and bound request sizes.
- **Input surfaces identified:** 3 UI surfaces: email, password, and the two-option language selector. The login API accepts 2 credential properties (`email`, `password`) in a JSON request body. The show/hide password control and submit button are additional controls, not data-entry surfaces.
- **Validation issues discovered:** 2.
- **Issues fixed:** 2. The API now rejects an empty password before credential lookup. The form now prevents same-tick repeated submissions with an immediate in-flight guard.
- **Unresolved validation issues:** 0 found in the audited login flow and exercised cases.
- **Test results:** 44 web unit tests passed; 20 API/authentication tests passed, including five login boundary groups against offline PGlite; 2 Chromium login tests passed. `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed. The browser suite used a mocked login response; API behavior was exercised separately against PGlite.
- **Remaining risks:** Login attempt tracking is process-local. Deployments with multiple API replicas need shared rate-limit state for consistent cross-replica protection. The audit does not establish the state or behavior of a production database or deployment.

## Scope and Input Inventory

| Surface             | Location and behavior                                                                                                                                                                      | Validation and test coverage                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Email               | Required `type="email"` field, maximum 254 characters. The login form trims email before sending.                                                                                          | Empty and whitespace-only values, malformed addresses, embedded spaces, oversized values, leading/trailing whitespace, plus tags, international characters, and maximum-length email were covered across unit, browser, or API tests.            |
| Password            | Required password field. Login does not impose registration password complexity or minimum length, preserving compatibility with existing accounts. The API limits it to 1024 UTF-8 bytes. | Empty and missing values, wrong types, whitespace-only and padded values, short existing-style credentials, special characters, Unicode, exact/over byte boundaries, and oversized requests were covered. Padded credentials are sent unchanged. |
| Language selector   | Two choices: English and Filipino. It is a menu with radio menu items, rather than a form value sent to the API.                                                                           | Keyboard navigation, selection, localized required-field feedback, and persistence after reload were covered. Unsupported stored values fall back to English.                                                                                    |
| Password visibility | Show/hide button changes the password input type and does not alter its value.                                                                                                             | Browser test toggled visibility in both directions and verified the credential contents were sent unchanged.                                                                                                                                     |
| Submit              | Form submit control; repeated events while a request is pending are ignored.                                                                                                               | Browser test dispatched ten rapid submit events and observed exactly one API request.                                                                                                                                                            |
| Login request       | `POST /api/auth/login` with JSON body properties `email` and `password`. No multipart or file input is present.                                                                            | API tests covered missing/null/scalar/array/object credential values, malformed JSON, non-object JSON bodies, unsupported content types, oversized request bodies, and query/header/body tampering.                                              |

The login page does not contain name, phone, numeric, date/time, upload, rich-text, search, filtering, pagination, or editable-table inputs. Those categories are not applicable to this page. Registration has additional inputs but is outside this `/login` audit.

## Validation Findings

### Required fields and empty states

The UI displays field-specific errors and blocks submission when email or password is empty. Whitespace-only email is trimmed and treated as missing. Null, undefined/missing, and non-string credential values are rejected at the API boundary. Password whitespace is retained because it can be part of a user's credential; a nonempty whitespace-only password proceeds to authentication and is rejected as invalid credentials unless it is the actual password for that account.

### Types, format, and bounds

The API rejects numeric, boolean, array, and object values for both credential fields. Email is trimmed and lowercased by the server, capped at 254 characters, and checked for a basic valid address shape. Login intentionally allows email suffixes beyond registration's `.com`/`.ph` account-creation rule; existing account credentials must remain usable. Passwords are capped at 1024 UTF-8 bytes, which was checked at the exact boundary and beyond it with multibyte Unicode. Login does not apply the registration-only 12-character and character-class rules.

There are no numeric, integer, monetary, date, enum-selection, array/object-entry, or upload fields in the login form. Request tampering cannot assign a role, active status, token, IP, or user agent through extra JSON properties; the authenticated identity and role come from the matched account and issued session.

### Request and interaction edge cases

The tests exercised malformed JSON, `null` and scalar JSON bodies, array bodies, unsupported text/form/multipart content types, a body over the JSON parser limit, login query parameters, a forged Authorization header, extra privilege/redirect properties, and spoofed forwarding headers during rapid requests. A successful login response does not set an authentication cookie; the web client stores bearer tokens in session storage.

## Issues Found and Fixes

| Issue                                                                                   | Impact                                                                               | Fix                                                                                   | Verification                                                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The API accepted an empty string as a password and performed a credential lookup.       | Empty credentials were not rejected as required-field errors at the server boundary. | Reject zero-length passwords alongside missing, non-string, and over-limit values.    | PGlite API boundary test asserts HTTP 400 for empty and absent values and confirms no session was created. |
| The client relied on asynchronously updated React state to block duplicate submissions. | Multiple submit events in one render cycle could start duplicate requests.           | Add a synchronous in-flight ref guard, set before the request and clear in `finally`. | Chromium test fires ten rapid submit events and verifies one request.                                      |

## Verification Record

- `pnpm format` — passed.
- `pnpm lint` — passed with zero warnings.
- `pnpm typecheck` — passed for web and API.
- Web unit suite — 44 passed.
- API/authentication regression run — 20 passed, including the PGlite login-boundary suite.
- Chromium login validation suite — 2 passed.

## Remaining Risks and Limits

The login failure limiter uses in-process memory, so limits do not coordinate across API replicas and reset when a process restarts. A shared limiter would be needed for consistent protection in a multi-replica deployment. Browser tests mock the login response, while API tests use PGlite; neither constitutes a live-environment authentication or deployment test. No production credentials or live database were used.
