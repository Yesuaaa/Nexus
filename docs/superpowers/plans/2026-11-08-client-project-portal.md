# Client Project Portal Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Give clients a Projects page with project progress, editable briefs, published deliverables, review actions, and tracked change requests.

**Architecture:** Extend the existing authenticated Projects API and Prisma project records. Keep staff project-workspace access unchanged, add client-only routes and screens, and scope every mutation to the owning client or the responsible department head.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, shadcn/Radix, Express, Prisma, PostgreSQL.

**Spec:** Client Projects mockups and decisions in this conversation; match the existing EXP portal and staff Project Workspace conventions.

## Global Constraints

- Client pages expose only Overview and Deliverables.
- Project and deliverable details open as full pages; brief editing uses a right-side panel.
- Clients only see projects activated for their own account and files explicitly shared with them.
- Department Heads alone can resolve project change requests; clients can approve or request a revision for a published deliverable.
- Keep the feature uncommitted on the current client-project branch.

## Review Focus

- Cross-client project or file access: every API read/write must verify ownership and activation.
- Unpublished file leakage: previews and downloads must require an explicitly client-visible file.
- Duplicate/stale review state: tie client deliverable decisions to the exact submitted file.
- Invalid change decisions: only the owning Department Head may accept or decline a request.
- Empty and failed loading states: client pages should explain when there are no active projects or shared deliverables.

---

### Task 1: Project and client-review API

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261106130000_project_workspace/migration.sql`
- Create: `apps/api/prisma/migrations/20261107110000_project_deliverables/migration.sql`
- Create: `apps/api/prisma/migrations/20261108120000_client_project_interactions/migration.sql`
- Modify: `apps/api/src/features/projects/projects.service.ts`
- Modify: `apps/api/src/features/projects/projects.controller.ts`

- [x] Add the compatible project-plan fields, deliverable fields, client-review history, and project change-request records.
- [x] Add client-only project list, brief update, change request, shared-file read, and review endpoints.
- [x] Add Department Head-only accept/not-approve actions for change requests.
- [x] Generate the Prisma client and ensure all mutation paths check ownership, activation, and current state.

### Task 2: Client Projects and project pages

**Files:**

- Create: `apps/web/src/app/(portal)/projects/page.tsx`
- Create: `apps/web/src/features/projects/pages/client-projects-page.tsx`
- Create: `apps/web/src/features/projects/pages/client-project-page.tsx`
- Modify: `apps/web/src/features/projects/api/projects-api.ts`
- Modify: `apps/web/src/components/layout/sidebar.tsx`

- [x] Add the client Projects navigation and activated-project list with search, status filtering, counts, and empty/loading/error states.
- [x] Add project Overview and Deliverables tabs, brief edit drawer, request-change modal, and conversation action.

### Task 3: Deliverable details and review flow

**Files:**

- Create: `apps/web/src/app/(portal)/projects/[id]/deliverables/[milestoneId]/page.tsx`
- Create: `apps/web/src/features/projects/pages/client-deliverable-page.tsx`
- Modify: `apps/web/src/features/projects/api/projects-api.ts`

- [x] Add a full-page published deliverable view, authenticated preview/download, approve confirmation, revision-reason modal, and per-file review status/history.

### Task 4: Department Head request resolution and handoff checks

**Files:**

- Modify: `apps/web/src/features/projects/pages/project-page.tsx`
- Modify: API files above as needed.

- [x] Show pending project change requests to the responsible Department Head and support accept/not-approve with a response.
- [x] Run the repository-required formatter, linter, and typecheck; inspect the final diff and leave the branch uncommitted.
