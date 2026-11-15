import { expect, test, type Page } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type {
  AdministrativeConversation,
  ConversationMetadataDetails,
} from "../src/features/request-conversations/api/administrative-conversations-api"
import { Permissions } from "../src/features/auth/model/permissions"

configureRegressionTest()
test.skip(live, "Business metadata oversight uses isolated fixtures")
const stamp = "2026-11-14T08:00:00Z"
const departments = ["Design", "Engineering"].map((name) => ({
  id: name.toLowerCase(),
  name,
}))
const rows: AdministrativeConversation[] = departments.map(
  (department, index) => ({
    id: `conversation-${index}`,
    kind: "service",
    name: `${department.name} Client · ${department.name}`,
    client: { id: `client-${index}`, fullName: `${department.name} Client` },
    department: {
      ...department,
      head: { id: `head-${index}`, fullName: `${department.name} Head` },
    },
    status: "ACTIVE",
    businessStatus: null,
    createdAt: stamp,
    updatedAt: stamp,
    startDate: null,
    lastMessageAt: stamp,
    linkedRecordCount: 1,
    capabilities: {
      inspectMetadata: true,
      readMessages: false,
      downloadFiles: false,
      participate: false,
      markRead: false,
    },
  }),
)
const projectRow: AdministrativeConversation = {
  ...rows[1],
  id: "project-1",
  kind: "project",
  name: "Engineering delivery",
  businessStatus: "COMPLETED",
  status: "ARCHIVED",
  startDate: stamp,
}

async function mockMetadata(page: Page) {
  await mockContacts(page)
  const requests: URL[] = []
  await page.route("**/api/administrative-conversations**", (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname !== "/api/administrative-conversations") {
      const id = url.pathname.split("/").at(-1)
      const item =
        id === projectRow.id
          ? projectRow
          : (rows.find((row) => row.id === id) ?? rows[0])
      const data: ConversationMetadataDetails = {
        conversation: item,
        linkedRecords: [
          {
            id: "request-1",
            title: "Brand identity",
            referenceNumber: "EXP-100",
            status: "UNDER_REVIEW",
            serviceName: "Branding",
            createdAt: stamp,
            updatedAt: stamp,
            project: {
              id: "project-1",
              name: "Brand delivery",
              status: "IN_PROGRESS",
            },
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      }
      return route.fulfill({ json: data })
    }
    let conversations: AdministrativeConversation[] =
      url.searchParams.get("kind") === "project" ? [projectRow] : rows
    if (url.searchParams.get("departmentId"))
      conversations = conversations.filter(
        (row) => row.department?.id === url.searchParams.get("departmentId"),
      )
    if (url.searchParams.get("search"))
      conversations = conversations.filter((row) =>
        row.name
          .toLowerCase()
          .includes(url.searchParams.get("search")!.toLowerCase()),
      )
    return route.fulfill({
      json: {
        conversations,
        departments,
        page: Number(url.searchParams.get("page")),
        pageSize: 10,
        total: conversations.length,
      },
    })
  })
  return requests
}

async function mockContacts(page: Page) {
  await page.route("**/api/internal-conversations/contacts", (route) =>
    route.fulfill({ json: [] }),
  )
}

for (const width of [1440, 390])
  test(`Superadmin inspects business metadata without entering participant threads at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await restoreSession(page, "SUPERADMIN")
    const requests = await mockMetadata(page)
    await page.goto("/messages?mode=internal")
    await page
      .getByRole("link", {
        name: "Business conversation oversight",
        exact: true,
      })
      .click()
    await expect(page).toHaveURL(/\/messages\/oversight$/)
    const forbidden: string[] = []
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname
      if (
        /^\/api\/(?:request|project|internal)-conversations\/[^/]+/.test(
          path,
        ) &&
        !path.endsWith("/contacts")
      )
        forbidden.push(`${request.method()} ${path}`)
    })
    const table = page.getByRole("table", {
      name: "Business conversations",
      exact: true,
    })
    await expect(
      table.getByText("Design Client · Design", { exact: true }),
    ).toBeVisible()
    await expect(
      table.getByText("Engineering Client · Engineering", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("combobox", { name: "Conversation department", exact: true })
      .click()
    await page.getByRole("option", { name: "Engineering", exact: true }).click()
    await expect(
      table.getByText("Design Client · Design", { exact: true }),
    ).toHaveCount(0)
    await expect(
      table.getByText("Engineering Client · Engineering", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("searchbox", {
        name: "Search business conversations",
        exact: true,
      })
      .fill("Engineering")
    await page
      .getByRole("combobox", { name: "Conversation type", exact: true })
      .click()
    await page
      .getByRole("option", { name: "Project conversations", exact: true })
      .click()
    await expect(
      table.getByText("Engineering delivery", { exact: true }),
    ).toBeVisible()
    await expect(table.getByText("Archived", { exact: true })).toBeVisible()
    expect(
      requests.some(
        (url) =>
          url.searchParams.get("kind") === "project" &&
          url.searchParams.get("departmentId") === "engineering" &&
          url.searchParams.get("search") === "Engineering",
      ),
    ).toBe(true)
    await page
      .getByRole("link", {
        name: "Inspect metadata for Engineering delivery",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("heading", { name: "Engineering delivery", exact: true }),
    ).toBeVisible()
    await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible()
    await page.goto(
      "/messages/oversight?kind=service&conversation=conversation-0",
    )
    await expect(
      page.getByRole("heading", {
        name: "Design Client · Design",
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByText("Design Head", { exact: true })).toBeVisible()
    await expect(
      page
        .getByRole("table", { name: "Linked business records", exact: true })
        .getByText("EXP-100"),
    ).toBeVisible()
    await expect(
      page.getByText("Brand delivery · IN PROGRESS", { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: /send|react|edit|delete|download|mark.*read/i,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: /open messages|download|attachment/i }),
    ).toHaveCount(0)
    expect(forbidden).toEqual([])
    await page
      .getByRole("link", {
        name: "Back to business conversations",
        exact: true,
      })
      .click()
    await expect(table).toBeVisible()
    await page
      .getByRole("link", { name: "My conversations", exact: true })
      .click()
    await expect(page).toHaveURL(/\/messages$/)
  })

for (const role of ["ADMIN", "STAFF", "USER"] as const)
  test(`${role} gains no administrative messaging access`, async ({ page }) => {
    await restoreSession(page, role)
    await mockContacts(page)
    let reads = 0
    await page.route("**/api/administrative-conversations**", (route) => {
      reads++
      return route.fulfill({ status: 403, json: { error: "Forbidden" } })
    })
    await page.goto("/messages")
    await expect(
      page.getByRole("link", {
        name: "Business conversation oversight",
        exact: true,
      }),
    ).toHaveCount(0)
    await page.goto("/messages/oversight?kind=project&conversation=project-1")
    await expect(page).toHaveURL(role === "USER" ? /\/dashboard$/ : /\/module$/)
    expect(reads).toBe(0)
  })

for (const missing of [
  Permissions.BUSINESS_CONVERSATIONS_INSPECT,
  Permissions.ORGANIZATION_READ_ALL,
])
  test(`Superadmin metadata access requires effective ${missing} permission`, async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN", {
      account: {
        permissions: accountFor("SUPERADMIN").permissions.filter(
          (permission) => permission !== missing,
        ),
      },
    })
    await mockContacts(page)
    await page.goto("/messages")
    await expect(
      page.getByRole("link", {
        name: "Business conversation oversight",
        exact: true,
      }),
    ).toHaveCount(0)
    await page.goto("/messages/oversight")
    await expect(page).toHaveURL(/\/module$/)
  })

test("Department Head responsibilities do not grant administrative conversation inspection", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "design", name: "Design" } },
  })
  await mockContacts(page)
  let inspections = 0
  await page.route("**/api/administrative-conversations**", (route) => {
    inspections++
    return route.fulfill({ status: 403, json: { error: "Forbidden" } })
  })
  await page.goto("/messages?scope=service")
  await expect(
    page.getByRole("link", {
      name: "Business conversation oversight",
      exact: true,
    }),
  ).toHaveCount(0)
  await page.goto(
    "/messages/oversight?kind=service&conversation=conversation-0",
  )
  await expect(page).toHaveURL(/\/module$/)
  expect(inspections).toBe(0)
})

test("server-denied inspection and unknown payload fields cannot expose private controls or data", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const nestedRequests: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (
      /^\/api\/(?:request|project|internal)-conversations\/[^/]+/.test(path) &&
      !path.endsWith("/contacts")
    )
      nestedRequests.push(path)
  })
  let deny = false
  let capability = true
  await page.route("**/api/administrative-conversations**", (route) => {
    if (deny)
      return route.fulfill({
        status: 403,
        json: { error: "Metadata inspection denied" },
      })
    const item = {
      ...rows[0],
      capabilities: { ...rows[0].capabilities, inspectMetadata: capability },
    }
    const extra = {
      messages: [{ body: "PRIVATE-MESSAGE" }],
      files: [{ name: "PRIVATE-FILE", url: "/private/download" }],
      internalConversation: { body: "PRIVATE-DM" },
      managerReadAt: stamp,
    }
    return route.fulfill({
      json: {
        conversation: item,
        linkedRecords: [],
        total: 0,
        page: 1,
        pageSize: 10,
        ...extra,
      },
    })
  })
  const detail = "/messages/oversight?kind=service&conversation=conversation-0"
  await page.goto(detail)
  await expect(
    page.getByRole("heading", { name: rows[0].name, exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/PRIVATE-(MESSAGE|FILE|DM)/)).toHaveCount(0)
  await expect(page.getByRole("textbox")).toHaveCount(0)
  await expect(
    page.getByRole("button", {
      name: /send|react|edit|delete|download|mark.*read/i,
    }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: /download|attachment|open messages/i }),
  ).toHaveCount(0)
  capability = false
  await page.reload()
  await expect(page.getByText(rows[0].name, { exact: true })).toHaveCount(0)
  deny = true
  await page.reload()
  await expect(
    page.getByRole("alert").filter({ hasText: "Metadata inspection denied" }),
  ).toBeVisible()
  await expect(page.getByText(rows[0].name, { exact: true })).toHaveCount(0)
  expect(nestedRequests).toEqual([])
})

test("a private-thread identifier cannot open a participant view through an oversight deep link", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const paths: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (path.includes("private-thread")) paths.push(path)
  })
  await page.route(
    "**/api/administrative-conversations/service/private-thread?*",
    (route) =>
      route.fulfill({
        status: 404,
        json: { error: "Business conversation not found" },
      }),
  )
  await page.goto(
    "/messages/oversight?kind=service&conversation=private-thread",
  )
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Business conversation not found" }),
  ).toBeVisible()
  expect(paths).toEqual([
    "/api/administrative-conversations/service/private-thread",
  ])
  await expect(page.getByRole("textbox")).toHaveCount(0)
})

test("metadata errors, retry and pagination use the existing read-only UI", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let failed = true
  await page.route("**/api/administrative-conversations**", (route) => {
    if (failed)
      return route.fulfill({
        status: 503,
        json: { error: "Metadata temporarily unavailable" },
      })
    const next = new URL(route.request().url()).searchParams.get("page") === "2"
    return route.fulfill({
      json: {
        conversations: [next ? rows[1] : rows[0]],
        departments,
        total: 11,
        pageSize: 10,
        page: next ? 2 : 1,
      },
    })
  })
  await page.goto("/messages/oversight")
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Metadata temporarily unavailable" }),
  ).toBeVisible()
  failed = false
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  const table = page.getByRole("table", {
    name: "Business conversations",
    exact: true,
  })
  await expect(table.getByText(rows[0].name, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(table.getByText(rows[1].name, { exact: true })).toBeVisible()
})

test("conversation tables keep aligned skeletons on initial and background loads", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const initialList = requestGate()
  const refreshedList = requestGate()
  const initialDetails = requestGate()
  const refreshedDetails = requestGate()
  const linkedRecords = Array.from({ length: 11 }, (_, index) => ({
    id: `request-${index + 1}`,
    title: `Brand identity ${index + 1}`,
    referenceNumber: `EXP-${100 + index}`,
    status: "UNDER_REVIEW",
    serviceName: "Branding",
    createdAt: stamp,
    updatedAt: stamp,
    project: null,
  }))

  await page.route("**/api/administrative-conversations**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/administrative-conversations") {
      const gate = url.searchParams.get("search") ? refreshedList : initialList
      gate.start()
      await gate.pending
      const search = url.searchParams.get("search")?.toLowerCase() ?? ""
      const conversations = rows.filter((row) =>
        row.name.toLowerCase().includes(search),
      )
      return route.fulfill({
        json: {
          conversations,
          departments,
          page: 1,
          pageSize: 10,
          total: conversations.length,
        },
      })
    }

    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const gate = pageNumber === 1 ? initialDetails : refreshedDetails
    gate.start()
    await gate.pending
    return route.fulfill({
      json: {
        conversation: {
          ...(rows.find((row) => row.id === url.pathname.split("/").at(-1)) ??
            rows[0]),
          linkedRecordCount: linkedRecords.length,
        },
        linkedRecords: linkedRecords.slice(
          (pageNumber - 1) * 10,
          pageNumber * 10,
        ),
        page: pageNumber,
        pageSize: 10,
        total: linkedRecords.length,
      },
    })
  })

  await page.goto("/messages/oversight")
  const conversations = page.getByRole("table", {
    name: "Business conversations",
    exact: true,
  })
  await initialList.started
  await expect(conversations.locator("thead th")).toHaveCount(6)
  const listSkeletons = conversations.locator("tbody tr")
  await expect(listSkeletons).toHaveCount(5)
  for (const skeleton of await listSkeletons.all())
    await expect(skeleton.locator("td")).toHaveCount(6)
  await expect(conversations.getByRole("status")).toContainText(
    "Loading business conversations",
  )
  initialList.release()
  await expect(
    conversations.getByText(rows[0].name, { exact: true }),
  ).toBeVisible()

  const search = page.getByRole("searchbox", {
    name: "Search business conversations",
    exact: true,
  })
  await search.fill("Engineering")
  await refreshedList.started
  await expect(conversations).toHaveAttribute("aria-busy", "true")
  await expect(
    conversations.getByText(rows[0].name, { exact: true }),
  ).toBeVisible()
  await expect(
    conversations.getByText(rows[1].name, { exact: true }),
  ).toBeVisible()
  refreshedList.release()
  await expect(
    conversations.getByText(rows[0].name, { exact: true }),
  ).toHaveCount(0)
  await expect(
    conversations.getByText(rows[1].name, { exact: true }),
  ).toBeVisible()

  await page
    .getByRole("link", {
      name: `Inspect metadata for ${rows[1].name}`,
      exact: true,
    })
    .click()
  const records = page.getByRole("table", {
    name: "Linked business records",
    exact: true,
  })
  await initialDetails.started
  await expect(records.locator("thead th")).toHaveCount(4)
  const detailSkeletons = records.locator("tbody tr")
  await expect(detailSkeletons).toHaveCount(5)
  for (const skeleton of await detailSkeletons.all())
    await expect(skeleton.locator("td")).toHaveCount(4)
  await expect(records.getByRole("status")).toContainText(
    "Loading linked business records",
  )
  initialDetails.release()
  await expect(
    records.getByRole("cell").filter({ hasText: "EXP-100" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await refreshedDetails.started
  await expect(records).toHaveAttribute("aria-busy", "true")
  await expect(
    records.getByRole("cell").filter({ hasText: "EXP-100" }),
  ).toBeVisible()
  await expect(detailSkeletons).toHaveCount(10)
  refreshedDetails.release()
  await expect(
    records.getByRole("cell").filter({ hasText: "EXP-110" }),
  ).toBeVisible()
})

function requestGate() {
  let start!: () => void
  let release!: () => void
  const started = new Promise<void>((resolve) => {
    start = resolve
  })
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  return { started, pending, start, release: () => release() }
}
