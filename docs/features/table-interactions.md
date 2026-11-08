# Shared table interactions

Account Management is the interaction reference for directory tables.

- Search previews known matches immediately, including when backspacing or clearing the input. Server searches still provide the authoritative result and total.
- Search resets pagination to the first page. Preview records are scoped to the current filters, sort, archive view, and mutation revision.
- Superseded server requests are aborted and their responses cannot replace the latest results.
- Search uses the faster row transition; page, filter, and sort changes use the standard transition. Rows retain their slots during transitions, and outgoing rows are inert and hidden from assistive technology.
- Pagination summaries update after rows settle. A search-in-progress message replaces the summary while a partial preview is displayed.
- Reduced-motion preferences remove horizontal movement and stagger.

## Components

Use `AnimatedSlotGridBody` for responsive grid tables and mobile record lists. Use `AnimatedTableBody` for semantic HTML tables; it freezes outgoing cell widths to preserve column alignment.

Use `useTableSearch` to record accepted server rows and derive immediate previews. Pass a scope containing every non-search filter and the mutation revision, and a matcher that covers the endpoint's searchable fields. An empty preview is not a confirmed empty server result.

Use `useTableFooter` and pass its `onRowsSettled` callback to the body. Display the returned footer result and disable page controls while loading or while that result differs from the current result.

## Coverage

The shared interaction applies to accounts, clients, employees, departments, services, booked services, request inbox, client service requests, staff workload, project workspaces, project teams, project tasks, project deliverables, and related client records. Tables retain their existing fields, actions, permissions, and responsive layouts. Static quotation pricing breakdowns have no directory controls.

Regression coverage is in `apps/web/e2e/table-interactions.spec.ts`, the existing feature browser suites, and `apps/web/test/table-search.test.mjs`.
