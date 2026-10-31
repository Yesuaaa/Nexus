import { expect, test, type Page } from "@playwright/test"
import type { Workflow } from "../src/features/request-workflow/model/workflow"
import { accountFor } from "./regression-support"

function reviewFixture(kind: "quotation" | "payment"): Workflow {
  return {
    request: {
      id: "request-1",
      referenceNumber: "SR-2026-100",
      title: "Business website",
      serviceName: "Website Development",
      packageName: "Business",
      pricingModel: "CUSTOM_QUOTE",
      goals: "Reach customers",
      requirements: "Accessible website",
      expectedTimeline: "Six weeks",
      client: { id: "client", fullName: "Mara Client" },
      department: { id: "design", name: "Design" },
    },
    state:
      kind === "quotation" ? "QUOTATION_PENDING" : "AGREEMENT_PAYMENT_PENDING",
    previousState: null,
    version: 5,
    nextAction:
      kind === "quotation"
        ? "Assigned approver must authorize this quotation."
        : "Verify the submitted commencement payment.",
    consultationRequired: false,
    quotationApprovalRequired: true,
    permissions: {
      manage: false,
      isClient: false,
      approveQuotation: true,
      verifyPayment: true,
    },
    requirements: [],
    consultations: [],
    events: [],
    files: [
      {
        id: "proof",
        name: "payment-proof.pdf",
        mimeType: "application/pdf",
        size: 12,
        uploaderId: "client",
        createdAt: "2026-10-30T10:00:00Z",
      },
    ],
    quotations: [
      {
        id: "quote",
        version: 1,
        status: kind === "quotation" ? "PENDING_INTERNAL" : "ACCEPTED",
        scope: "An accessible five-page website",
        deliverables: ["Design", "Implementation"],
        lineItems: [
          {
            description: "Website delivery",
            quantity: 1,
            unitPrice: "25000.00",
          },
        ],
        total: "25000.00",
        currency: "PHP",
        timeline: "Six weeks",
        paymentTerms: "50% before commencement",
        paymentDue: "12500.00",
        validUntil: "2099-12-31T23:59:59Z",
        decisionNote: null,
        createdAt: "2026-10-30T09:00:00Z",
      },
    ],
    approval:
      kind === "payment"
        ? {
            quotationId: "quote",
            amount: "25000.00",
            currency: "PHP",
            approvedById: "client",
            approvedAt: "2026-10-30T09:30:00Z",
          }
        : null,
    agreement:
      kind === "payment"
        ? {
            id: "agreement",
            mandatory: true,
            status: "APPROVED",
            documentFileId: null,
            signedFileId: null,
          }
        : null,
    payment:
      kind === "payment"
        ? {
            id: "payment",
            mandatory: true,
            amount: "12500.00",
            currency: "PHP",
            status: "SUBMITTED",
            proofFileId: "proof",
            reference: "BANK-123",
          }
        : null,
    project: null,
  }
}

async function mockReview(page: Page, kind: "quotation" | "payment") {
  const workflow = reviewFixture(kind)
  const actions: Record<string, unknown>[] = []
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "review-session"),
  )
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    expect(request.headers().authorization).toBe("Bearer review-session")
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: accountFor("ADMIN") } })
    if (path === "/api/request-workflows/approvals")
      return route.fulfill({
        json: {
          requests: [
            {
              id: workflow.request.id,
              title: workflow.request.title,
              referenceNumber: workflow.request.referenceNumber,
              serviceName: workflow.request.serviceName,
              state: workflow.state,
              awaitingQuotation: kind === "quotation",
              awaitingPayment: kind === "payment",
            },
          ],
        },
      })
    if (path === "/api/request-workflows/notifications")
      return route.fulfill({
        json: {
          notifications: [
            {
              id: "notice",
              requestId: "request-1",
              summary: "Payment evidence awaits your review.",
              type: "PAYMENT_SUBMITTED",
              createdAt: "2026-10-30T10:00:00Z",
              readAt: null,
            },
          ],
          unreadCount: 1,
        },
      })
    if (path === "/api/request-workflows/notifications/notice/read")
      return route.fulfill({ json: {} })
    if (path === "/api/request-workflows/request-1")
      return route.fulfill({ json: workflow })
    if (path === "/api/request-workflows/request-1/files/proof")
      return route.fulfill({
        contentType: "application/pdf",
        body: "%PDF-1.4\n",
      })
    if (path === "/api/request-workflows/request-1/actions") {
      const action = request.postDataJSON() as Record<string, unknown>
      actions.push(action)
      workflow.version++
      if (action.type === "APPROVE_QUOTATION") {
        workflow.quotations[0]!.status = "SENT"
        workflow.state = "CLIENT_APPROVAL"
      }
      if (action.type === "VERIFY_PAYMENT") {
        workflow.payment!.status = "VERIFIED"
        workflow.state = "READY_FOR_ACTIVATION"
      }
      return route.fulfill({ json: workflow })
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } })
  })
  return { workflow, actions }
}

test("assigned approver sends a quotation with a formal idempotent action on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { actions } = await mockReview(page, "quotation")
  await page.goto("/workflow-approvals?request=request-1")
  await expect(
    page.getByRole("heading", { name: "Business website", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("An accessible five-page website", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Send message" })).toHaveCount(
    0,
  )
  await expect(
    page.getByText("Internal staffing", { exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Approve and send quotation" }).click()
  await expect.poll(() => actions.length).toBe(1)
  expect(actions[0]).toMatchObject({
    type: "APPROVE_QUOTATION",
    quotationId: "quote",
    expectedVersion: 5,
  })
  expect(actions[0]!.actionId).toMatch(/^[0-9a-f-]{36}$/)
  await expect(
    page.getByRole("button", { name: "Approve and send quotation" }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test("assigned payment verifier downloads evidence and records manual verification", async ({
  page,
}) => {
  const { actions } = await mockReview(page, "payment")
  await page.goto("/workflow-approvals?request=request-1")
  await expect(
    page.getByText("Reference: BANK-123", { exact: true }),
  ).toBeVisible()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download payment-proof.pdf" }).click()
  expect((await download).suggestedFilename()).toBe("payment-proof.pdf")
  await page
    .getByLabel("Verification note", { exact: true })
    .fill("Bank deposit matched against the statement")
  await page
    .getByRole("button", { name: "Verify payment", exact: true })
    .click()
  await expect.poll(() => actions.length).toBe(1)
  expect(actions[0]).toMatchObject({
    type: "VERIFY_PAYMENT",
    approve: true,
    note: "Bank deposit matched against the statement",
    expectedVersion: 5,
  })
  await expect(
    page.getByRole("button", { name: "Verify payment", exact: true }),
  ).toHaveCount(0)
})

test("notification sends an assigned approver to the relevant workflow", async ({
  page,
}) => {
  await mockReview(page, "payment")
  await page.goto("/workflow-approvals")
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click()
  await page
    .getByRole("menuitem")
    .filter({ hasText: "Payment evidence awaits your review." })
    .click()
  await expect(page).toHaveURL(/\/workflow-approvals\?request=request-1$/)
  await expect(
    page.getByRole("button", { name: "Verify payment", exact: true }),
  ).toBeVisible()
})
