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

async function mock(page: Page, workflow: Workflow, manager = false) {
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
            role: manager ? "STAFF" : "USER",
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
    page
      .getByRole("complementary", { name: "Request context" })
      .getByText("Website Development", { exact: true }),
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
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Service agreement", exact: true }),
  ).toBeVisible()
  workflow.agreement!.status = "APPROVED"
  await page.reload()
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

test("requested documents can be uploaded and submitted without leaving the requirement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const workflow = fixture()
  workflow.state = "CONSULTATION"
  workflow.quotations = []
  workflow.requirements = [
    {
      id: "requirement-1",
      title: "Project brief",
      details: "Upload the project brief",
      mandatory: true,
      status: "REQUESTED",
      submission: null,
      fileId: null,
      reviewNote: null,
      createdAt: "2026-10-30T08:00:00.000Z",
    },
  ]
  workflow.events = [
    {
      id: "requirement-event",
      type: "REQUIREMENT_REQUESTED",
      summary: "Project brief requested",
      entityId: "requirement-1",
      createdAt: "2026-10-30T08:00:00.000Z",
      actor: null,
    },
  ]
  const actions = await mock(page, workflow)
  await page.route(
    "**/api/request-workflows/request-1/files",
    async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        name: "brief.txt",
        mimeType: "text/plain",
        contextual: true,
      })
      const file = {
        id: "uploaded-brief",
        name: "brief.txt",
        mimeType: "text/plain",
        size: 5,
        uploaderId: "client-1",
        createdAt: new Date().toISOString(),
      }
      workflow.files.push(file)
      workflow.version++
      await route.fulfill({ status: 201, json: { file } })
    },
  )
  await page.goto("/messages?request=request-1")
  const uploadButton = page
    .getByRole("button", {
      name: "Upload document",
      exact: true,
    })
    .and(page.locator("button"))
  const row = await uploadButton.locator("..").boundingBox()
  const button = await uploadButton.boundingBox()
  expect(row).not.toBeNull()
  expect(button).not.toBeNull()
  expect(row!.x + row!.width).toBeGreaterThan(button!.x + button!.width + 8)
  const outsidePicker = page
    .waitForEvent("filechooser", { timeout: 500 })
    .catch(() => null)
  await page.mouse.click(
    button!.x + button!.width + 8,
    button!.y + button!.height / 2,
  )
  expect(await outsidePicker).toBeNull()
  const picker = page.waitForEvent("filechooser")
  await uploadButton.click()
  await (await picker).setFiles([])
  await page.getByLabel("Upload document", { exact: true }).setInputFiles({
    name: "brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("brief"),
  })
  await expect(page.getByText(/Ready to submit/)).toBeVisible()
  expect(workflow.files).toHaveLength(0)
  expect(actions).toHaveLength(0)
  await page
    .getByRole("button", { name: "Submit requirement", exact: true })
    .click()
  await expect.poll(() => actions.length).toBe(1)
  expect(actions[0]).toMatchObject({
    type: "SUBMIT_REQUIREMENT",
    requirementId: "requirement-1",
    fileId: "uploaded-brief",
    expectedVersion: 4,
  })
})

test("agreement documents upload directly and outstanding checklist statuses are labeled", async ({
  page,
}) => {
  const workflow = fixture()
  workflow.state = "AGREEMENT_PAYMENT_PENDING"
  workflow.permissions.manage = true
  workflow.permissions.isClient = false
  workflow.quotations[0]!.status = "ACCEPTED"
  workflow.approval = {
    quotationId: "quote-1",
    amount: "25000.00",
    currency: "PHP",
    approvedById: "client-1",
    approvedAt: "2026-10-30T08:00:00.000Z",
  }
  workflow.agreement = {
    id: "agreement-1",
    mandatory: true,
    status: "PENDING",
    documentFileId: null,
    signedFileId: null,
  }
  workflow.events = [
    {
      id: "agreement-event",
      type: "AGREEMENT_REQUIRED",
      summary: "Agreement required",
      entityId: "agreement-1",
      createdAt: "2026-10-30T08:00:00.000Z",
      actor: null,
    },
  ]
  const actions = await mock(page, workflow, true)
  await page.route(
    "**/api/request-workflows/request-1/files",
    async (route) => {
      const file = {
        id: "agreement-file",
        name: "agreement.txt",
        mimeType: "text/plain",
        size: 9,
        uploaderId: "client-1",
        createdAt: new Date().toISOString(),
      }
      workflow.files.push(file)
      workflow.version++
      await route.fulfill({ status: 201, json: { file } })
    },
  )
  await page.goto("/messages?request=request-1")
  const checklist = page
    .locator("summary")
    .filter({ hasText: "Commencement checklist" })
    .locator("..")
  await expect(checklist.getByText("Completed", { exact: true })).toBeVisible()
  await expect(checklist.getByText("Pending", { exact: true })).toHaveCSS(
    "color",
    "rgb(180, 35, 24)",
  )
  await page.getByLabel("Upload document", { exact: true }).setInputFiles({
    name: "agreement.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("agreement"),
  })
  await expect(page.getByText(/Ready to submit/)).toBeVisible()
  expect(workflow.files).toHaveLength(0)
  expect(actions).toHaveLength(0)
  await page
    .getByRole("button", { name: "Attach agreement document", exact: true })
    .click()
  await expect.poll(() => actions.length).toBe(1)
  expect(actions[0]).toMatchObject({
    type: "ATTACH_AGREEMENT",
    fileId: "agreement-file",
    expectedVersion: 4,
  })
})

test("request detail information rejects blank and whitespace-only instructions", async ({
  page,
}) => {
  const workflow = fixture()
  workflow.state = "CONSULTATION"
  workflow.permissions.manage = true
  workflow.permissions.isClient = false
  workflow.quotations = []
  workflow.events = []
  const actions = await mock(page, workflow, true)
  await page.goto("/messages?request=request-1")
  await page
    .getByRole("button", { name: "Open request actions", exact: true })
    .click()
  await page
    .getByRole("menuitem", { name: "Request information", exact: true })
    .click()
  const draft = page.getByRole("region", { name: "Request information" })
  await draft.getByLabel("Requirement title").fill("Project brief")
  await draft.getByRole("button", { name: "Send request", exact: true }).click()
  expect(actions).toHaveLength(0)
  await draft.getByLabel("Request detail information (required)").fill("   ")
  await draft.getByRole("button", { name: "Send request", exact: true }).click()
  expect(actions).toHaveLength(0)
  await draft
    .getByLabel("Request detail information (required)")
    .fill("Please attach the project brief.")
  await draft.getByRole("button", { name: "Send request", exact: true }).click()
  await expect.poll(() => actions.length).toBe(1)
  expect(actions[0]).toMatchObject({
    type: "REQUEST_REQUIREMENT",
    details: "Please attach the project brief.",
  })
})

for (const width of [1280, 390]) {
  test(`quotation revisions preserve all items and edits across steps at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const workflow = fixture()
    workflow.state = "REVISION_REQUESTED"
    workflow.paymentRequired = true
    workflow.permissions.manage = true
    workflow.permissions.isClient = false
    workflow.quotations[0]!.status = "REVISION_REQUESTED"
    workflow.quotations[0]!.validUntil = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString()
    workflow.quotations[0]!.lineItems.push({
      description: "Hosting",
      quantity: 2,
      unitPrice: "500.00",
    })
    const actions = await mock(page, workflow, true)
    await page.goto("/messages?request=request-1")
    await page
      .getByRole("button", { name: "Prepare revised quotation" })
      .click()
    const draft = page.getByRole("region", { name: "Prepare quotation" })
    await draft
      .getByLabel("Deliverables (one per line)")
      .fill(
        Array.from({ length: 31 }, (_, index) => `Deliverable ${index}`).join(
          "\n",
        ),
      )
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    await expect(draft.getByLabel("Service scope")).toBeVisible()
    await draft
      .getByLabel("Deliverables (one per line)")
      .fill("Five accessible pages\nProduction deployment")
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    await expect(draft.getByLabel("Item 1", { exact: true })).toHaveValue(
      "Website delivery",
    )
    await expect(draft.getByLabel("Item 2", { exact: true })).toHaveValue(
      "Hosting",
    )
    await draft.getByLabel("Item 2", { exact: true }).fill("Managed hosting")
    await draft.getByRole("button", { name: "Back", exact: true }).click()
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    await expect(draft.getByLabel("Item 2", { exact: true })).toHaveValue(
      "Managed hosting",
    )
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    const validUntil = await draft.getByLabel("Valid until").inputValue()
    await draft.getByLabel("Valid until").fill("2020-01-01T12:00")
    await draft.getByRole("button", { name: "Review", exact: true }).click()
    await expect(draft.getByLabel("Valid until")).toBeVisible()
    await draft.getByLabel("Valid until").fill(validUntil)
    await draft.getByLabel("Amount due before commencement").fill("99999")
    await draft.getByRole("button", { name: "Review", exact: true }).click()
    await expect(
      draft.getByLabel("Amount due before commencement"),
    ).toBeVisible()
    await draft.getByLabel("Amount due before commencement").fill("0")
    await draft.getByRole("button", { name: "Review", exact: true }).click()
    await expect(
      draft.getByLabel("Amount due before commencement"),
    ).toBeVisible()
    await draft.getByLabel("Amount due before commencement").fill("12500.00")
    await draft.getByRole("button", { name: "Review", exact: true }).click()
    await expect(
      draft.getByRole("region", { name: "Quotation review" }),
    ).toContainText("Managed hosting")
    await page.screenshot({
      path: `test-results/issue141-quotation-review-${width}.png`,
      fullPage: true,
    })
    expect(actions).toHaveLength(0)
    await draft.getByRole("button", { name: "Send revised quotation" }).click()
    await expect.poll(() => actions.length).toBe(1)
    expect(actions[0]!.lineItems).toEqual([
      { description: "Website delivery", quantity: 1, unitPrice: "25000.00" },
      { description: "Managed hosting", quantity: 2, unitPrice: "500.00" },
    ])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test("declining a quotation requires confirmation and cancel preserves it", async ({
  page,
}) => {
  const actions = await mock(page, fixture())
  await page.goto("/messages?request=request-1")
  await page
    .getByRole("checkbox", { name: /I have reviewed this quotation/ })
    .check()
  await page
    .getByRole("button", { name: "Decline quotation", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Decline quotation?" })
  await expect(dialog).toBeVisible()
  expect(actions).toHaveLength(0)
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(actions).toHaveLength(0)
  await page
    .getByRole("button", { name: "Decline quotation", exact: true })
    .click()
  await dialog
    .getByRole("button", { name: "Confirm decline", exact: true })
    .click()
  await expect.poll(() => actions.length).toBe(1)
  expect(actions[0]).toMatchObject({ decision: "DECLINE" })
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

for (const width of [1440, 390]) {
  test(`client retries a consultation reschedule without changing the confirmed schedule at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const workflow = fixture()
    workflow.state = "CONSULTATION"
    workflow.quotations = []
    const consultation = {
      id: "consultation-1",
      startsAt: "2030-11-05T08:00:00.000Z",
      endsAt: "2030-11-05T09:00:00.000Z",
      location: "https://meet.example.com/consultation",
      notes: null,
      status: "SCHEDULED" as const,
    }
    workflow.consultations = [consultation]
    workflow.events = [
      {
        id: "scheduled",
        type: "CONSULTATION_SCHEDULED",
        summary: "Consultation scheduled",
        entityId: consultation.id,
        createdAt: "2026-11-01T08:00:00.000Z",
        actor: null,
      },
    ]
    await mock(page, workflow)
    const actions: Record<string, unknown>[] = []
    await page.route(
      "**/api/request-workflows/request-1/actions",
      async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers().authorization).toBe(
          "Bearer workflow-session",
        )
        const action = route.request().postDataJSON() as Record<string, unknown>
        actions.push(action)
        if (actions.length === 1)
          return route.fulfill({
            status: 503,
            json: { error: "Reschedule unavailable. Try again." },
          })
        workflow.version++
        workflow.events.push({
          id: "rescheduled",
          type: "CONSULTATION_RESCHEDULE_REQUESTED",
          summary: `Client requested a consultation reschedule to ${action.startsAt}. ${action.note}`,
          entityId: consultation.id,
          createdAt: "2026-11-02T08:00:00.000Z",
          actor: { id: "client-1", fullName: "Mara Client" },
        })
        return route.fulfill({ json: workflow })
      },
    )
    await page.goto("/messages?request=request-1")
    const reschedule = page.getByRole("button", {
      name: "Request reschedule",
      exact: true,
    })
    await reschedule.click()
    await page.getByLabel("Preferred date and time").fill("2030-11-06T10:00")
    await page
      .getByLabel("Reason for rescheduling")
      .fill("Client meeting conflict")
    await reschedule.click()
    await expect(page.getByLabel("Reason for rescheduling")).toHaveValue(
      "Client meeting conflict",
    )
    await expect.poll(() => actions.length).toBe(1)
    await expect(reschedule).toBeEnabled()
    await reschedule.click()
    await expect(
      page.getByText("Reschedule requested · Awaiting department response", {
        exact: true,
      }),
    ).toBeVisible()
    expect(actions).toHaveLength(2)
    expect(actions[1]).toEqual(actions[0])
    expect(actions[0]).toMatchObject({
      type: "REQUEST_CONSULTATION_RESCHEDULE",
      consultationId: consultation.id,
      note: "Client meeting conflict",
      expectedVersion: 3,
    })
    expect(actions[0].actionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(consultation.startsAt).toBe("2030-11-05T08:00:00.000Z")
    await expect(reschedule).toHaveCount(0)
  })

  test(`client previews and retries payment evidence upload at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const workflow = fixture()
    workflow.state = "AGREEMENT_PAYMENT_PENDING"
    workflow.quotations = []
    workflow.payment = {
      id: "payment-1",
      mandatory: true,
      amount: "12500.00",
      currency: "PHP",
      status: "PENDING",
      proofFileId: null,
      reference: null,
    }
    workflow.events = [
      {
        id: "payment",
        type: "PAYMENT_REQUIRED",
        summary: "Payment required",
        entityId: "payment-1",
        createdAt: "2026-11-01T08:00:00.000Z",
        actor: null,
      },
    ]
    await mock(page, workflow)
    const uploads: Record<string, unknown>[] = []
    const actions: Record<string, unknown>[] = []
    const buffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lY4AAAAASUVORK5CYII=",
      "base64",
    )
    await page.route("**/api/request-workflows/request-1/files", (route) => {
      expect(route.request().method()).toBe("POST")
      expect(route.request().headers().authorization).toBe(
        "Bearer workflow-session",
      )
      uploads.push(route.request().postDataJSON() as Record<string, unknown>)
      if (uploads.length === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Upload unavailable. Try again." },
        })
      const file = {
        id: "proof-1",
        name: "receipt.png",
        mimeType: "image/png",
        size: buffer.length,
        uploaderId: "client-1",
        createdAt: "2026-11-02T08:00:00.000Z",
      }
      workflow.files = [file]
      return route.fulfill({ status: 201, json: { file } })
    })
    await page.route("**/api/request-workflows/request-1/actions", (route) => {
      expect(route.request().method()).toBe("POST")
      actions.push(route.request().postDataJSON() as Record<string, unknown>)
      workflow.payment!.status = "SUBMITTED"
      workflow.payment!.proofFileId = "proof-1"
      workflow.payment!.reference = "BANK-123"
      workflow.version++
      return route.fulfill({ json: workflow })
    })
    await page.goto("/messages?request=request-1")
    const submit = page.getByRole("button", {
      name: "Submit payment proof",
      exact: true,
    })
    await expect(submit).toBeDisabled()
    await page.getByLabel("Payment reference", { exact: true }).fill("BANK-123")
    const input = page.getByLabel("Attach proof of payment", { exact: true })
    await input.setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer,
    })
    const preview = page.getByRole("img", {
      name: "Preview of receipt.png",
      exact: true,
    })
    await expect(preview).toBeVisible()
    await page
      .getByRole("button", { name: "Remove receipt.png", exact: true })
      .click()
    await expect(preview).toHaveCount(0)
    await expect(submit).toBeDisabled()
    expect(uploads).toEqual([])
    await input.setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer,
    })
    await submit.click()
    await expect.poll(() => uploads.length).toBe(1)
    await expect(submit).toBeEnabled()
    await expect(preview).toBeVisible()
    expect(actions).toEqual([])
    await submit.click()
    await expect(
      page.getByText(
        /Your payment proof has been submitted and is awaiting verification/,
      ),
    ).toBeVisible()
    expect(uploads).toHaveLength(2)
    expect(uploads[1]).toEqual(uploads[0])
    expect(uploads[0]).toMatchObject({
      name: "receipt.png",
      mimeType: "image/png",
      content: buffer.toString("base64"),
    })
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      type: "SUBMIT_PAYMENT",
      fileId: "proof-1",
      reference: "BANK-123",
      expectedVersion: 3,
    })
    await expect(submit).toHaveCount(0)
  })
}

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
