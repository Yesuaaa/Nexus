# Superadmin project administrative management (Phase 3A.2)

Developed: 2026-11-14

Follow-up, 2026-11-15: the previously documented Client-milestone assertion is corrected in [test regression recovery](testing-regression-recovery.md), preserving Client privacy and Staff eligibility checks.

## Action classification and implementation boundary

This classification precedes implementation and applies to existing project actions only.

| Existing action                                                        | Classification                                  | Phase 3A.2 decision                                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Rename a request-linked workspace                                      | Administrative metadata                         | Enable globally using the existing name validation, transaction, locks, archive rule and WORKSPACE_RENAMED event |
| Rename a standalone project without request history                    | Administrative but attribution unsupported      | Defer: existing events require a request; do not invent a new logging feature                                    |
| Create workspace, choose/edit delivery plan                            | Department responsibility / workflow-restricted | Defer pending explicit authority; preserve accepted booking and setup gates                                      |
| Assign staff or team leads, allocate workload                          | Operational / eligibility-restricted            | Defer; preserve department eligibility and membership                                                            |
| Add/update tasks or milestones, upload/remove attachments              | Operational                                     | Defer; inspection never grants contributor identity                                                              |
| Hold, resume, cancel or complete workspace                             | Lifecycle / workflow-restricted                 | Defer administrative override authority; preserve existing transitions, required tasks and deliverable checks    |
| Review/release deliverables                                            | Workflow-restricted                             | Excluded; no approvals or releases                                                                               |
| Client brief/change/cancellation decisions, quotation/payment approval | Ownership / financial responsibilities          | Excluded; no Client impersonation or financial authority                                                         |
| Conversation participation                                             | Operational membership                          | Excluded                                                                                                         |

## Implemented contract

`PATCH /api/administrative-projects/:id/workspace-name` resolves the project's actual workspace on the backend. A grouped workspace renames the group, not its individual workstreams; the UI labels this explicitly. All grouped records must have request history for actor attribution. The existing rule rejects renaming when every project in the workspace is completed or cancelled.

Both module access and organization read remain required, plus Phase 2A administrative MANAGEMENT capability. Capability checks are repeated against the current database actor inside the transaction. The existing Staff rename path retains its own assignment/Department Head authorization. The shared rename persistence records the actual actor on a WORKSPACE_RENAMED event for each affected request-linked project, atomically with the name change.

Administrative responses expose a narrow `capabilities.rename` value based on current authority, workspace membership of the record, archive state, and event availability. `canManage`, `canAssign`, upload, approval, release, participation and file-download flags remain false. The frontend mounts only the explicitly permitted rename form. Errors retain the form input and show the backend validation message.

Existing workflow history must be present for every request-backed member; linked requests without a workflow event parent remain inspectable but cannot be renamed administratively. The transaction creates no new workflow history to make an incomplete record eligible.

Diagnostics, System Logs, administrative lifecycle overrides, operational participation, and all other management actions remain outside this phase. Existing uncommitted work and the previously documented Client-milestone workflow-test failure are preserved.

## Validation

- Format, lint and typecheck passed; the production web build passed.
- 34 selected API tests passed using compiler-emitted JavaScript and the offline PGlite harness (the standard `tsx` runner has an existing OS user-information startup issue).
- All 103 web unit tests passed.
- 14 selected browser tests passed, including rename success, failed-write input retention, missing-capability controls, read-only project inspection, and module entry boundaries.

The previously identified workflow regression that expects internal milestones in Client responses was not rerun in these selected suites and remains separately documented. No selected test failures remain.
