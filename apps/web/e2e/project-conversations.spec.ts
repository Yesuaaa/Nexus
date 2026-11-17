import { expect, test, type Page } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "./regression-support"
import type { RequestMessage } from "../src/features/request-conversations/api/request-conversations-api"
import type { ConversationSummary } from "../src/features/request-conversations/api/request-conversations-api"

configureRegressionTest()

async function projectChat(page: Page, role: "USER" | "STAFF") {
  await restoreSession(page, role, {
    account: { id: role === "USER" ? "client" : "staff" },
  })
  const participants = [
    { id: "client", fullName: "Casey Client" },
    { id: "staff", fullName: "Sam Designer" },
    { id: "teammate", fullName: "Taylor Developer" },
  ]
  const state = {
    archived: false,
    sends: 0,
    uploads: [] as { uploadId: string; name: string; note?: string }[],
    failNextUpload: false,
    messages: [
      {
        id: "message-1",
        body: "The team is ready.",
        clientMessageId: "00000000-0000-4000-8000-000000000001",
        createdAt: "2026-11-09T08:00:00Z",
        editedAt: null,
        deletedAt: null,
        purgeAt: null,
        sender: participants[2],
      },
    ] as RequestMessage[],
  }
  const booking: ConversationSummary = {
    id: "booking-chat",
    status: "ACTIVE",
    title: "Website booking",
    referenceNumber: null,
    updatedAt: "2026-11-09T09:00:00Z",
    service: { name: "Website Development" },
    client: participants[0],
    acceptedDepartment: {
      id: "design",
      name: "Design",
      head: { id: "head", fullName: "Dani Head" },
    },
    lastMessage: null,
    unreadCount: 0,
  }
  await page.route("**/api/request-conversations", (route) =>
    route.fulfill({
      json: { conversations: [booking], nextCursor: null, unreadCount: 0 },
    }),
  )
  await page.route(
    "**/api/project-workspace/workspace-1/projects/project-1/deliverables/guide/attachment",
    async (route) => {
      const input = route.request().postDataJSON() as {
        uploadId: string
        name: string
        note?: string
      }
      state.uploads.push(input)
      if (
        !state.messages.some(
          (message) => message.clientMessageId === input.uploadId,
        )
      )
        state.messages.push({
          id: "submission-1",
          clientMessageId: input.uploadId,
          body: input.note || "Submitted for review.",
          createdAt: new Date().toISOString(),
          sender: participants[1],
          editedAt: null,
          deletedAt: null,
          purgeAt: null,
          deliverable: {
            id: "guide",
            title: "Brand guide",
            fileName: input.name,
            fileId: "file-1",
            kind: "submission",
          },
        })
      if (state.failNextUpload) {
        state.failNextUpload = false
        return route.fulfill({
          status: 503,
          json: { error: "Response lost. Retry this submission." },
        })
      }
      return route.fulfill({
        status: 201,
        json: { id: "workspace-1", workstreams: [] },
      })
    },
  )
  await page.route("**/api/project-conversations**", async (route) => {
    const request = route.request()
    expect(request.headers().authorization).toBe("Bearer test-session")
    const url = new URL(request.url())
    if (url.pathname === "/api/project-conversations") {
      const matches =
        (url.searchParams.get("view") === "archived") === state.archived
      return route.fulfill({
        json: {
          conversations: matches
            ? [
                {
                  id: "project-1",
                  name: "Website launch",
                  participants,
                  isGroup: true,
                  archived: state.archived,
                  updatedAt:
                    state.messages.at(-1)?.createdAt || "2026-11-09T08:00:00Z",
                  lastMessage: state.messages.at(-1),
                  unreadCount: 0,
                },
              ]
            : [],
          unreadCount: 0,
          nextCursor: null,
        },
      })
    }
    if (url.pathname.endsWith("/read"))
      return route.fulfill({
        json: { ok: true, unreadCount: 0, conversationUnreadCount: 0 },
      })
    if (url.pathname.endsWith("/messages")) {
      if (state.archived)
        return route.fulfill({
          status: 409,
          json: { error: "This project chat is archived and read-only." },
        })
      const input = request.postDataJSON() as {
        body: string
        clientMessageId: string
      }
      const message = {
        ...state.messages[0],
        ...input,
        id: `sent-${++state.sends}`,
        createdAt: new Date().toISOString(),
        sender: participants[role === "USER" ? 0 : 1],
      }
      state.messages.push(message)
      return route.fulfill({ status: 201, json: { message } })
    }
    return route.fulfill({
      json: {
        conversation: {
          fullName: "Website launch",
          imageUrl: null,
          position: "Project group chat",
          department: null,
        },
        participants,
        project: {
          id: "project-1",
          name: "Website launch",
          description: "Build an accessible company website.",
          status: state.archived ? "COMPLETED" : "IN_PROGRESS",
          startDate: "2026-11-09T08:00:00Z",
          workspaceId: "workspace-1",
          serviceName: "Website Development",
          referenceNumber: "SR-WEB-001",
        },
        archived: state.archived,
        canSend: !state.archived,
        canSubmitDeliverables: role === "STAFF" && !state.archived,
        deliverables: [
          {
            id: "guide",
            title: "Brand guide",
            description: "Prepare the brand guide.",
            expectedFileType: "Plain text",
            deliveryStatus: state.messages.some(
              (message) => message.deliverable,
            )
              ? "IN_REVIEW"
              : "NOT_SUBMITTED",
          },
        ],
        messages: state.messages,
        nextCursor: null,
      },
    })
  })
  return state
}

for (const role of ["USER", "STAFF"] as const) {
  test(`${role} searches conversations without mixing module lists`, async ({
    page,
  }) => {
    await projectChat(page, role)
    await page.goto(role === "USER" ? "/messages" : "/messages?scope=project")
    const rail = page.getByRole("navigation", {
      name: "Conversations",
      exact: true,
    })
    const search = rail.getByRole("searchbox", {
      name: "Search conversations",
      exact: true,
    })
    await search.fill("website launch")
    await expect(rail.locator("[data-conversation-id]")).toHaveCount(1)
    await expect(
      rail.locator('[data-conversation-id="project-1"]'),
    ).toBeVisible()
    await search.fill("Taylor developer")
    await expect(
      rail.locator('[data-conversation-id="project-1"]'),
    ).toBeVisible()
    await search.fill("team is ready")
    await expect(
      rail.locator('[data-conversation-id="project-1"]'),
    ).toBeVisible()
    await search.fill("Website booking")
    await expect(
      rail.locator('[data-conversation-id="booking-chat"]'),
    ).toHaveCount(role === "USER" ? 1 : 0)
    if (role === "STAFF")
      await expect(
        rail.getByText("No conversations found.", { exact: true }),
      ).toBeVisible()
    await rail
      .getByRole("button", { name: "Clear conversation search", exact: true })
      .click()
    await expect(rail.locator("[data-conversation-id]")).toHaveCount(
      role === "USER" ? 2 : 1,
    )
  })
}

test("department head topbar and legacy links never mix service and project lists", async ({
  page,
}) => {
  await projectChat(page, "STAFF")
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: accountFor("STAFF", {
          id: "staff",
          headOf: { id: "design", name: "Design" },
        }),
      },
    }),
  )
  await page.route("**/api/internal-conversations/contacts", (route) =>
    route.fulfill({ json: [] }),
  )
  const rail = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await page.goto("/messages?scope=service")
  await expect(rail.locator("[data-conversation-id]")).toHaveCount(1)
  await expect(
    rail.locator('[data-conversation-id="booking-chat"]'),
  ).toHaveCount(1)
  await expect(
    page.getByRole("banner").getByRole("link", { name: /^Messages/ }),
  ).toHaveAttribute("href", "/messages?scope=service")
  await page.goto("/project-workspace")
  await page
    .getByRole("banner")
    .getByRole("link", { name: /^Messages/ })
    .click()
  await expect(page).toHaveURL(/\/messages\?scope=project$/)
  await expect(rail.locator("[data-conversation-id]")).toHaveCount(1)
  await expect(rail.locator('[data-conversation-id="project-1"]')).toHaveCount(
    1,
  )
  await page.goto("/messages?project=project-1")
  await expect(
    rail.locator('[data-conversation-id="booking-chat"]'),
  ).toHaveCount(0)
  await page.goto("/messages?mode=projects&project=project-1")
  await expect(
    page.getByRole("banner").getByRole("link", { name: /^Messages/ }),
  ).toHaveAttribute("href", "/messages?scope=project")
  await expect(
    page.getByRole("region", { name: "Project conversation", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Internal Messages", exact: true })
    .click()
  await expect(page).toHaveURL(/\/messages\?mode=internal$/)
  await expect(
    page.getByRole("link", { name: "Back to client chats", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", {
      name: "Open internal conversations",
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(rail.locator("[data-conversation-id]")).toHaveCount(0)
})

for (const width of [1440, 390]) {
  test(`Project Management separates project messages and preserves scoped history at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await projectChat(page, "STAFF")
    await page.goto("/project-workspace")
    if (width < 768)
      await page.getByRole("button", { name: "Open navigation menu" }).click()
    await page
      .getByRole("link", { name: "Project Messages", exact: true })
      .click()
    await expect(page).toHaveURL(/\/messages\?scope=project$/)
    await expect(
      page.getByRole("heading", { name: "Project Messages", exact: true }),
    ).toBeVisible()
    const nav = page.getByRole("navigation", {
      name: "Conversations",
      exact: true,
    })
    await expect(nav.locator("[data-conversation-id]")).toHaveCount(1)
    await expect(
      nav.locator('[data-conversation-id="booking-chat"]'),
    ).toHaveCount(0)
    const link = nav.getByRole("link", { name: /Website launch/ })
    await expect(link).toHaveAttribute(
      "href",
      "/messages?scope=project&project=project-1",
    )
    await link.click()
    const panel = page.getByRole("region", {
      name: "Project conversation",
      exact: true,
    })
    await expect(
      panel.getByText("The team is ready.", { exact: true }),
    ).toBeVisible()
    await expect(
      panel.getByRole("button", { name: "Open request actions" }),
    ).toHaveCount(0)
    await page
      .getByRole("textbox", { name: "Message Website launch" })
      .fill("Scoped project update")
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click()
    await expect(
      panel.getByText("Scoped project update", { exact: true }),
    ).toBeVisible()
    expect(state.sends).toBe(1)
    await page.reload()
    await expect(
      panel.getByText("Scoped project update", { exact: true }),
    ).toBeVisible()
    if (width < 768)
      await page
        .getByRole("link", { name: "All project conversations" })
        .click()
    await page
      .getByRole("button", { name: "Archived conversations", exact: true })
      .click()
    await expect(page).toHaveURL(/\/messages\?scope=project&view=archived$/)
    state.archived = true
    await page.reload()
    await nav.getByRole("link", { name: /Website launch/ }).click()
    await expect(page).toHaveURL(
      /scope=project&project=project-1&view=archived$/,
    )
    await expect(
      panel.getByText("Archived · Read-only", { exact: true }),
    ).toBeVisible()
    await expect(
      panel.getByRole("button", { name: "Send message" }),
    ).toHaveCount(0)
    if (width < 768) {
      await page
        .getByRole("link", { name: "All project conversations" })
        .click()
      await expect(page).toHaveURL(/\/messages\?scope=project&view=archived$/)
    }
  })
}

test("clients keep unified Messages when opening a scoped project link", async ({
  page,
}) => {
  await projectChat(page, "USER")
  await page.goto("/messages?scope=project&project=project-1")
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible()
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await expect(nav.locator("[data-conversation-id]")).toHaveCount(2)
  await expect(
    page.getByRole("link", { name: "Project Messages", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Switch Workspace", exact: true }),
  ).toHaveCount(0)
})

for (const role of ["ADMIN", "SUPERADMIN"] as const) {
  test(`${role} receives no Project Messages module navigation`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    await page.goto(role === "ADMIN" ? "/employees" : "/accounts")
    await expect(
      page.getByRole("link", { name: "Project Messages", exact: true }),
    ).toHaveCount(0)
  })
}

for (const role of ["USER", "STAFF"] as const) {
  test(`${role} can message the project team and read archived history`, async ({
    page,
  }) => {
    const state = await projectChat(page, role)
    await page.goto("/messages")
    const nav = page.getByRole("navigation", {
      name: "Conversations",
      exact: true,
    })
    const rows = nav.locator("[data-conversation-id]")
    await expect(rows).toHaveCount(role === "USER" ? 2 : 1)
    if (role === "USER")
      await expect(rows.nth(0)).toHaveAttribute(
        "data-conversation-id",
        "booking-chat",
      )
    await expect(rows.nth(role === "USER" ? 1 : 0)).toHaveAttribute(
      "data-conversation-id",
      "project-1",
    )
    await expect(
      page.getByRole("link", { name: "Open project chats" }),
    ).toHaveCount(0)
    await page.getByRole("link", { name: /Website launch/ }).click()
    await expect(page).toHaveURL(
      role === "USER"
        ? /\/messages\?project=project-1$/
        : /\/messages\?scope=project&project=project-1$/,
    )
    const panel = page.getByRole("region", {
      name: "Project conversation",
      exact: true,
    })
    await expect(
      panel.getByText("The team is ready.", { exact: true }),
    ).toBeVisible()
    await expect(
      panel.getByText("Taylor Developer", { exact: true }),
    ).toBeVisible()
    const details = page.locator('aside[aria-label="Project context"]')
    await expect(details).toBeVisible()
    await expect(
      details.getByText("Build an accessible company website.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(details.getByText("SR-WEB-001", { exact: true })).toBeVisible()
    await expect(
      details.getByRole("link", { name: "Open project", exact: true }),
    ).toHaveAttribute(
      "href",
      role === "USER"
        ? "/projects/project-1"
        : "/project-workspace/workspace-1",
    )
    await expect(
      details.getByText("Sam Designer", { exact: false }),
    ).toBeVisible()
    await expect(
      details.getByText("Casey Client", { exact: false }),
    ).toBeVisible()
    await panel.locator('button[aria-controls^="project-context-"]').click()
    await expect(details).toHaveAttribute("aria-hidden", "true")
    await expect(
      panel.getByRole("button", { name: "Open request actions" }),
    ).toHaveCount(0)
    await expect(
      panel.getByRole("button", { name: "Open attachment options" }),
    ).toHaveCount(0)
    await page
      .getByRole("textbox", { name: "Message Website launch" })
      .fill("Here is our project update.")
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click()
    await expect(
      panel.getByText("Here is our project update.", { exact: true }),
    ).toBeVisible()
    expect(state.sends).toBe(1)
    await expect(rows.nth(0)).toHaveAttribute(
      "data-conversation-id",
      "project-1",
    )
    state.archived = true
    await page.reload()
    await expect(
      page.getByText("The chat is archived and read-only.", { exact: false }),
    ).toBeVisible()
    await expect(
      page.getByRole("textbox", { name: "Message Website launch" }),
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "Archived conversations", exact: true })
      .click()
    await expect(page).toHaveURL(/view=archived$/)
    await expect(
      page.getByRole("link", { name: /Website launch/ }),
    ).toBeVisible()
    await page.getByRole("link", { name: /Website launch/ }).click()
    await expect(
      panel.getByText("Archived · Read-only", { exact: true }),
    ).toBeVisible()
    await expect(
      panel.locator('button[aria-controls^="project-context-"]'),
    ).toBeVisible()
    await expect(
      panel.getByRole("button", { name: "Send message" }),
    ).toHaveCount(0)
    expect(state.sends).toBe(1)
  })
}

test("project group chat stays usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await projectChat(page, "USER")
  await page.goto("/messages")
  await page.getByRole("link", { name: /Website launch/ }).click()
  await expect(
    page.getByRole("textbox", { name: "Message Website launch" }),
  ).toBeVisible()
  const details = page.locator('aside[aria-label="Project context"]')
  await expect(details).toBeVisible()
  await details.locator("summary").click()
  await expect(details.getByText("SR-WEB-001", { exact: true })).toBeVisible()
  await page.locator('button[aria-controls^="project-context-"]').click()
  await expect(details).toHaveAttribute("aria-hidden", "true")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByRole("link", { name: "All project conversations" }).click()
  await expect(page.getByRole("link", { name: /Website launch/ })).toBeVisible()
})

test("legacy project-chat links open the shared conversation list", async ({
  page,
}) => {
  await projectChat(page, "USER")
  await page.goto("/messages?mode=projects&project=project-1")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await expect(nav.locator("[data-conversation-id]")).toHaveCount(2)
  await expect(
    page.getByRole("region", { name: "Project conversation", exact: true }),
  ).toBeVisible()
})

for (const width of [1440, 390]) {
  test(`staff submit a workspace deliverable from project chat and safely retry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await projectChat(page, "STAFF")
    state.failNextUpload = true
    await page.goto("/messages?project=project-1")
    await page
      .getByRole("textbox", { name: "Message Website launch" })
      .fill("Unsent chat draft")
    await page.getByRole("button", { name: "Open project tools" }).click()
    await page
      .getByRole("menuitem", { name: "Submit deliverable", exact: true })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Submit deliverable",
      exact: true,
    })
    await expect(
      dialog.getByRole("combobox", { name: "Deliverable", exact: true }),
    ).toHaveText("Brand guide")
    await dialog.getByLabel("Deliverable file", { exact: true }).setInputFiles({
      name: "guide.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Brand guide"),
    })
    await dialog
      .getByRole("textbox", { name: "Submission note (optional)" })
      .fill("Draft ready for review.")
    await dialog
      .getByRole("button", { name: "Submit for review", exact: true })
      .click()
    await expect(dialog.getByRole("alert")).toContainText(
      "Retry this submission",
    )
    await expect(
      dialog.getByRole("textbox", { name: "Submission note (optional)" }),
    ).toHaveValue("Draft ready for review.")
    await dialog
      .getByRole("button", { name: "Submit for review", exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    expect(state.uploads).toHaveLength(2)
    expect(state.uploads[0].uploadId).toBe(state.uploads[1].uploadId)
    expect(state.sends).toBe(0)
    await expect(
      page.getByRole("textbox", { name: "Message Website launch" }),
    ).toHaveValue("Unsent chat draft")
    const chat = page.getByRole("region", {
      name: "Project conversation",
      exact: true,
    })
    await expect(
      chat.getByText("Draft ready for review.", { exact: true }),
    ).toBeVisible()
    await expect(chat.getByText("guide.txt", { exact: true })).toBeVisible()
    await expect(
      chat.getByRole("link", { name: "View deliverable", exact: true }),
    ).toHaveAttribute("href", "/project-workspace/workspace-1?tab=deliverables")
    await page.reload()
    await expect(
      chat.getByText("Draft ready for review.", { exact: true }),
    ).toHaveCount(1)
    state.archived = true
    await page.reload()
    await expect(
      chat.getByRole("button", { name: "Open project tools" }),
    ).toHaveCount(0)
    await expect(
      chat.getByRole("link", { name: "View deliverable", exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

test("client chats offer approved deliverable access without staff submission tools", async ({
  page,
}) => {
  const state = await projectChat(page, "USER")
  state.messages.push({
    ...state.messages[0],
    id: "shared-guide",
    body: "Shared a deliverable.",
    deliverable: {
      id: "guide",
      title: "Brand guide",
      fileName: "final-guide.txt",
      fileId: "file-1",
      kind: "delivery",
    },
  })
  await page.goto("/messages?project=project-1")
  const chat = page.getByRole("region", {
    name: "Project conversation",
    exact: true,
  })
  await expect(
    chat.getByRole("button", { name: "Open project tools" }),
  ).toBeVisible()
  await chat.getByRole("button", { name: "Open project tools" }).click()
  await expect(
    page.getByRole("menuitem", { name: "Open project" }),
  ).toHaveAttribute("href", "/projects/project-1")
  await expect(
    page.getByRole("menuitem", { name: "Submit deliverable" }),
  ).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(chat.getByText("Sent to client", { exact: true })).toBeVisible()
  await expect(
    chat.getByRole("link", { name: "View deliverable", exact: true }),
  ).toHaveAttribute("href", "/projects/project-1/deliverables/guide")
})
