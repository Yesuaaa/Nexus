# Superadmin authorization foundation (Phase 2A)

Developed: 2026-11-14

The subsequent [Phase 2B module registration](superadmin-module-registration.md) connects module-access capability to administrative entry points. The operational boundaries defined here remain in place.

Phase 2A defines administrative capabilities separately from operational eligibility. It adds explicit grants and reusable backend checks, without connecting them to module navigation or individual workflows. Current module availability remains documented in [Role access by module](module-role-access.md).

## Administrative authority

The existing permission catalog explicitly grants these capabilities to Superadmin only:

| Capability                       | Permission                       | Intended scope                                                                                                  |
| -------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Module access                    | `modules:access-all`             | Administrative entry to existing and future modules when integrated                                             |
| Organization-wide read           | `organization:read-all`          | Administrative visibility across departments                                                                    |
| Administrative management        | `administration:manage-all`      | Explicitly supported administrative actions, subject to domain validation                                       |
| Business-conversation inspection | `conversations:inspect-business` | Inspection of operational conversations, separate from participation; excludes private internal direct messages |

`hasAdministrativeCapability(actor, capability)` checks active, non-retired account state and delegates to the existing `hasPermission()` mapping. It accepts only these four capabilities and denies unknown values. There is no role wildcard, permission wildcard, change to `requireRole()`, or automatic grant of future permission strings.

Admin, Staff, and Client retain their exact existing permission sets. Their existing feature permissions and scoped access remain independent of these global grants. Effective account responses include the new Superadmin permissions through the existing `permissionsFor()` serializer; the frontend catalog recognizes the same names without changing its access helpers.

## Operational eligibility

`hasOperationalCapability(actor, access)` checks the active account's role and its relationship to the current resource:

| Capability                         | Required relationship                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Assigned Staff operation           | `STAFF` and matching `assignedUserId`                                          |
| Assigned Department Head operation | `STAFF` and matching `headUserId`                                              |
| Employee self-service              | `STAFF` or `ADMIN` and matching linked `employeeUserId`                        |
| Client decision                    | `USER` and matching owning `clientUserId`                                      |
| Conversation participation         | Actor explicitly present in the conversation's authorized `participantUserIds` |

These facts must come from current server-side queries scoped to the resource, never from request claims. A matching identity establishes base eligibility only. Department alignment, Employee status, valid assignments, channel eligibility, workflow stages, sharing, financial approvals, self-review prohibitions, and concurrency rules remain enforced by each feature. A Department Head assignment remains a Staff responsibility, not a new role.

Superadmin's administrative grants never make it Staff, an Employee, a Department Head, a project contributor, or a Client. Superadmin can participate in an internal conversation when it is already an authorized participant; inspection does not enroll it or permit sending on another person's behalf.

## Integration contract for later phases

1. Keep `requireAuth()` and current database-role evaluation in front of protected operations.
2. At an explicitly administrative entry point, check the relevant administrative capability. Ordinary-role paths continue to use their existing feature permissions and scope checks.
3. For operational actions, resolve current assignments/ownership and check operational eligibility in addition to all feature-specific rules. Never replace these checks with administrative management authority.
4. Keep read-only business-conversation inspection separate from participation, sending, and read receipts.
5. Register future modules with administrative entry points using the module-access capability. Phase 2A does not implement that registry or alter route policies.

No module workflow, financial approval, Client ownership, Staff assignment, private-message policy, or Employee eligibility rule is changed. Diagnostics and System Logs are outside this phase.

## Verification

Focused unit tests cover global authority, operational role/identity boundaries, unavailable accounts, and denial of unsupported capabilities. Offline PGlite integration coverage exercises the existing authentication and permission middleware with an unassigned Superadmin, current-role changes, and inactive/retired accounts. The role-policy regression locks unchanged ordinary-role permissions and preserves the operational expansion already present in the working tree.

Implementation: [capability checks](../../apps/api/src/features/auth/auth.capabilities.ts), [permission mapping](../../apps/api/src/features/auth/auth.permissions.ts), [unit tests](../../apps/api/tests/features/auth/capabilities.test.ts), and [offline integration test](../../apps/api/tests/features/auth/capabilities-integration.test.ts).
