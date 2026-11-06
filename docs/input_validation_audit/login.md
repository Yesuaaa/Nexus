# Login Input Validation Audit

[Back to audit summary](README.md)

**Page:** `/login`  
**Audit date:** 2026-11-06

## Input inventory and rules

| Surface                        | Behavior and validation                                                                                                                                                                                                                      | Coverage and scope                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email                          | Required `type="email"`, maximum 254 characters. The client trims the value; the API normalizes case and Unicode and canonicalizes internationalized domains. Login accepts general valid email suffixes so existing accounts remain usable. | Empty, whitespace-only, malformed, wrong-type, oversized, padded, plus-tagged, Unicode, and exact-boundary values are covered by web/API tests.                  |
| Password                       | Required password field. Login preserves the exact submitted value and does not apply registration-only minimum length or character composition rules. The API limits passwords to 1024 UTF-8 bytes.                                         | Missing, null, non-string, empty, whitespace, padded, Unicode, exact-byte-boundary, oversized, and malformed body cases are covered by API tests.                |
| Language selector              | English or Filipino. It changes page copy and is not sent to the API.                                                                                                                                                                        | Language handling exists in the auth page; browser interaction could not be rerun in this environment.                                                           |
| Password visibility and submit | Show/hide changes the password input presentation. A synchronous in-flight guard ignores duplicate submit events.                                                                                                                            | These are controls, not input surfaces. Existing Playwright coverage could not be executed in this environment.                                                  |
| Login request                  | `POST /api/auth/login`, JSON body containing only `email` and `password`; no multipart body or authentication cookie is used.                                                                                                                | API checks covered missing/null/scalar/array/object values, malformed JSON, unsupported content types, oversized requests, and privilege/header/query tampering. |

There are no name, phone, numeric, date/time, upload, rich-text, search/filter, pagination, or editable-table fields on Login.

## Required fields, types, and boundaries

- Email and password are required. Whitespace-only email is trimmed and treated as missing. Password whitespace is retained because it may be part of an existing user's credential.
- The API rejects missing, null, non-string, array, and object credentials. Login passwords are limited to 1024 UTF-8 bytes; registration-only complexity and minimum-length rules do not apply.
- Extra JSON properties cannot set a role, active status, redirect, token, IP, or user agent. Identity and role come from the matched account and issued session.
- No dates, numbers, enums, arrays, files, or optional form inputs apply to this page.

## Issues found and fixes

|   # | Issue                                                                             | Fix                                                                                 | Verification                                                                           |
| --: | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
|   1 | The API accepted an empty string as a password and performed a credential lookup. | Reject zero-length passwords along with missing, non-string, and over-limit values. | PGlite login boundary test.                                                            |
|   2 | React state alone did not prevent same-tick duplicate submissions.                | Use a synchronous in-flight ref guard around the request.                           | Guard is present; the Playwright rapid-submit check could not run in this environment. |

## Verification

- Web auth validation tests: 8 passed across Login and Register validation.
- PGlite API login boundary suite: 6 passed, including email domains outside the registration-only `.com`/`.ph` rule.
- Shared auth schema, typecheck, lint, and formatting checks passed; see the [summary](README.md) for command limitations.

## Remaining risk

The Login failure limiter is process-local. Deployments with multiple API replicas need shared rate-limit state for consistent cross-replica protection. Browser keyboard, focus, and submit interactions remain unverified in this sandbox because Playwright could not spawn its worker.
