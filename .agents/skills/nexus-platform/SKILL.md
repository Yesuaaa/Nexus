---
name: nexus-platform
description: Repository-specific development standards and architectural references for Converyn (Nexus workspace). Use when implementing, refactoring, reviewing, or documenting features across apps/web, apps/api, or apps/mobile.
---

# Converyn development

Converyn is the product in this Nexus workspace. Package names and this skill identifier retain Nexus; do not rename technical identifiers during ordinary feature work.

## Discover before changing

Read applicable `AGENTS.md` files, inspect the working tree, and trace affected routes, services, schema, components, and tests. Preserve unrelated user changes. Follow `apps/web/AGENTS.md` when writing Next.js code, including reading relevant installed framework guides.

Read [repository architecture](references/architecture.md) for boundaries and commands, and [module references](references/modules.md) for the affected domains. The [dated audit](references/audit.md) records corrections and snapshot limitations.

Documentation and roadmaps describe the product; they are not feature allowlists. Missing documentation, an old phase boundary, or an unimplemented module flag does not prohibit authorized new work. Discover requirements and design an appropriate extension. Distinguish implemented, partial, planned, and experimental behavior; a page, schema field, mock, or design document alone does not prove an end-to-end implementation. Qualify committed/deployed status separately.

## Universal development standards

- Use strict TypeScript; do not introduce `any`. Validate untrusted input and narrow `unknown`. Reuse existing DTOs, validation, error handling, and feature conventions. Do not suppress checks to hide defects.
- Keep business code under `src/features/<feature>/`, grouped by responsibility. Separate HTTP orchestration, business logic, and persistence; follow neighboring filenames rather than imposing a parallel structure. Create only necessary folders.
- Reuse existing layout, tables, forms, panels, dialogs, hooks, loading/error states, and primitives before creating alternatives. Keep new feature-specific business components in their feature. Existing shared composites in `components/ui` do not require unrelated file moves.
- Use Tailwind v4, established shadcn/Radix primitives, EXP navy tokens, Inter, and Sileo feedback patterns. Preserve responsive layout, accessible labels, keyboard/focus behavior, and pending/error feedback. Do not introduce Tailwind v3 configuration or duplicate the design system.
- Keep App Router entry points thin where practical. Server Components are the default, but client route entry points exist. Use `"use client"` at appropriate interactive boundaries; do not mark every route or imported hook file indiscriminately.
- Use the existing authenticated API client and same-origin `/api/...` routing. Do not hardcode backend origins or create duplicate Next.js business/auth endpoints. Keep Prisma and database/storage secrets in the API.
- Store web access and refresh tokens in `sessionStorage` only. Do not introduce localStorage token persistence or cookie authentication. Preserve refresh, logout, session revocation, and current-account checks.
- Enforce authorization on backend routes/services and mirror it in frontend navigation/actions. UI visibility and module access never authorize records or mutations. Reuse permission/capability helpers plus ownership, membership, assignment, active-account, and workflow-state checks. Never trust client-supplied actor, role, or assignment claims.
- Preserve fixed roles `SUPERADMIN`, `ADMIN`, `STAFF`, `USER`. Nobody may change their own role or active status. Only Superadmins reset other accounts' passwords. Administrative authority does not confer operational identity, client decision authority, private-chat participation, or unrestricted attachment access.
- Use the shared Prisma instance in `apps/api/src/lib/db.ts` and generated client/types under `apps/api/src/generated/prisma`. Wrap dependent writes and their required history in a Prisma `$transaction`. Preserve referential integrity, rollback, idempotency, and concurrency protections. Run `pnpm db:generate` after any `schema.prisma` change.
- Preserve data minimization, explicit response projections, upload restrictions, protected file access, cache controls, and secret handling. Never log credentials/tokens or put unrestricted personal snapshots into management history. Keep reads free of domain writes or silent integrity repair; session activity bookkeeping is separate.

## Phased implementation

Require phases for substantial changes spanning modules, permissions, schema/data lifecycle, or workflow/UI redesign. A small local fix can use one bounded phase.

1. **Discover and define:** State the desired outcome, included/excluded scope, affected contracts and authorization rules, acceptance criteria, risks, and validation. Identify unresolved product decisions rather than silently inventing policy.
2. **Implement a bounded slice:** Before each phase, state its deliverable, dependencies, affected files/domains, checks, and stopping point. Prefer reviewable increments with coherent working behavior. Avoid unrelated redesigns and speculative scaffolding.
3. **Validate and reconcile:** Run relevant checks/tests, inspect the diff, and update affected references. Record implemented, deferred, experimental, or blocked work. A failing check or unresolved data/authorization issue stops dependent work; do not weaken requirements to pass.
4. **Continue within authorization:** Respect explicit user phase limits for the current task. Otherwise proceed through authorized phases after validation; an old document saying “stop after Phase X” does not require renewed permission. Pause dependent work for material unresolved requirements or genuinely missing authorization.

## Testing and handoff

- Add/update meaningful behavioral tests for business logic, RBAC, ownership/membership denial, transitions, and lifecycle changes. Cover success, invalid input, forbidden access, and rollback proportionally to risk; reuse fixtures. Documentation-only edits need content/link checks and the mandatory gate, not artificial application tests.
- API tests belong in `apps/api/tests/`, use offline `@electric-sql/pglite` and `tests/support/pglite-app.ts`, and must not touch live databases. Web unit tests belong in `apps/web/test/`; Playwright specs in `apps/web/e2e/`. Use isolated mocks or Express/PGlite browser fixtures. Live regression mode is a separate explicit workflow.
- Before declaring completion, run `pnpm format`, `pnpm lint`, and `pnpm typecheck`; all must exit 0. Run relevant tests and `pnpm build` when runtime/build behavior changes. Inspect formatter changes to preserve the authorized scope.
- Resolve failures within scope. If a pre-existing failure requires prohibited application edits, report the exact blocker and incomplete verification rather than changing unrelated code or claiming completion. Report checks actually run; historical results are not current validation.

## Maintain references

When verified architecture or business rules change, update the affected skill reference and domain documentation (such as `docs/rbac.md` or an existing `docs/features/` record) in the same change. Add a focused reference for a new domain when useful and link it from this skill or its module index. Prior documentation is never a prerequisite for implementation.

Keep universal standards here and domain detail in references. Avoid copied schema inventories and pinned dependency catalogs. If code, tests, instructions, and documentation disagree, inspect and describe the discrepancy; do not silently canonize a security regression or alter product behavior just to match old prose.
