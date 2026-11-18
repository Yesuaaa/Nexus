import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type { AdministrativeWorkflow } from "../src/features/request-workflow/model/administrative-workflow"
import type { AdministrativeRequest } from "../src/features/request-inbox/api/administrative-requests-api"

configureRegressionTest()
test.skip(
  live,
  "Workflow oversight uses isolated administrative metadata fixtures",
)

const stamp = "2026-11-14T08:00:00Z"
const person = { id: "admin", fullName: "Assigned Approver" }
const workflow: AdministrativeWorkflow = {
  state: "AGREEMENT_PAYMENT_PENDING",
  previousState: null,
  version: 4,
  nextAction:
    "Complete the required payment before the department head assigns staff and activates the service workspace.",
  createdAt: stamp,
  updatedAt: stamp,
  consultationRequired: true,
  consultationComplete: true,
  quotationApprovalRequired: true,
  paymentRequired: true,
  permissions: {
    manage: false,
    isClient: false,
    approveQuotation: false,
    verifyPayment: false,
  },
  capabilities: {
    read: true,
    mutateWorkflow: false,
    participate: false,
    downloadFiles: false,
    activateProject: false,
  },
  quotationApprover: person,
  paymentVerifier: person,
  requirements: [
    {
      id: "requirement",
      title: "Brand assets",
      mandatory: true,
      status: "SUBMITTED",
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
  consultations: [
    {
      id: "consultation",
      status: "COMPLETED",
      startsAt: stamp,
      endsAt: "2026-11-14T09:00:00Z",
      createdAt: stamp,
    },
  ],
  meetings: [
    {
      id: "meeting-1",
      status: "SCHEDULED",
      startsAt: stamp,
      endsAt: "2026-11-14T09:00:00Z",
      createdAt: stamp,
      updatedAt: stamp,
      proposedStartsAt: "2026-11-15T08:00:00Z",
    },
  ],
  quotations: [
    {
      id: "quote",
      version: 1,
      status: "ACCEPTED",
      createdAt: stamp,
      publishedAt: stamp,
      internallyApprovedAt: stamp,
      validUntil: "2026-12-01T00:00:00Z",
    },
  ],
  approval: {
    quotationId: "quote",
    approvedAt: stamp,
    approvedBy: { id: "client", fullName: "Client" },
  },
  agreement: { mandatory: true, status: "APPROVED", reviewedAt: stamp },
  payment: { mandatory: true, status: "SUBMITTED", verifiedAt: null },
  project: {
    id: "project",
    name: "Delivery project",
    status: "PLANNED",
    startDate: null,
    createdAt: stamp,
    staff: [
      {
        employee: {
          id: "staff",
          fullName: "Assigned Designer",
          position: "Designer",
        },
        isTeamLead: true,
        approvedAt: stamp,
        weeklyHours: 20,
        allocationStart: null,
        allocationEnd: null,
      },
    ],
  },
  events: [
    {
      id: "event-1",
      type: "CONSULTATION_OPENED",
      summary: "Consultation opened",
      entityId: null,
      createdAt: stamp,
      actor: { id: "head", fullName: "Department Head" },
      internal: false,
    },
    {
      id: "event-2",
      type: "QUOTATION_INTERNAL_APPROVED",
      summary: "Quotation internally approved",
      entityId: null,
      createdAt: stamp,
      actor: person,
      internal: true,
    },
    {
      id: "event-3",
      type: "PAYMENT_VERIFIED",
      summary: "Payment verification reviewed",
      entityId: null,
      createdAt: stamp,
      actor: person,
      internal: false,
    },
  ],
}
const request: AdministrativeRequest = {
  id: "request-1",
  referenceNumber: "SR-1",
  title: "Workflow inspection",
  status: "UNDER_REVIEW",
  acceptedDepartmentId: "design",
  acceptedBy: { id: "head", fullName: "Department Head" },
  acceptedDepartment: {
    id: "design",
    name: "Design",
    head: { id: "head", fullName: "Department Head" },
  },
  packageName: "Standard",
  expectedTimeline: "Two weeks",
  preferredSpecialistName: null,
  createdAt: stamp,
  updatedAt: stamp,
  service: {
    id: "service",
    name: "Design",
    departments: [{ id: "design", name: "Design" }],
  },
  client: {
    fullName: "Client",
    email: "client@example.test",
    contactNumber: null,
  },
  workflow: { state: workflow.state, updatedAt: stamp },
  project: null,
  capabilities: {
    read: true,
    accept: false,
    reject: false,
    staff: false,
    approveQuotation: false,
    verifyPayment: false,
    mutateWorkflow: false,
    participate: false,
    downloadFiles: false,
  },
}

for (const width of [1440, 390])
  test(`Superadmin inspects workflow metadata and history without participation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await restoreSession(page, "SUPERADMIN")
    const prohibited: string[] = []
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname
      if (
        path.startsWith("/api/") &&
        (request.method() !== "GET" ||
          /^\/api\/(?:request-inbox(?:\/|$)|request-workflows\/(?!notifications$)|request-conversations\/)/.test(
            path,
          ))
      )
        prohibited.push(path)
    })
    await page.route("**/api/administrative-requests?**", (route) =>
      route.fulfill({
        json: { serviceRequests: [], total: 0, page: 1, pageSize: 10 },
      }),
    )
    await page.route("**/api/administrative-requests/request-1", (route) =>
      route.fulfill({
        json: { serviceRequest: { ...request, workflowInspection: workflow } },
      }),
    )
    await page.goto("/module/service-operations?request=request-1")
    const oversight = page.getByRole("region", {
      name: "Administrative workflow oversight",
      exact: true,
    })
    await expect(
      oversight.getByRole("heading", {
        name: "Workflow progress and history",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      oversight.getByLabel("Request progress").locator('[aria-current="step"]'),
    ).toHaveText("Agreement / payment")
    for (const title of [
      "Consultation",
      "Requirements",
      "Quotations and approvals",
      "Agreement and payment verification",
      "Staffing and project activation",
      "Workflow history",
    ])
      await expect(
        oversight.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible()
    await expect(
      oversight.getByText("Pending review", { exact: true }),
    ).toBeVisible()
    await expect(
      oversight.getByText("Quotation version 1", { exact: true }),
    ).toBeVisible()
    await expect(
      oversight.getByText("Assigned Approver", { exact: true }),
    ).toHaveCount(2)
    await expect(
      oversight.getByText("Assigned Designer · Team lead", { exact: true }),
    ).toBeVisible()
    await expect(
      oversight.getByText(/Pending reschedule proposal:/),
    ).toBeVisible()
    await expect(
      oversight.getByText("Payment verification reviewed", { exact: true }),
    ).toBeVisible()
    const history = oversight.getByRole("list", {
      name: "Workflow history events",
      exact: true,
    })
    await expect(history.getByRole("listitem")).toHaveCount(3)
    await expect(history.getByRole("listitem").first()).toContainText(
      "Consultation opened",
    )
    await expect(history.getByRole("listitem").nth(1)).toContainText(
      "Internal workflow event",
    )
    await expect(oversight.getByRole("button")).toHaveCount(0)
    await expect(oversight.getByRole("link")).toHaveCount(0)
    await expect(oversight.getByRole("textbox")).toHaveCount(0)
    await page.reload()
    await expect(
      oversight.getByRole("heading", { name: "Workflow history", exact: true }),
    ).toBeVisible()
    expect(prohibited).toEqual([])
  })

test("on-hold workflow retains its prior stage while revoked backend access clears history", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let denied = false
  await page.route("**/api/administrative-requests?**", (route) =>
    route.fulfill({
      json: { serviceRequests: [], total: 0, page: 1, pageSize: 10 },
    }),
  )
  await page.route("**/api/administrative-requests/request-1", (route) =>
    denied
      ? route.fulfill({
          status: 403,
          json: {
            error: "Organization-wide service request read access is required",
          },
        })
      : route.fulfill({
          json: {
            serviceRequest: {
              ...request,
              workflowInspection: {
                ...workflow,
                state: "ON_HOLD",
                previousState: "READY_FOR_ACTIVATION",
              },
            },
          },
        }),
  )
  await page.goto("/module/service-operations?request=request-1")
  const oversight = page.getByRole("region", {
    name: "Administrative workflow oversight",
    exact: true,
  })
  await expect(
    oversight.getByLabel("Request progress").locator('[aria-current="step"]'),
  ).toHaveText("Activation")
  denied = true
  await page.reload()
  await expect(
    page
      .getByRole("alert")
      .getByText("Organization-wide service request read access is required"),
  ).toBeVisible()
  await expect(oversight).toHaveCount(0)
})
