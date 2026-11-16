import { expect, test, type Locator } from "@playwright/test"
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
const longDescription =
  "Consultation review details require additional follow-up. ".repeat(7).trim()
const longActor = "Department Head with an intentionally long displayed name "
  .repeat(4)
  .trim()
const additionalEvents: AdministrativeWorkflow["events"] = Array.from(
  { length: 8 },
  (_, index) => ({
    id: `event-extra-${index + 1}`,
    type: "CONSULTATION_COMPLETED",
    summary: `Consultation follow-up ${index + 1}`,
    entityId: null,
    createdAt: new Date(
      Date.parse("2026-11-14T10:00:00Z") + index * 60_000,
    ).toISOString(),
    actor: person,
    internal: false,
  }),
)
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
    {
      id: "event-4",
      type: "CONSULTATION_COMPLETED",
      summary: longDescription,
      entityId: null,
      createdAt: "2026-11-14T09:00:00Z",
      actor: { id: "long-name", fullName: longActor },
      internal: false,
    },
    ...additionalEvents,
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

async function expectContentAboveFooter(
  content: Locator,
  panel: Locator,
  footer: Locator,
) {
  await content.scrollIntoViewIfNeeded()
  const [contentBox, panelBox, footerBox] = await Promise.all([
    content.boundingBox(),
    panel.boundingBox(),
    footer.boundingBox(),
  ])
  if (!contentBox || !panelBox || !footerBox)
    throw new Error("Drawer content should be measurable.")
  expect(contentBox.y).toBeGreaterThanOrEqual(panelBox.y)
  expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(
    panelBox.y + panelBox.height,
  )
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(footerBox.y)
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 1000 },
  { width: 390, height: 560 },
])
  test(`Superadmin inspects workflow metadata and history without participation at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
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
    await page.route("**/api/administrative-requests/request-1", (route) =>
      route.fulfill({
        json: { serviceRequest: { ...request, workflowInspection: workflow } },
      }),
    )
    await page.goto("/module/service-operations?request=request-1")
    const drawer = page.getByRole("dialog", {
      name: "Workflow inspection",
      exact: true,
    })
    const drawerHeader = drawer.locator(":scope > header")
    const drawerBody = drawer.locator(":scope > div")
    const drawerTabs = drawer.getByRole("tablist", {
      name: "Request details sections",
    })
    const drawerFooter = drawer.locator(":scope > footer")
    const doneButton = drawerFooter.getByRole("button", {
      name: "Done viewing request details",
    })
    await expect(drawerHeader).toBeVisible()
    await expect(drawerFooter).toBeVisible()
    await expect(doneButton).toBeInViewport()
    await expect
      .poll(() =>
        drawerTabs.evaluate((tabs) => getComputedStyle(tabs).backgroundColor),
      )
      .not.toBe("rgba(0, 0, 0, 0)")
    await expect(
      drawerTabs.getByRole("tab", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-selected", "true")
    const overviewPanel = drawer.getByRole("tabpanel")
    const [overviewTabBox, overviewPanelBox, overviewFooterBox] =
      await Promise.all([
        drawerTabs.boundingBox(),
        overviewPanel.boundingBox(),
        drawerFooter.boundingBox(),
      ])
    if (!overviewTabBox || !overviewPanelBox || !overviewFooterBox)
      throw new Error("Overview drawer layout should be measurable.")
    expect(overviewPanelBox.y).toBeGreaterThanOrEqual(
      overviewTabBox.y + overviewTabBox.height,
    )
    expect(overviewPanelBox.y + overviewPanelBox.height).toBeLessThanOrEqual(
      overviewFooterBox.y,
    )
    if (viewport.height <= 560) {
      const overviewSize = await overviewPanel.evaluate((panel) => ({
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
      }))
      expect(overviewSize.scrollHeight).toBeGreaterThan(
        overviewSize.clientHeight,
      )
      const overviewNote = overviewPanel.getByText(
        "Administrative inspection only. Department actions, private conversations, and restricted files remain unavailable.",
        { exact: true },
      )
      await expectContentAboveFooter(overviewNote, overviewPanel, drawerFooter)
    }
    await drawer.getByRole("tab", { name: "Workflow", exact: true }).click()
    const workflowPanel = drawer.getByRole("tabpanel")
    const [workflowTabBox, workflowPanelBox, workflowFooterBox] =
      await Promise.all([
        drawerTabs.boundingBox(),
        workflowPanel.boundingBox(),
        drawerFooter.boundingBox(),
      ])
    if (!workflowTabBox || !workflowPanelBox || !workflowFooterBox)
      throw new Error("Workflow drawer layout should be measurable.")
    expect(workflowPanelBox.y).toBeGreaterThanOrEqual(
      workflowTabBox.y + workflowTabBox.height,
    )
    expect(workflowPanelBox.y + workflowPanelBox.height).toBeLessThanOrEqual(
      workflowFooterBox.y,
    )
    const initialChrome = {
      header: await drawerHeader.boundingBox(),
      tabs: workflowTabBox,
      footer: workflowFooterBox,
    }
    const workflowSize = await workflowPanel.evaluate((panel) => ({
      clientHeight: panel.clientHeight,
      overflowY: getComputedStyle(panel).overflowY,
      scrollHeight: panel.scrollHeight,
    }))
    expect(workflowSize.overflowY).toBe("auto")
    await expect
      .poll(() =>
        drawerBody.evaluate((body) => getComputedStyle(body).overflowY),
      )
      .toBe("hidden")
    if (viewport.height <= 560)
      expect(workflowSize.scrollHeight).toBeGreaterThan(
        workflowSize.clientHeight,
      )
    await expect(
      workflowPanel.getByRole("heading", {
        name: "Current workflow",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      workflowPanel.getByText(workflow.nextAction, { exact: true }),
    ).toBeVisible()
    await expect(
      workflowPanel.getByRole("heading", {
        name: "Workflow history",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      workflowPanel.getByLabel("Recorded workflow timeline").locator("li"),
    ).toHaveCount(13)
    await expect(
      workflowPanel.getByText("Payment verification reviewed", { exact: true }),
    ).toBeVisible()
    const history = workflowPanel.getByRole("list", {
      name: "Recorded workflow timeline",
      exact: true,
    })
    await expect(history.getByRole("listitem")).toHaveCount(13)
    await expect(history.getByRole("listitem").nth(1)).toContainText(
      "Consultation opened",
    )
    await expect(history.getByRole("listitem").nth(2)).toContainText(
      "Internal workflow event",
    )
    const longEvent = history
      .getByRole("listitem")
      .filter({ hasText: longDescription })
    await expect(longEvent).toHaveCount(1)
    await expect(longEvent).toContainText(longDescription)
    await expect(longEvent).toContainText(longActor)
    await expect(
      longEvent.getByText("Consultation", { exact: true }),
    ).toBeVisible()
    await expect(
      history.getByText("Consultation", { exact: true }),
    ).toHaveCount(10)
    const descriptionBox = await longEvent
      .getByText(longDescription, { exact: true })
      .boundingBox()
    const actorBox = await longEvent
      .getByText(longActor, { exact: true })
      .boundingBox()
    expect(descriptionBox?.height ?? 0).toBeGreaterThan(20)
    expect(actorBox?.height ?? 0).toBeGreaterThan(16)
    const timelineBox = await history.boundingBox()
    const firstMarker = await history
      .getByRole("listitem")
      .first()
      .locator(":scope > span")
      .boundingBox()
    const lastMarker = await history
      .getByRole("listitem")
      .last()
      .locator(":scope > span")
      .boundingBox()
    const lineWidth = await history.evaluate(
      (list) => getComputedStyle(list).borderLeftWidth,
    )
    expect(lineWidth).toBe("1px")
    if (!timelineBox || !firstMarker || !lastMarker)
      throw new Error("Workflow timeline markers should be measurable.")
    const lineCenterX = timelineBox.x + Number.parseFloat(lineWidth) / 2
    expect(
      Math.abs(firstMarker.x + firstMarker.width / 2 - lineCenterX),
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(lastMarker.x + lastMarker.width / 2 - lineCenterX),
    ).toBeLessThanOrEqual(1)
    expect(firstMarker.y).toBeGreaterThanOrEqual(timelineBox.y)
    expect(lastMarker.y + lastMarker.height).toBeLessThanOrEqual(
      timelineBox.y + timelineBox.height,
    )
    if (workflowSize.scrollHeight > workflowSize.clientHeight) {
      await workflowPanel.evaluate(
        (panel) =>
          (panel.scrollTop = Math.floor(
            (panel.scrollHeight - panel.clientHeight) / 2,
          )),
      )
      await expect
        .poll(() => workflowPanel.evaluate((panel) => panel.scrollTop))
        .toBeGreaterThan(0)
      const middleChrome = {
        header: await drawerHeader.boundingBox(),
        tabs: await drawerTabs.boundingBox(),
        footer: await drawerFooter.boundingBox(),
      }
      for (const [before, after] of [
        [initialChrome.header, middleChrome.header],
        [initialChrome.tabs, middleChrome.tabs],
        [initialChrome.footer, middleChrome.footer],
      ]) {
        if (!before || !after)
          throw new Error(
            "Drawer chrome should remain measurable while scrolling.",
          )
        expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(1)
      }
    }
    await expectContentAboveFooter(
      history.getByRole("listitem").last(),
      workflowPanel,
      drawerFooter,
    )
    await expect(doneButton).toBeInViewport()
    await drawer.getByRole("tab", { name: "Records", exact: true }).click()
    const recordsPanel = drawer.getByRole("tabpanel")
    const [recordsTabBox, recordsPanelBox, recordsFooterBox] =
      await Promise.all([
        drawerTabs.boundingBox(),
        recordsPanel.boundingBox(),
        drawerFooter.boundingBox(),
      ])
    if (!recordsTabBox || !recordsPanelBox || !recordsFooterBox)
      throw new Error("Records drawer layout should be measurable.")
    expect(recordsPanelBox.y).toBeGreaterThanOrEqual(
      recordsTabBox.y + recordsTabBox.height,
    )
    expect(recordsPanelBox.y + recordsPanelBox.height).toBeLessThanOrEqual(
      recordsFooterBox.y,
    )
    expect(Math.abs(recordsTabBox.y - workflowTabBox.y)).toBeLessThanOrEqual(1)
    const recordsSize = await recordsPanel.evaluate((panel) => ({
      clientHeight: panel.clientHeight,
      scrollHeight: panel.scrollHeight,
    }))
    if (viewport.height <= 560)
      expect(recordsSize.scrollHeight).toBeGreaterThan(recordsSize.clientHeight)
    for (const title of [
      "Consultation",
      "Requirements",
      "Quotations",
      "Approvals",
      "Agreements",
      "Payments",
      "Project and activation",
    ])
      await expect(
        recordsPanel.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible()
    await expect(
      recordsPanel.getByText("Quotation version 1", { exact: true }),
    ).toBeVisible()
    await expect(
      recordsPanel.getByText("Assigned Designer · Team lead", { exact: true }),
    ).toBeVisible()
    await expect(
      recordsPanel.getByText(/Pending reschedule proposal:/),
    ).toBeVisible()
    if (viewport.height <= 560) {
      await expectContentAboveFooter(
        recordsPanel.getByText("No project has been created yet.", {
          exact: true,
        }),
        recordsPanel,
        drawerFooter,
      )
      await expect(doneButton).toBeInViewport()
    }
    await doneButton.focus()
    await expect(doneButton).toBeFocused()
    await expect(doneButton).toBeInViewport()
    await expect(
      drawer.getByRole("button", {
        name: /accept|reject|decline|delete|chat|approve|verify|staff/i,
      }),
    ).toHaveCount(0)
    await expect(drawer.getByRole("link")).toHaveCount(0)
    await expect(drawer.getByRole("textbox")).toHaveCount(0)
    await page.reload()
    await expect(
      drawer.getByRole("tab", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-selected", "true")
    expect(prohibited).toEqual([])
  })

test("on-hold workflow retains its prior stage while revoked backend access clears history", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let denied = false
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
  const drawer = page.getByRole("dialog", {
    name: "Workflow inspection",
    exact: true,
  })
  await drawer.getByRole("tab", { name: "Workflow", exact: true }).click()
  const workflowPanel = drawer.getByRole("tabpanel")
  await expect(
    workflowPanel.getByText("Previous stage", { exact: true }),
  ).toBeVisible()
  await expect(
    workflowPanel.getByText("Ready For Activation", { exact: true }),
  ).toBeVisible()
  denied = true
  await page.reload()
  await expect(
    page
      .getByRole("alert")
      .getByText("Organization-wide service request read access is required"),
  ).toBeVisible()
  await expect(drawer.getByRole("tabpanel")).toHaveCount(0)
})
