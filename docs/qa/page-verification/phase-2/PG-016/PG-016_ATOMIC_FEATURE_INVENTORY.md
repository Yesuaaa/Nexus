# PG-016 Atomic Feature Inventory

IDs use PG-016-F001-. All paths are repository-relative. PAGE = apps/web/src/app/(portal)/billing-logs/page.tsx. GATE = apps/web/src/components/layout/portal-layout.tsx:21–91 and apps/web/src/features/workspaces/model/route-policy.ts:707–711. BILLING = apps/api/src/features/request-workflow/workflow.billing.ts:3–85 and workflow.controller.ts:15–24 in the same directory. FILES = apps/api/src/features/request-workflow/workflow.files.ts downloadWorkflowFile and workflow.access.ts:8–57, controller.ts:80–98. PREVIEW = apps/web/src/features/request-workflow/hooks/use-workflow-file-preview.ts:5–50. CLIENT = apps/web/src/features/request-workflow/api/workflow-api.ts:71–90. DIALOG = apps/web/src/components/ui/dialog.tsx. READ = apps/web/src/lib/use-async-resource.ts:39–96.

All UI actors are eligible clients. UI handlers are inline BillingLogsPage, ProofAttachment, downloadSelected and preview hook. All actions are reads, selection or links; no domain mutation.

| ID   | Behavior                            | Evidence                     | Guard, transition, success and failure                                                         |
| ---- | ----------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| A001 | Route admission                     | GATE                         | USER canonical entry; anonymous or inactive session handled by portal; other roles redirected  |
| A002 | Initial billing read                | PAGE 137–155                 | Independent GET, named skeleton, empty/error and reload recovery                               |
| A003 | Due list                            | PAGE 153–258                 | PENDING sorted by accepted date ascending, null dates first                                    |
| A004 | History list                        | PAGE 259–315                 | Nonpending server order, status and sandbox labels                                             |
| A005 | Select details                      | PAGE 245–323                 | Direct buttons set selected payment and clear prior download error                             |
| A006 | Summary and amounts                 | PAGE 330–520                 | Conditional booking/date/reference, multiple line items and fallback service total             |
| A007 | Conversation navigation             | PAGE 525–546                 | Encoded request query and payment fragment, no payment write                                   |
| A008 | Proof preview                       | PREVIEW                      | PNG/JPEG only, identity-keyed URL, enlarge/collapse and cleanup                                |
| A009 | Download and recovery               | PAGE 160–177,547–568; CLIENT | Authenticated file download, disabled while pending, error and retry                           |
| A010 | Billing ownership projection        | BILLING                      | Positive amount, owned request, canceled excludes unverified, decimal and safe file projection |
| A011 | File authorization                  | FILES                        | Current active workflow actor, own visible file only, mismatch or private 404                  |
| A012 | Accessibility and responsive layout | PAGE; DIALOG                 | Named loading and dialogs, direct actions, wrapping, focus and Escape                          |

API actions use GET /api/request-workflows/billing and GET /api/request-workflows/:id/files/:fileId. Backend record scope is independent of page visibility. Failure is an alert for billing/download, silent for preview. Selection and download use local state, and protected data stays in test-owned fixtures for verification.
