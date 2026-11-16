import { expect, test } from "@playwright/test"
import type { ProjectWorkspace } from "../../src/features/projects/api/projects-api"
import type { InternalConversationHistory } from "../../src/features/request-conversations/api/internal-conversations-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const project: ProjectWorkspace = {
  id: "project-1",
  name: "Business website",
  description: "An accessible five-page website",
  status: "IN_PROGRESS",
  startDate: "2026-11-10T08:00:00.000Z",
  createdAt: "2026-11-10T07:30:00.000Z",
  workspaceManaged: false,
  canManage: false,
  request: {
    id: "request-1",
    referenceNumber: "SR-2026-100",
    service: { name: "Website Development" },
  },
  milestones: [],
  progress: { completed: 1, total: 2 },
  deliverables: [],
  changeRequests: [],
}

async function clientProjectDetails(
  page: Parameters<typeof restoreSession>[0],
) {
  await restoreSession(page, "USER")
  await page.route("**/api/projects/project-1", (route) =>
    route.fulfill({ json: project }),
  )
}

test("[P13-001] client project details exposes navigation to its section views", async ({
  page,
}) => {
  await clientProjectDetails(page)
  await page.goto("/projects/project-1")

  await expect(
    page.getByRole("heading", { name: "Business website", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("href", "/projects/project-1")
  await expect(
    page.getByRole("link", { name: "Deliverables (1)", exact: true }),
  ).toHaveAttribute("href", "/projects/project-1?tab=deliverables")
  await expect(
    page.getByRole("link", { name: "Notes", exact: true }),
  ).toHaveAttribute("href", "/projects/project-1?tab=notes")
  await expect(
    page.getByRole("link", { name: "Team", exact: true }),
  ).toHaveAttribute("href", "/projects/project-1?tab=team")
})

test("[P13-002] client project chat link opens the matching project conversation", async ({
  page,
}) => {
  await clientProjectDetails(page)
  const projectConversation: InternalConversationHistory = {
    conversation: {
      fullName: "Business website",
      imageUrl: null,
      position: "Project group chat",
      department: null,
    },
    participants: [
      { id: "actor", fullName: "Test Person" },
      { id: "staff-1", fullName: "Sam Designer" },
    ],
    project: {
      id: "project-1",
      name: "Business website",
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      workspaceId: "project-1",
      serviceName: "Website Development",
      referenceNumber: "SR-2026-100",
    },
    archived: false,
    canSend: true,
    canSubmitDeliverables: false,
    deliverables: [],
    messages: [
      {
        id: "message-1",
        body: "Project conversation loaded.",
        clientMessageId: "00000000-0000-4000-8000-000000000001",
        createdAt: "2026-11-10T08:30:00.000Z",
        editedAt: null,
        deletedAt: null,
        purgeAt: null,
        sender: { id: "staff-1", fullName: "Sam Designer" },
      },
    ],
    nextCursor: null,
  }
  await page.route(
    "**/api/project-conversations/project-1**",
    async (route) => {
      expect(route.request().headers().authorization).toBe(
        "Bearer test-session",
      )
      if (route.request().url().endsWith("/read"))
        return route.fulfill({
          json: { ok: true, unreadCount: 0, conversationUnreadCount: 0 },
        })
      expect(route.request().method()).toBe("GET")
      await route.fulfill({ json: projectConversation })
    },
  )

  await page.goto("/projects/project-1")
  const conversationResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      "/api/project-conversations/project-1",
  )
  await page.getByRole("link", { name: "Open project chat" }).click()

  expect((await conversationResponse).status()).toBe(200)
  await expect(page).toHaveURL("/messages?project=project-1")
  await expect(
    page
      .getByRole("region", { name: "Project conversation" })
      .getByText("Project conversation loaded.", { exact: true }),
  ).toBeVisible()
})

test("[P13-003] failed client brief updates present the NEX-017 error notification", async ({
  page,
}) => {
  await clientProjectDetails(page)
  let attempts = 0
  await page.route("**/api/projects/project-1/brief", async (route) => {
    attempts += 1
    expect(route.request().method()).toBe("PATCH")
    expect(route.request().postDataJSON()).toEqual({
      name: "Updated website",
      description: "Updated project goals",
    })
    await route.fulfill({
      status: 503,
      json: { error: "Brief temporarily unavailable" },
    })
  })

  await page.goto("/projects/project-1")
  await page.getByRole("button", { name: "Edit brief", exact: true }).click()
  const editor = page.getByRole("dialog", {
    name: "Edit project brief",
    exact: true,
  })
  await editor
    .getByLabel("Project name", { exact: true })
    .fill("Updated website")
  await editor
    .getByRole("textbox", { name: /^Project brief/ })
    .fill("Updated project goals")
  const failedUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === "/api/projects/project-1/brief",
  )
  await editor.getByRole("button", { name: "Save brief", exact: true }).click()

  expect((await failedUpdate).status()).toBe(503)
  expect(attempts).toBe(1)
  await expect(editor).toBeVisible()
  await expect(
    editor.getByRole("button", { name: "Save brief", exact: true }),
  ).toBeEnabled()
  await expect(
    page
      .locator('[data-sileo-viewport][aria-live="polite"]')
      .getByText("Couldn't update the brief", { exact: true }),
  ).toBeVisible()
})
