import { expect, test, type Page } from "@playwright/test"
import type { Workflow } from "../src/features/request-workflow/model/workflow"

function fixture(): Workflow {
  return {
    request: {
      id: "request-1",
      referenceNumber: "REQ-2026-1001",
      title: "Business website",
      serviceName: "Website Development",
      packageName: "Business Website",
      pricingModel: "CUSTOM_QUOTE",
      goals: "Reach new customers",
      requirements: "Five accessible pages",
      expectedTimeline: "Six weeks",
      client: { id: "client-1", fullName: "Mara Client" },
      department: { id: "design", name: "Design" },
    },
    state: "CLIENT_APPROVAL",
    previousState: null,
    version: 3,
    nextAction: "Review the latest quotation and record your decision.",
    consultationRequired: false,
    quotationApprovalRequired: false,
    permissions: {
      manage: false,
      isClient: true,
      approveQuotation: false,
      verifyPayment: false,
    },
    requirements: [],
    files: [],
    consultations: [],
    quotations: [
      {
        id: "quote-1",
        version: 1,
        status: "SENT",
        scope: "Design and build a five-page website.",
        deliverables: ["Five accessible pages", "Production deployment"],
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
        validUntil: "2030-12-01T08:00:00.000Z",
        decisionNote: null,
        createdAt: "2026-10-30T08:00:00.000Z",
      },
    ],
    approval: null,
    agreement: null,
    payment: null,
    project: null,
    events: [
      {
        id: "event-1",
        type: "QUOTATION_SENT",
        summary: "The department sent quotation version 1.",
        entityId: "quote-1",
        createdAt: "2026-10-30T08:00:00.000Z",
        actor: { id: "head-1", fullName: "Dani Head" },
      },
    ],
  }
}

async function mock(page: Page, workflow: Workflow) {
  const actions: Record<string, unknown>[] = []
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "workflow-session"),
  )
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: "client-1",
            fullName: "Mara Client",
            email: "client@example.com",
            role: "USER",
            isActive: true,
            permissions: ["dashboard:read", "profile:read"],
            headOf: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      })
    if (url.pathname === "/api/request-conversations")
      return route.fulfill({
        json: {
          conversations: [
            {
              id: workflow.request.id,
              title: workflow.request.title,
              referenceNumber: workflow.request.referenceNumber,
              updatedAt: "2026-10-30T08:00:00.000Z",
              service: { name: workflow.request.serviceName },
              client: workflow.request.client,
              acceptedDepartment: workflow.request.department,
              lastMessage: null,
            },
          ],
          nextCursor: null,
        },
      })
    if (url.pathname === "/api/request-conversations/request-1")
      return route.fulfill({
        json: {
          conversation: {
            department: workflow.request.department,
            head: { id: "head-1", fullName: "Dani Head" },
          },
          canSend: true,
          messages: [],
          nextCursor: null,
        },
      })
    if (url.pathname.endsWith("/events"))
      return route.fulfill({
        contentType: "text/event-stream",
        body: "event: connected\ndata: {}\n\n",
      })
    if (url.pathname === "/api/request-workflows/request-1")
      return route.fulfill({ json: workflow })
    if (url.pathname === "/api/request-workflows/request-1/actions") {
      const body = request.postDataJSON() as Record<string, unknown>
      actions.push(body)
      if (body.type === "RESPOND_QUOTATION") {
        workflow.version++
        workflow.state = "AGREEMENT_PAYMENT_PENDING"
        workflow.nextAction = "Submit the signed agreement and payment proof."
        workflow.quotations[0]!.status = "ACCEPTED"
        workflow.approval = {
          quotationId: "quote-1",
          amount: "25000.00",
          currency: "PHP",
          approvedById: "client-1",
          approvedAt: "2026-10-30T08:05:00.000Z",
        }
        workflow.agreement = {
          id: "agreement-1",
          mandatory: true,
          status: "PENDING",
          documentFileId: null,
          signedFileId: null,
        }
        workflow.payment = {
          id: "payment-1",
          mandatory: true,
          amount: "12500.00",
          currency: "PHP",
          status: "PENDING",
          proofFileId: null,
          reference: null,
        }
        workflow.events.push(
          {
            id: "event-2",
            type: "APPROVAL_CONFIRMED",
            summary: "The client formally accepted quotation version 1.",
            entityId: "approval-1",
            createdAt: "2026-10-30T08:05:00.000Z",
            actor: { id: "client-1", fullName: "Mara Client" },
          },
          {
            id: "event-3",
            type: "AGREEMENT_REQUIRED",
            summary: "An agreement is required.",
            entityId: "agreement-1",
            createdAt: "2026-10-30T08:05:01.000Z",
            actor: null,
          },
          {
            id: "event-4",
            type: "PAYMENT_REQUIRED",
            summary: "A commencement payment is required.",
            entityId: "payment-1",
            createdAt: "2026-10-30T08:05:02.000Z",
            actor: null,
          },
        )
      }
      return route.fulfill({ json: workflow })
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } })
  })
  return actions
}

test("the conversation records formal quotation approval through a structured action", async ({
  page,
}) => {
  const workflow = fixture()
  const actions = await mock(page, workflow)
  await page.goto("/messages?request=request-1")
  await expect(
    page.getByRole("heading", { name: "Website Development", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("list", { name: "Request progress" }),
  ).toBeVisible()
  await page
    .getByRole("checkbox", { name: /I have reviewed this quotation/ })
    .check()
  await page
    .getByRole("button", { name: "Accept quotation", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Quotation formally accepted" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Payment requirement", exact: true }),
  ).toBeVisible()
  expect(actions).toHaveLength(1)
  expect(actions[0]).toMatchObject({
    type: "RESPOND_QUOTATION",
    quotationId: "quote-1",
    decision: "ACCEPT",
    expectedVersion: 3,
  })
  expect(actions[0]!.actionId).toMatch(/^[0-9a-f-]{36}$/)
  await expect(page.getByText("Internal · Department head only")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Activate project", exact: true }),
  ).toHaveCount(0)
})

test("expired quotations have no formal approval controls", async ({
  page,
}) => {
  const workflow = fixture()
  workflow.quotations[0]!.validUntil = "2020-01-01T00:00:00.000Z"
  await mock(page, workflow)
  await page.goto("/messages?request=request-1")
  await expect(
    page.getByRole("heading", { name: "Quotation · version 1" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText(/Expired/)).toBeVisible()
})

test("mobile request context collapses and activated projects have a workspace link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const workflow = fixture()
  workflow.state = "ACTIVE_PROJECT"
  workflow.nextAction = "Open your project workspace."
  workflow.project = {
    id: "project-1",
    name: "Business website",
    status: "IN_PROGRESS",
  }
  workflow.events.push({
    id: "event-2",
    type: "PROJECT_ACTIVATED",
    summary: "The department activated your project.",
    entityId: "project-1",
    createdAt: "2026-10-30T08:10:00.000Z",
    actor: null,
  })
  await mock(page, workflow)
  await page.goto("/messages?request=request-1")
  const context = page.getByRole("complementary", { name: "Request context" })
  await expect(context.locator("details.group\\/context")).not.toHaveAttribute(
    "open",
  )
  await context
    .getByText("Request details and actions", { exact: true })
    .click()
  await expect(
    context.getByText("REQ-2026-1001", { exact: true }),
  ).toBeVisible()
  await context
    .getByText("Request details and actions", { exact: true })
    .click()
  await expect(
    page.getByRole("link", { name: "View Project", exact: true }),
  ).toHaveAttribute("href", "/projects/project-1")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
