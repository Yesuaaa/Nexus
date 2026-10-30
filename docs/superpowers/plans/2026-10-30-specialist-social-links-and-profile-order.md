# Specialist Social Links and Profile Order Implementation Plan

> **For agentic workers:** Implement the approved specialist profile mockup in small, reviewable steps. Preserve all existing uncommitted work and do not create a commit.

**Goal:** Show configured specialist social links in the profile identity area and order profile content as About, Specialties, then Featured projects.

**Architecture:** Store public social links as employee-owned records. The authenticated profile endpoint returns only HTTPS links with display labels; the client renders them as external links. Keep the existing profile modal and request-selection flow.

**Tech Stack:** Prisma, PostgreSQL, Express, TypeScript, Next.js, React, Tailwind CSS.

**Spec:** `docs/specialist-profiles.md`

## Global Constraints

- Keep the profile modal accessible and aligned with EXP navy, white, and pale blue-gray styles.
- Do not add an admin editing interface or sample social links.
- Only expose links intended for public profile display; open external links with `noopener noreferrer`.
- Do not apply database migrations to the live database or create a Git commit.

## Review Focus

- Missing or invalid social URLs must not render as links.
- Social links must not reveal private employee or account fields.
- Profiles with no social links must retain the existing empty-data behavior without a blank row.
- The visible content order must be profile identity, About, Specialties, Featured projects.

---

### Task 1: Persist and expose specialist social links

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261030220000_specialist_social_links/migration.sql`
- Modify: `apps/api/src/features/services/services.repository.ts`
- Modify: `apps/api/src/features/services/services.service.ts`
- Modify: `apps/web/src/features/services/api/services-api.ts`
- Modify: `docs/specialist-profiles.md`

- [x] Add an employee-owned social-link model with platform label, HTTPS URL, and display order; add a non-destructive migration.
- [x] Select only ordered social-link fields in the profile query; map valid HTTPS links to the public profile DTO.
- [x] Update frontend types and document migration/setup and public-link behavior.
- [x] Regenerate the Prisma client, format changed files, and run lint and API/web type checks.

### Task 2: Match the approved profile layout

**Files:**

- Modify: `apps/web/src/features/services/components/specialist-profile-dialog.tsx`

- [x] Add the conditional Socials row beneath the department in the profile identity area; use accessible external-link labels and safe new-tab attributes.
- [x] Place the existing Specialties section before Featured projects, after About.
- [x] Run formatting, lint, and type checks for the web app.
