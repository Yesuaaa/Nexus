# Specialist Profiles

Clients can open **View profile** from a specialist card in the final service-request step. Viewing a profile or a portfolio project does not change their current preference. Choosing a specialist from the modal updates the preference and returns to the review screen; it does not submit the request or book the specialist.

## Profile Contents

- The specialist's existing name, position, and department.
- An optional public biography, profile image, and specialties.
- Optional public social links, shown with the profile identity when configured.
- A featured-project gallery with thumbnails, summaries, and the specialist's contribution.
- An inline project detail view, with an external project link when one is provided.
- Loading, retry, missing-information, and empty-portfolio states.

The interface uses initials and neutral image placeholders when media is missing or fails to load. It does not generate biographies, skills, project work, ratings, or availability claims. Selecting a preferred specialist remains subject to department approval.

## Data and Access

`GET /api/services/:serviceId/specialists/:specialistId` requires an authenticated session. The specialist must be an active employee with an active, undeleted Staff account in one of the active service's departments. Unrelated, inactive, archived, and missing specialists return 404.

The endpoint explicitly selects the profile fields intended for clients. It does not return employee email, phone number, login credentials, HR identifiers, or ordinary client project records.

The public biography, image URL, and specialties are stored as `Employee.profileBio`, `profileImageUrl`, and `profileSpecialties`. These fields are separate from private employee/contact information and should contain only material intended for client viewing.

`SpecialistPortfolioProject` stores portfolio entries belonging to an employee. Entries are hidden by default (`isPublished = false`). The profile returns up to 12 published entries in display order, with newer entries first for tied display positions. Draft entries and another specialist's entries are excluded.

`SpecialistSocialLink` stores a platform label, URL, and display order for each link the employee intends to share publicly. The profile returns up to eight links in display order and omits invalid URLs, empty platform labels, and duplicates. No social row is displayed when no valid links are configured.

Portfolio entries are deliberately separate from operational `Project` records: a completed client engagement is not automatically published to a specialist's profile. Populate and publish only approved portfolio material. This feature provides the client viewer and persistence model; a staff/admin portfolio-editing screen is not included.

## Images and Project Links

Only HTTPS URLs without embedded credentials are returned for profile images, thumbnails, external project links, and social links. Images must also use the application's existing allowed image hosts, such as Supabase Storage. The Content Security Policy is not broadened by this feature.

External project and social links open in a new tab with `noopener noreferrer`. Project summaries and contributions render as text. A project without an external URL can still be viewed inside the modal.

## Database Setup

Apply pending specialist-profile migrations before deploying the API changes. `prisma migrate deploy` applies the portfolio migration and the social-links migration in order:

```sh
pnpm --filter @nexus/api exec prisma migrate deploy
```

The migrations add optional employee profile columns, a portfolio table, and a social-links table. They do not insert sample profiles, publish projects, change client records, or revoke sessions. Regenerate the Prisma client and rebuild/restart the API after applying them. The migrations are not applied to the live database as part of this implementation.
