# Workload stale assignment cleanup

Goal: Let department heads manage project allocations that became invalid after an employee account was disabled/deleted, the employee went inactive/on leave, or the employee moved departments. Keep those employees out of new-assignment choices.

Decision: Return compact staffing summaries with each authorized project and mark each allocation eligible against the current department roster. Show projects with no eligible allocation or any stale allocation in the existing staffing dialog. Let the head reassign a stale allocation or remove it with the existing confirmation and delete route. Scope replacement/removal to the authorized project, since an employee who moved departments is no longer in the original department roster.

Alternatives considered: Removing stale rows during page load would make a read request destructive and erase allocations without the head's choice. Showing ineligible employees in the regular staff table would weaken the roster filter and could expose capacity actions for accounts that cannot sign in.

Files:

- `apps/api/src/features/workload/workload.controller.ts`: project allocation summaries, stale reassignment validation, project-scoped removal.
- `apps/web/src/features/workload/pages/workload-page.tsx`: surface stale allocations in the staffing dialog and offer reassignment/removal.
- `apps/api/src/request-inbox.test.ts`: cover stale allocation summaries, transferred/deleted employees, and guarded replacement/removal.
- `apps/web/e2e/staff-workload.spec.ts`: cover the department-head cleanup flow.

Tasks:

1. Add failing API regression assertions for stale assignments after account deletion or department transfer.
2. Return assignment identity, employee name, hours, and an eligibility flag; allow replacement/removal only when the assignment belongs to a project routed to the acting head's department.
3. Add a failing browser test for reviewing and removing a stale allocation from the staffing dialog.
4. Implement the dialog actions using the existing confirmation and assignment forms; keep the assignment picker limited to active staff accounts.
5. Run the focused API and browser checks, API/web typechecks, formatting, and diff checks.
