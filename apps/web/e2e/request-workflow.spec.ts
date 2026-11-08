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
            id: workflow.request.id,
            department: workflow.request.department,
            head: { id: "head-1", fullName: "Dani Head" },
            bookings: [
              {
                id: workflow.request.id,
                title: workflow.request.title,
                referenceNumber: workflow.request.referenceNumber,
                status: "UNDER_REVIEW",
                packageName: workflow.request.packageName,
                serviceName: workflow.request.serviceName,
                workflowState: workflow.state,
                previousWorkflowState: workflow.previousState,
                createdAt: "2026-10-30T08:00:00.000Z",
                updatedAt: "2026-10-30T08:00:00.000Z",
              },
            ],
            bookingCount: 1,
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
        workflow.nextAction = "Complete payment before activation."
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
          status: "APPROVED",
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
            type: "AGREEMENT_CONFIRMED",
            summary: "Quotation acceptance confirms the service agreement.",
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

async function chooseToolBooking(page: Page) {
  const context = page.getByRole("dialog", { name: /choose a booking/ })
  await context.getByRole("radio", { name: /REQ-2026-1001/ }).check()
  await context.getByRole("button", { name: "Continue", exact: true }).click()
}

test("workflow refreshes queue while a previous read is pending", async ({
  page,
}) => {
  const workflow = fixture()
  await mock(page, workflow)
  let requests = 0
  let active = 0
  let maximumActive = 0
  let release = () => {}
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/request-workflows/request-1", async (route) => {
    requests++
    active++
    maximumActive = Math.max(maximumActive, active)
    if (requests === 1) await blocked
    await route.fulfill({ json: workflow })
    active--
  })
  await page.goto("/messages?request=request-1")
  await expect.poll(() => requests).toBe(1)
  await page.evaluate(() => {
    for (let count = 0; count < 5; count++)
      document.dispatchEvent(new Event("visibilitychange"))
  })
  // All visibility handlers have run; the pending read must still be the only request.
  expect(requests).toBe(1)
  release()
  await expect.poll(() => requests).toBe(2)
  await expect(
    page.getByLabel("Quotation reference").getByRole("definition"),
  ).toHaveText("REQ-2026-1001")
  expect(maximumActive).toBe(1)
})

for (const width of [1280, 390]) {
  for (const manager of [false, true]) {
    test(`sent quotation shows its reference for ${manager ? "department heads" : "clients"} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      const workflow = fixture()
      workflow.permissions.manage = manager
      workflow.permissions.isClient = !manager
      await mock(page, workflow, manager)
      await page.goto("/messages?request=request-1")
      const reference = page
        .getByLabel("Quotation reference")
        .getByRole("definition")
      await expect(reference).toHaveText("REQ-2026-1001")
      await expect(reference).toBeVisible()
      await page.reload()
      await expect(reference).toHaveText("REQ-2026-1001")
    })
  }
}

test("sent quotation falls back to the request ID for bookings without a reference", async ({
  page,
}) => {
  const workflow = fixture()
  workflow.request.referenceNumber = null
  await mock(page, workflow)
  await page.goto("/messages?request=request-1")
  await expect(
    page.getByLabel("Quotation reference").getByRole("definition"),
  ).toHaveText("request-1")
})

test("the conversation records formal quotation approval through a structured action", async ({
  page,
}) => {
  const workflow = fixture()
  const actions = await mock(page, workflow)
  await page.goto("/messages?request=request-1")
  await expect(
    page
      .getByRole("complementary", { name: "Request context" })
      .getByRole("button", { name: /Website Development REQ-2026-1001/ }),
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
  await expect(
    page.getByText(/Xendit sandbox prototype · no real charge will be made/),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Service agreement", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(/No separate signature is required/),
  ).toBeVisible()
  const checklist = page.locator("details").filter({
    has: page
      .locator("summary")
      .filter({ hasText: /^Commencement checklist$/ }),
  })
  await expect(checklist.getByRole("link", { name: /Agreement/ })).toHaveCount(
    0,
  )
  await expect(
    page.getByRole("button", { name: "Submit signed agreement", exact: true }),
  ).toHaveCount(0)
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

function requestedRequirementFixture() {
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
      fileIds: [],
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
  return workflow
}

test("requested documents can be uploaded and submitted without leaving the requirement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const workflow = requestedRequirementFixture()
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
      name: "Upload documents",
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
  await page.getByLabel("Upload documents", { exact: true }).setInputFiles({
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
    fileIds: ["uploaded-brief"],
    expectedVersion: 4,
  })
})

for (const viewport of [
  { width: 1600, height: 900 },
  { width: 390, height: 844 },
])
  test(`clients submit five requirement attachments and retry safely at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const workflow = requestedRequirementFixture()
    await mock(page, workflow)
    const attempts: string[] = []
    const actions: Record<string, unknown>[] = []
    let uploadFailed = false
    await page.route(
      "**/api/request-workflows/request-1/files",
      async (route) => {
        const body = route.request().postDataJSON() as {
          name: string
          contextual: boolean
        }
        attempts.push(body.name)
        expect(body.contextual).toBe(true)
        if (body.name === "support-2.txt" && !uploadFailed) {
          uploadFailed = true
          return route.fulfill({
            status: 503,
            json: { error: "Upload temporarily unavailable" },
          })
        }
        const file = {
          id: `uploaded-${body.name}`,
          name: body.name,
          mimeType: "text/plain",
          size: 5,
          uploaderId: "client-1",
          createdAt: new Date().toISOString(),
        }
        workflow.files.push(file)
        workflow.version++
        return route.fulfill({ status: 201, json: { file } })
      },
    )
    await page.route(
      "**/api/request-workflows/request-1/actions",
      async (route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>
        actions.push(body)
        if (actions.length === 1)
          return route.fulfill({
            status: 503,
            json: { error: "Save temporarily unavailable" },
          })
        workflow.requirements[0]!.fileIds = body.fileIds as string[]
        workflow.requirements[0]!.status = "SUBMITTED"
        workflow.version++
        return route.fulfill({ json: workflow })
      },
    )
    await page.goto("/messages?request=request-1")
    const input = page.getByLabel("Upload documents", { exact: true })
    const documents = Array.from({ length: 6 }, (_, index) => ({
      name: `support-${index + 1}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("brief"),
    }))
    await input.setInputFiles(documents)
    await expect(
      page.getByText("Attach up to 5 files per response", { exact: true }),
    ).toBeVisible()
    expect(attempts).toHaveLength(0)
    await input.setInputFiles(documents.slice(0, 2))
    await expect(page.getByText(/2\/5 files/)).toBeVisible()
    await page
      .getByRole("button", { name: "Remove support-2.txt", exact: true })
      .click()
    await expect(page.getByText(/1\/5 files/)).toBeVisible()
    await input.setInputFiles(documents.slice(1, 5))
    await expect(page.getByText(/5\/5 files/)).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Add documents", exact: true }),
    ).toBeDisabled()
    expect(attempts).toHaveLength(0)
    const submit = page.getByRole("button", {
      name: "Submit requirement",
      exact: true,
    })
    await submit.click()
    await expect.poll(() => attempts.length).toBe(2)
    await expect(submit).toBeEnabled()
    expect(actions).toHaveLength(0)
    await expect(
      page.getByRole("button", { name: "Remove support-1.txt", exact: true }),
    ).toBeVisible()
    await submit.click()
    await expect.poll(() => actions.length).toBe(1)
    await expect(submit).toBeEnabled()
    expect(attempts).toHaveLength(6)
    await submit.click()
    await expect.poll(() => actions.length).toBe(2)
    expect(attempts).toHaveLength(6)
    expect(actions[1]).toEqual(actions[0])
    expect(actions[1]).toMatchObject({
      type: "SUBMIT_REQUIREMENT",
      fileIds: documents.slice(0, 5).map((file) => `uploaded-${file.name}`),
    })
    for (const file of documents.slice(0, 5))
      await expect(
        page.getByRole("button", {
          name: `Download ${file.name}`,
          exact: true,
        }),
      ).toBeVisible()
    await page.reload()
    for (const file of documents.slice(0, 5))
      await expect(
        page.getByRole("button", {
          name: `Download ${file.name}`,
          exact: true,
        }),
      ).toBeVisible()
  })

test("quotation acceptance removes the separate agreement from the commencement checklist", async ({
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
    status: "APPROVED",
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
  workflow.events = [
    {
      id: "agreement-confirmed",
      type: "AGREEMENT_CONFIRMED",
      summary: "Quotation acceptance confirms the service agreement.",
      entityId: "agreement-1",
      createdAt: "2026-10-30T08:00:00.000Z",
      actor: null,
    },
  ]
  await mock(page, workflow, true)
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
  await expect(checklist.getByRole("link", { name: /Agreement/ })).toHaveCount(
    0,
  )
  await expect(
    page.getByRole("button", {
      name: "Attach agreement document",
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    page.getByText(/No separate signature is required/),
  ).toBeVisible()
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
  await chooseToolBooking(page)
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
  test(`quotation form formats amounts and uses custom date and time controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.clock.install({ time: new Date("2026-11-06T08:00:00Z") })
    const workflow = fixture()
    workflow.state = "QUOTATION_PENDING"
    workflow.quotations = []
    workflow.events = []
    workflow.paymentRequired = true
    workflow.permissions.manage = true
    workflow.permissions.isClient = false
    const actions = await mock(page, workflow, true)
    await page.goto("/messages?request=request-1")
    await page
      .getByRole("button", { name: "Open request actions", exact: true })
      .click()
    await page
      .getByRole("menuitem", { name: "Create quotation", exact: true })
      .click()
    await chooseToolBooking(page)
    const chat = page.getByRole("region", { name: "Request conversation" })
    const draft = chat.getByRole("region", { name: "Prepare quotation" })
    await expect(
      page.getByRole("dialog", { name: "Create quotation", exact: true }),
    ).toHaveCount(0)
    const message = chat.getByRole("textbox", { name: "Message", exact: true })
    await message.fill("Quotation details stay connected to this chat.")
    await expect(message).toHaveValue(
      "Quotation details stay connected to this chat.",
    )
    const sheetBox = await draft.boundingBox()
    const composerBox = await chat
      .getByRole("form", { name: "Send a message" })
      .boundingBox()
    expect(
      Math.abs(composerBox!.y - (sheetBox!.y + sheetBox!.height) - 8),
    ).toBeLessThan(2)
    expect(sheetBox!.height).toBeLessThanOrEqual(400)
    const details = page.getByRole("complementary", { name: "Request context" })
    await expect(details).toBeVisible()
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    const deliverables = draft.getByLabel("Deliverables (one per line)")
    await expect(deliverables).toBeFocused()
    await expect(deliverables).toHaveAttribute("aria-invalid", "true")
    await expect(deliverables).toHaveAccessibleDescription(
      "Complete this field.",
    )
    await expect(draft.locator("[data-field-error]")).toHaveText(
      "Complete this field.",
    )
    await expect(draft.locator("form")).toHaveAttribute("novalidate", "")
    expect(actions).toHaveLength(0)
    await draft
      .getByLabel("Deliverables (one per line)")
      .fill("Accessible website\nProduction deployment")
    await expect(deliverables).not.toHaveAttribute("aria-invalid", "true")
    await expect(draft.locator("[data-field-error]")).toHaveCount(0)
    await chat
      .getByRole("button", { name: "Hide service details", exact: true })
      .click()
    await expect(draft).toBeVisible()
    await chat
      .getByRole("button", { name: "Show service details", exact: true })
      .click()
    await expect(details).toBeVisible()
    await expect(draft.getByLabel("Deliverables (one per line)")).toHaveValue(
      "Accessible website\nProduction deployment",
    )
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    await draft.getByRole("combobox", { name: "Currency", exact: true }).click()
    await expect(
      page.getByRole("option", { name: "USD · US Dollar", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("option", { name: "USD · US Dollar", exact: true })
      .click()
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    const item = draft.getByRole("textbox", { name: "Item 1", exact: true })
    await expect(item).toBeFocused()
    await expect(item).toHaveAccessibleDescription("Complete this field.")
    await expect(item).toBeInViewport()
    await expect(draft.locator("[data-field-error]")).toBeInViewport()
    await expect
      .poll(() =>
        draft.locator("[data-field-error]").evaluate((element) => {
          const box = element.getBoundingClientRect()
          return (
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ) === element
          )
        }),
      )
      .toBe(true)
    await page.screenshot({
      path: `test-results/quotation-validation-${width}.png`,
    })
    await item.fill("Website delivery")
    const quantity = draft.getByRole("spinbutton", {
      name: "Quantity",
      exact: true,
    })
    await quantity.fill("0")
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    await expect(quantity).toBeFocused()
    await expect(quantity).toHaveAccessibleDescription(
      "Enter a value of 1 or more.",
    )
    await quantity.fill("1")
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    const price = draft.getByLabel("Unit price", { exact: true })
    await expect(price).toBeFocused()
    await expect(price).toHaveAccessibleDescription("Complete this field.")
    await price.pressSequentially("1234567.89", { delay: 20 })
    await expect(price).toHaveValue("1,234,567.89")
    await expect(draft.locator("[data-field-error]")).toHaveCount(0)
    await draft.getByRole("button", { name: "Next", exact: true }).click()
    await draft
      .getByLabel("Payment terms", { exact: true })
      .fill("Deposit before commencement, balance on delivery.")
    const amount = draft.getByLabel("Amount due before commencement", {
      exact: true,
    })
    await amount.fill("1234.5")
    await expect(amount).toHaveValue("1,234.5")
    await draft.getByRole("button", { name: "Review", exact: true }).click()
    await expect(draft.getByRole("alert")).toContainText(
      "Choose a future validity date",
    )
    await expect(amount).toHaveValue("1,234.50")
    const validity = draft.getByRole("button", {
      name: "Valid until",
      exact: true,
    })
    const amountBox = await amount.boundingBox()
    const dateBox = await validity.boundingBox()
    expect(
      Math.abs(amountBox!.y + amountBox!.height - dateBox!.y - dateBox!.height),
    ).toBeLessThan(1)
    expect(Math.abs(amountBox!.height - dateBox!.height)).toBeLessThan(1)
    expect(Math.abs(amountBox!.width - dateBox!.width)).toBeLessThan(1)
    await expect(validity).toHaveText("Select date & time")
    expect(dateBox!.x).toBeGreaterThan(amountBox!.x + amountBox!.width)
    await validity.click()
    const picker = page.getByRole("dialog", {
      name: "Select date and time",
      exact: true,
    })
    await expect(
      picker.getByRole("button", { name: "Previous month", exact: true }),
    ).toBeDisabled()
    await expect(
      picker.getByRole("button", {
        name: "Sunday, November 1, 2026",
        exact: true,
      }),
    ).toBeDisabled()
    await picker
      .getByRole("button", { name: "Friday, November 20, 2026", exact: true })
      .click()
    await picker.getByRole("combobox", { name: "Hour", exact: true }).click()
    await page.getByRole("option", { name: "09", exact: true }).click()
    await picker.getByRole("combobox", { name: "Minute", exact: true }).click()
    await page.getByRole("option", { name: "30", exact: true }).click()
    await picker.getByRole("combobox", { name: "Period", exact: true }).click()
    await page.getByRole("option", { name: "AM", exact: true }).click()
    await picker.screenshot({
      path: `test-results/quotation-date-time-${width}.png`,
    })
    await picker
      .getByRole("button", { name: "Apply date & time", exact: true })
      .click()
    await expect(picker).toHaveCount(0)
    await expect(validity).toBeFocused()
    await expect(validity).toHaveAttribute("title", /November 20, 2026/)
    await expect(draft.locator('input[name="validUntil"]')).toHaveValue(
      "2026-11-20T09:30",
    )
    await page.screenshot({
      path: `test-results/quotation-terms-${width}.png`,
    })
    await draft.getByRole("button", { name: "Review", exact: true }).click()
    await expect(
      draft.getByRole("region", { name: "Quotation review" }),
    ).toContainText("1,234,567.89")
    await draft
      .getByRole("button", { name: "Send quotation", exact: true })
      .click()
    await expect.poll(() => actions.length).toBe(1)
    expect(actions[0]).toMatchObject({
      type: "CREATE_QUOTATION",
      currency: "USD",
      lineItems: [
        {
          description: "Website delivery",
          quantity: 1,
          unitPrice: "1234567.89",
        },
      ],
      paymentDue: "1234.50",
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })

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
    const validity = draft.locator('input[name="validUntil"]')
    const validUntil = await validity.inputValue()
    await draft
      .getByRole("button", { name: "Valid until", exact: true })
      .click()
    const picker = page.getByRole("dialog", { name: "Select date and time" })
    await picker.getByRole("combobox", { name: "Hour", exact: true }).click()
    await page.getByRole("option", { name: "09", exact: true }).click()
    await picker.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(validity).toHaveValue(validUntil)
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

test("department heads can confirm payment or reject it with a required reason", async ({
  page,
}) => {
  const workflow = fixture()
  workflow.state = "AGREEMENT_PAYMENT_PENDING"
  workflow.permissions = {
    manage: true,
    isClient: false,
    approveQuotation: false,
    verifyPayment: false,
  }
  workflow.agreement = {
    id: "agreement-1",
    mandatory: true,
    status: "APPROVED",
    documentFileId: null,
    signedFileId: null,
  }
  workflow.payment = {
    id: "payment-1",
    mandatory: true,
    amount: "12500.00",
    currency: "PHP",
    status: "SUBMITTED",
    proofFileId: null,
    reference: "BANK-123",
  }
  workflow.internal = {
    staff: [],
    approvers: [{ id: "admin-1", fullName: "Finance Reviewer" }],
    quotationApproverId: "quotation-admin",
    paymentVerifierId: null,
    events: [],
  }
  workflow.events = [
    {
      id: "payment-submitted",
      type: "PAYMENT_SUBMITTED",
      summary: "Payment proof submitted",
      entityId: "payment-1",
      createdAt: "2026-10-30T09:00:00.000Z",
      actor: null,
    },
  ]
  const actions = await mock(page, workflow, true)
  await page.goto("/messages?request=request-1")
  await page
    .getByRole("button", { name: "Reject payment", exact: true })
    .click()
  expect(actions).toHaveLength(0)
  await expect(page.locator("[data-field-error]")).toHaveText(
    "Enter a reason for rejecting this payment.",
  )
  await expect(
    page.getByRole("textbox", { name: "Verification note", exact: true }),
  ).toBeFocused()
  await page
    .getByRole("textbox", { name: "Verification note", exact: true })
    .fill("Receipt does not match the amount")
  await page
    .getByRole("button", { name: "Reject payment", exact: true })
    .click()
  await expect.poll(() => actions.length).toBe(1)
  expect(actions[0]).toMatchObject({
    type: "VERIFY_PAYMENT",
    approve: false,
    note: "Receipt does not match the amount",
  })
  await expect(
    page.getByRole("button", { name: "Confirm payment", exact: true }),
  ).toBeVisible()
  await page.getByLabel("Verification note", { exact: true }).fill("")
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click()
  await expect.poll(() => actions.length).toBe(2)
  expect(actions[1]).toMatchObject({
    type: "VERIFY_PAYMENT",
    approve: true,
    note: "",
  })
})

for (const width of [1440, 390]) {
  test(
    "head verifies payment, assigns staff and activates a workspace at " +
      width +
      "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      const workflow = fixture()
      workflow.state = "AGREEMENT_PAYMENT_PENDING"
      workflow.permissions.manage = true
      workflow.permissions.isClient = false
      workflow.approval = {
        quotationId: "quote-1",
        amount: "25000.00",
        currency: "PHP",
        approvedById: "client-1",
        approvedAt: "2026-10-30T08:00:00.000Z",
      }
      workflow.payment = {
        id: "payment-1",
        mandatory: true,
        amount: "12500.00",
        currency: "PHP",
        status: "SUBMITTED",
        proofFileId: null,
        reference: "BANK-123",
      }
      workflow.agreement = {
        id: "agreement-1",
        mandatory: true,
        status: "APPROVED",
        documentFileId: null,
        signedFileId: null,
      }
      workflow.project = {
        id: "project-1",
        name: "Business website",
        status: "PLANNED",
      }
      workflow.events = [
        {
          id: "payment-submitted",
          type: "PAYMENT_SUBMITTED",
          summary: "Payment proof submitted",
          entityId: "payment-1",
          createdAt: "2026-10-30T09:00:00.000Z",
          actor: null,
        },
      ]
      workflow.internal = {
        staff: [
          {
            id: "employee-1",
            fullName: "Dani Worker",
            position: "Designer",
            status: "ACTIVE",
            skills: [],
            activeProjectCount: 0,
            assigned: false,
          },
          {
            id: "employee-2",
            fullName: "Alex Designer",
            position: "Designer",
            status: "ACTIVE",
            skills: ["Figma"],
            activeProjectCount: 2,
            assigned: false,
          },
          {
            id: "employee-3",
            fullName: "Sam Worker",
            position: "Designer",
            status: "ON_LEAVE",
            skills: [],
            activeProjectCount: 1,
            assigned: false,
          },
        ],
        approvers: [],
        quotationApproverId: null,
        paymentVerifierId: null,
        events: [],
      }
      await mock(page, workflow, true)
      const actions: Record<string, unknown>[] = []
      const staffingAttempts: Record<string, unknown>[] = []
      await page.route(
        "**/api/request-workflows/request-1/actions",
        async (route) => {
          const action = route.request().postDataJSON() as Record<
            string,
            unknown
          >
          if (action.type === "STAFF_PROJECT") {
            staffingAttempts.push(action)
            if (staffingAttempts.length === 1) {
              await route.fulfill({
                status: 503,
                json: {
                  error: "Staffing temporarily unavailable. Please retry.",
                },
              })
              return
            }
            for (const person of workflow.internal!.staff)
              person.assigned = (action.employeeIds as string[]).includes(
                person.id,
              )
          }
          actions.push(action)
          if (action.type === "VERIFY_PAYMENT") {
            workflow.payment!.status = "VERIFIED"
            workflow.state = "READY_FOR_ACTIVATION"
          }
          if (action.type === "ACTIVATE_PROJECT") {
            workflow.state = "ACTIVE_PROJECT"
            workflow.project!.status = "IN_PROGRESS"
            workflow.events.push({
              id: "project-activated",
              type: "PROJECT_ACTIVATED",
              summary: "Your service is active.",
              entityId: "project-1",
              createdAt: "2026-11-06T08:00:00.000Z",
              actor: null,
            })
          }
          workflow.version++
          await route.fulfill({ json: workflow })
        },
      )
      await page.goto("/messages?request=request-1")
      await expect(
        page.getByRole("button", { name: "Activate project", exact: true }),
      ).toHaveCount(0)
      await page
        .getByRole("button", { name: "Confirm payment", exact: true })
        .click()
      await page
        .getByRole("button", { name: "Hide service details", exact: true })
        .click()
      await page
        .getByRole("button", { name: "Open request actions", exact: true })
        .click()
      const nextTool = page.getByRole("menuitem", {
        name: "Project activation",
        exact: true,
      })
      await expect(page.getByRole("menuitem").last()).toContainText(
        "Project activation",
      )
      await expect(nextTool).toHaveText("Project activation")
      await nextTool.click()
      await chooseToolBooking(page)
      const setup = page.getByRole("dialog", {
        name: "Activate project",
        exact: true,
      })
      await expect(setup).toBeVisible()
      const activate = setup.getByRole("button", {
        name: "Activate project",
        exact: true,
      })
      await expect(activate).toHaveCount(0)
      await expect(
        setup.getByRole("button", { name: "Approve staffing", exact: true }),
      ).toBeDisabled()
      await expect(
        setup.getByRole("checkbox", { name: /Sam Worker/ }),
      ).toBeDisabled()
      await setup.getByRole("checkbox", { name: /Dani Worker/ }).check()
      await setup.getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(setup).toHaveCount(0)
      await expect(
        page.getByRole("button", { name: "Open request actions", exact: true }),
      ).toBeFocused()
      expect(actions).toHaveLength(1)
      await page
        .getByRole("button", { name: "Open request actions", exact: true })
        .click()
      await nextTool.click()
      await chooseToolBooking(page)
      await expect(
        setup.getByRole("checkbox", { name: /Dani Worker/ }),
      ).not.toBeChecked()
      await setup.getByRole("checkbox", { name: /Dani Worker/ }).check()
      await page.screenshot({
        path: `test-results/project-staffing-modal-${width}.png`,
        fullPage: true,
      })
      await setup
        .getByRole("button", { name: "Approve staffing", exact: true })
        .click()
      await expect(setup.getByRole("alert")).toContainText(
        "Staffing temporarily unavailable",
      )
      await expect(
        setup.getByRole("checkbox", { name: /Dani Worker/ }),
      ).toBeChecked()
      await expect(activate).toHaveCount(0)
      await setup
        .getByRole("button", { name: "Approve staffing", exact: true })
        .click()
      expect(staffingAttempts[0]!.actionId).toBe(staffingAttempts[1]!.actionId)
      await expect(activate).toBeEnabled()
      expect(actions).toHaveLength(2)
      await page.screenshot({
        path: `test-results/project-activation-modal-${width}.png`,
        fullPage: true,
      })
      await activate.click()
      await expect(setup).toHaveCount(0)
      await expect(
        page.getByRole("button", {
          name: "Set up project workspace",
          exact: true,
        }),
      ).toHaveCount(0)
      await expect.poll(() => actions.length).toBe(3)
      expect(actions[0]).toMatchObject({
        type: "VERIFY_PAYMENT",
        approve: true,
      })
      expect(actions[1]).toMatchObject({
        type: "STAFF_PROJECT",
        employeeIds: ["employee-1"],
      })
      expect(actions[2]).toMatchObject({ type: "ACTIVATE_PROJECT" })
      await expect(
        page.getByRole("link", { name: "View Project", exact: true }),
      ).toHaveAttribute("href", "/project-workspace/project-1")
      await expect(
        page.getByRole("checkbox", { name: /Dani Worker/ }),
      ).toHaveCount(0)
      const context = page.getByRole("complementary", {
        name: "Request context",
      })
      await page
        .getByRole("button", { name: "Show service details", exact: true })
        .click()
      const details = context
        .locator("summary")
        .filter({ hasText: /^Request details and actions$/ })
      if (
        (await context.locator("details").first().getAttribute("open")) === null
      )
        await details.click()
      await context
        .getByRole("button", { name: "Manage staff", exact: true })
        .click()
      const manage = page.getByRole("dialog", {
        name: "Manage project staff",
        exact: true,
      })
      await expect(
        manage.getByRole("checkbox", { name: /Dani Worker/ }),
      ).toBeChecked()
      await manage.getByRole("checkbox", { name: /Alex Designer/ }).check()
      await manage
        .getByRole("button", { name: "Save staffing", exact: true })
        .click()
      await expect(manage).toHaveCount(0)
      await expect.poll(() => actions.length).toBe(4)
      expect(actions[3]).toMatchObject({
        type: "STAFF_PROJECT",
        employeeIds: ["employee-1", "employee-2"],
      })
    },
  )
}

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

  test(`sandbox checkout automatically verifies payment after a retry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const workflow = fixture()
    await mock(page, workflow)
    await page.goto("/messages?request=request-1")
    await page
      .getByRole("checkbox", { name: /I have reviewed this quotation/ })
      .check()
    await page
      .getByRole("button", { name: "Accept quotation", exact: true })
      .click()
    const pay = page.getByRole("button", { name: /^Pay ₱12,500\.00$/ })
    await expect(pay).toBeVisible()
    const attempts: Record<string, unknown>[] = []
    await page.route("**/api/request-workflows/request-1/actions", (route) => {
      attempts.push(route.request().postDataJSON() as Record<string, unknown>)
      if (attempts.length === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Checkout unavailable. Try again." },
        })
      workflow.payment!.status = "VERIFIED"
      workflow.state = "READY_FOR_ACTIVATION"
      workflow.payment!.reference =
        "XENDIT-SANDBOX-00000000-0000-4000-8000-000000000001"
      workflow.events.push({
        id: "sandbox-payment-verified",
        type: "PAYMENT_VERIFIED",
        summary:
          "Sandbox card payment succeeded and was automatically verified.",
        entityId: workflow.payment!.id,
        createdAt: "2026-10-30T08:06:00.000Z",
        actor: null,
      })
      workflow.version++
      return route.fulfill({ json: workflow })
    })
    await pay.click()
    await expect.poll(() => attempts.length).toBe(1)
    await expect(pay).toBeEnabled()
    await expect(page.getByLabel("Card number", { exact: true })).toHaveValue(
      "4000 0000 0000 0002",
    )
    await pay.click()
    await expect(
      page.getByText(
        "Payment successful. Your sandbox card payment was automatically verified.",
        { exact: true },
      ),
    ).toBeVisible()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(attempts[0]).toEqual({
      type: "COMPLETE_SANDBOX_PAYMENT",
      actionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      expectedVersion: 4,
    })
    await expect(pay).toHaveCount(0)
    await expect(page.getByText(/awaiting verification/i)).toHaveCount(0)
    await expect(page.getByText(/activation will wait until/i)).toHaveCount(0)
    expect(workflow.state).toBe("READY_FOR_ACTIVATION")
    await expect(
      page.getByRole("button", {
        name: "Set up project workspace",
        exact: true,
      }),
    ).toHaveCount(0)
    await page.reload()
    await expect(
      page.getByText(
        "Payment successful. Your sandbox card payment was automatically verified.",
        { exact: true },
      ),
    ).toBeVisible()
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
    await page
      .getByRole("button", {
        name: "Submit payment proof instead",
        exact: true,
      })
      .click()
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
      contextual: true,
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
    context.getByRole("definition").filter({ hasText: "REQ-2026-1001" }),
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

for (const width of [1440, 390]) {
  test(
    "head manages internal tools from chat details at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      const workflow = fixture()
      workflow.permissions.manage = true
      workflow.permissions.isClient = false
      workflow.internal = {
        staff: [],
        approvers: [],
        quotationApproverId: null,
        paymentVerifierId: null,
        events: [],
      }
      await mock(page, workflow, true)
      await page.goto("/messages?request=request-1")
      const context = page.getByRole("complementary", {
        name: "Request context",
      })
      if (width === 390)
        await context
          .getByText("Request details and actions", { exact: true })
          .click()
      await context
        .locator("summary")
        .filter({ hasText: /^Internal tools$/ })
        .click()
      await context
        .getByRole("button", { name: "Internal notes", exact: true })
        .click()
      const note = page.getByRole("region", {
        name: "Internal note",
        exact: true,
      })
      await expect(note).toBeVisible()
      await expect(note.getByLabel("Note for your team")).toBeVisible()
      await note.getByRole("button", { name: "Cancel", exact: true }).click()
      await context
        .getByRole("button", { name: "Approver assignments", exact: true })
        .click()
      const assignments = page.getByRole("region", {
        name: "Approver assignments",
        exact: true,
      })
      await expect(assignments).toBeVisible()
      await expect(
        assignments.getByRole("combobox", { name: /^Quotation approver/ }),
      ).toBeVisible()
      await expect(
        assignments.getByRole("combobox", { name: /^Payment verifier/ }),
      ).toBeVisible()
      await assignments
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
    },
  )
}
