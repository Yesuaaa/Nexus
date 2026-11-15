# Skill audit — 2026-11-15

## Scope and structure

Audit the existing nexus-platform skill against Converyn source and change skill documentation only. The tree contains substantial pre-existing modified/untracked application, schema, test, and documentation work; inspection includes it, without claiming committed/deployed status.

Proposed before editing: keep universal standards and phased workflow in `SKILL.md`; put repository boundaries/commands in `references/architecture.md`, module rules/status in `references/modules.md`, and dated discrepancies here. Preserve the skill identifier for compatibility.

## Outdated information and verified replacements

| Previous guidance                                                                  | Correction / repository evidence                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nexus is the product name throughout                                               | User identifies Converyn; package/workspace/mobile/skill identifiers retain Nexus. No technical rename is needed.                                                                         |
| Projects/tasks and attendance are upcoming                                         | Mounted routers, web features, schema models, and tests implement projects/workspaces/deliverables, workload, and attendance. Payroll remains separate.                                   |
| Mobile provides business companion workflows                                       | Common `App.kt` contains greeting/demo UI. Build targets exist, but the claimed business workflows do not.                                                                                |
| Admin manages basic accounts                                                       | `auth.permissions.ts` grants `accounts:*` only to Superadmin; Employee/Client provisioning uses feature-specific authorization.                                                           |
| Superadmin has unrestricted full access                                            | `auth.capabilities.ts` distinguishes administration from operational scope; messaging services/privacy tests preserve participation/file/private-DM boundaries.                           |
| Every employee creation provisions a new Staff login                               | `employee-creation.service.ts` also supports existing-account profile attachment.                                                                                                         |
| All phone numbers require PH mobile format                                         | Shared validators distinguish generic contacts from Employee mobile numbers.                                                                                                              |
| Employee IDs allow arbitrary 2–40-character safe strings                           | `employees.schema.ts` additionally requires `EXP-`.                                                                                                                                       |
| Email validation is identical across tiers                                         | API `normalizedEmail` and web `EMAIL_PATTERN` differ; documented without changing policy.                                                                                                 |
| Small model catalog including `AuditLog` describes schema                          | Current schema has broad operational models and scoped `AccountManagementChange` / `WorkforceManagementChange`; old `AuditLog` is absent. Reference schema instead of copying fields.     |
| Session model described with opaque `tokenHash`                                    | Auth now uses JWT access tokens, refresh tokens, and database session/current-account checks.                                                                                             |
| Every App Router route is a Server Component                                       | Billing logs and other existing entries explicitly use `"use client"`; server remains the default.                                                                                        |
| One exact backend routes/validation/controller/service layout                      | Controllers often mount routes directly with feature-prefixed schema/service/repository files; some forwarding entry points remain. Preserve responsibility boundaries/local conventions. |
| Browser tests use mocked API only                                                  | Default suites also use real offline Express/PGlite fixtures. API tests compile before native Node execution.                                                                             |
| Finance/payroll/analytics roadmap implies one uniform status                       | Registry marks finance unimplemented while workflow billing/proof and sandbox handling exist; overview displays do not establish a complete analytics suite.                              |
| Standards/domain/version catalogs mixed together; no phase or maintenance workflow | Split focused references, preserve valid standards, require bounded substantial phases and reference updates, and explicitly support unplanned features.                                  |

## Limits

Inspection covered manifests, schema/model inventory, mounted routers, permissions/capabilities, registry/route policy, auth/session code, validation, Employee lifecycle/creation, billing wiring, shared components, test runners/configuration, CI, mobile starter source, and domain records. This is not an exhaustive runtime/security certification.

Existing README setup prose and the neighboring ci-readiness skill contain starter-era wording or legacy path assumptions. They are outside this skill-only change; architecture references caution readers to verify them. Existing historical feature records remain unchanged. Their test results are not current validation, and their stopping points are not global restrictions.

Run the mandatory format/lint/typecheck gate and report actual results at handoff. Verify links and confirm application/schema files stayed unchanged. No migration, seed, live database request, deployment, or functionality change is part of this audit.
