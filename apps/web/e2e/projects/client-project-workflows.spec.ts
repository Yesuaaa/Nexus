import { expect, test, type Page } from "@playwright/test"
import type {
  ClientProjectSummary,
  ProjectWorkspace,
} from "../../src/features/projects/api/projects-api"
import { configureRegressionTest, mockApi } from "../regression-support"

configureRegressionTest()
const timestamp = "2026-11-10T08:00:00.000Z"

async function projectFixture(page: Page, role: "USER" | "STAFF" = "USER") {
  await mockApi(
    page,
    role,
    role === "STAFF"
      ? { account: { headOf: { id: "department-1", name: "Design" } } }
      : undefined,
  )
  // Preview blobs use an opaque iframe origin. Seed only the portal document.
  await page.addInitScript(() => {
    if (window !== window.top) return
    sessionStorage.setItem("nexus.auth.token", "test-session")
    sessionStorage.setItem("nexus.auth.refreshToken", "test-refresh")
  })
  const project: ProjectWorkspace = {
    id: "nex017-project",
    name: "Website launch",
    description: "Initial brief",
    status: "IN_PROGRESS",
    startDate: timestamp,
    createdAt: timestamp,
    workspaceManaged: true,
    canManage: false,
    canReviewChanges: role === "STAFF",
    request: {
      id: "nex017-booking",
      referenceNumber: "NEX017-001",
      service: { name: "Website Development" },
    },
    milestones: [],
    progress: { completed: 1, total: 2 },
    changeRequests: [],
    deliverables: ["Website build", "Design guide"].map((title, index) => ({
      id: `delivery-${index}`,
      title,
      description: "Shared for your review",
      expectedFileType: "Text",
      sentToClientAt: timestamp,
      workflowFile: {
        id: `file-${index}`,
        name: `delivery-${index}.txt`,
        mimeType: "text/plain",
        size: 12,
        createdAt: timestamp,
      },
      clientReviews: [],
    })),
  }
  const rows: ClientProjectSummary[] = Array.from(
    { length: 11 },
    (_, index) => ({
      id: index === 0 ? project.id : `project-${index}`,
      name: index === 0 ? project.name : `Project ${index + 1}`,
      description: "Client project",
      status: index === 10 ? "COMPLETED" : "IN_PROGRESS",
      startDate: timestamp,
      updatedAt: timestamp,
      request: project.request,
      completedTasks: 1,
      taskCount: 2,
      deliverableCount: 2,
    }),
  )
  const state = {
    project,
    rows,
    listMode: "ready" as "ready" | "empty" | "error",
    gate: undefined as Promise<void> | undefined,
    failBrief: true,
    failReview: true,
    failDetail: false,
    failFile: false,
    writes: [] as { path: string; body: Record<string, unknown> }[],
  }
  await page.route("**/api/projects**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === "/api/projects") {
      await state.gate
      if (state.listMode === "error")
        return route.fulfill({
          status: 503,
          json: { error: "Projects temporarily unavailable" },
        })
      return route.fulfill({
        json: state.listMode === "empty" ? [] : state.rows,
      })
    }
    if (path === `/api/projects/${project.id}` && request.method() === "GET") {
      if (state.failDetail)
        return route.fulfill({
          status: 503,
          json: { error: "Project temporarily unavailable" },
        })
      return route.fulfill({ json: project })
    }
    if (path.endsWith("/file"))
      return state.failFile
        ? route.fulfill({
            status: 404,
            json: { error: "Shared deliverable not found" },
          })
        : route.fulfill({ contentType: "text/plain", body: "shared draft" })
    if (request.method() !== "GET") {
      const body = request.postDataJSON() as Record<string, unknown>
      state.writes.push({ path, body })
      if (path.endsWith("/brief")) {
        if (state.failBrief) {
          state.failBrief = false
          return route.fulfill({
            status: 503,
            json: { error: "Brief temporarily unavailable" },
          })
        }
        project.name = body.name as string
        project.description = body.description as string
      } else if (path.endsWith("/review")) {
        if (state.failReview) {
          state.failReview = false
          return route.fulfill({
            status: 503,
            json: { error: "Review temporarily unavailable" },
          })
        }
        const delivery = project.deliverables!.find((item) =>
          path.includes(`/${item.id}/`),
        )!
        delivery.clientReviews = [
          {
            status: body.decision as "APPROVED" | "REVISION_REQUESTED",
            note: body.note as string,
            workflowFileId: delivery.workflowFile.id,
            createdAt: timestamp,
          },
        ]
      } else if (request.method() === "PATCH") {
        const item = project.changeRequests!.find((item) =>
          path.endsWith(`/${item.id}`),
        )!
        item.status = body.decision as "ACCEPTED" | "NOT_APPROVED"
        item.responseNote = body.responseNote as string
        item.reviewedAt = timestamp
        if (item.kind === "CANCELLATION" && item.status === "ACCEPTED")
          project.status = "CANCELLED"
      } else {
        project.changeRequests!.push({
          id: `change-${project.changeRequests!.length}`,
          kind: path.endsWith("/cancellation-requests")
            ? "CANCELLATION"
            : "CHANGE",
          details: body.details as string,
          status: "PENDING",
          responseNote: null,
          createdAt: timestamp,
          reviewedAt: null,
          requestedBy: { fullName: "Client" },
        })
      }
      return route.fulfill({
        status:
          request.method() === "POST" && !path.endsWith("/review") ? 201 : 200,
        json: project,
      })
    }
    return route.fallback()
  })
  return state
}

test("[NEX-017] client browses projects and edits brief and submits validated change and cancellation requests", async ({
  page,
}) => {
  const state = await projectFixture(page)
  await page.goto("/projects")
  const main = page.getByRole("main", { name: "My projects" })
  await expect(
    main.getByRole("button", { name: "View Website launch", exact: true }),
  ).toBeVisible()
  await main
    .getByRole("navigation", { name: "My Projects pages" })
    .getByRole("button", { name: "Page 2", exact: true })
    .click()
  await expect(
    main.getByRole("button", { name: "View Project 11", exact: true }),
  ).toBeVisible()
  await main
    .getByRole("combobox", { name: "Filter projects by status" })
    .click()
  await page.getByRole("option", { name: "Completed", exact: true }).click()
  await expect(
    main.getByRole("button", { name: "View Project 11", exact: true }),
  ).toBeVisible()
  await expect(
    main.getByRole("button", { name: "View Website launch", exact: true }),
  ).toHaveCount(0)
  await main.getByRole("searchbox", { name: "Search projects" }).fill("missing")
  await expect(
    main.getByText("No projects match", { exact: true }),
  ).toBeVisible()
  await main.getByRole("searchbox", { name: "Search projects" }).clear()
  await main
    .getByRole("combobox", { name: "Filter projects by status" })
    .click()
  await page.getByRole("option", { name: "All Statuses", exact: true }).click()
  await main
    .getByRole("button", { name: "View Website launch", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Project details", exact: true })
    .getByRole("link", { name: "Open project", exact: true })
    .click()
  await expect(page).toHaveURL(/\/projects\/nex017-project$/)
  await expect(
    page.getByRole("progressbar", { name: "Overall project progress" }),
  ).toHaveAttribute("aria-valuenow", "50")
  await expect(
    page.getByRole("button", { name: "Accept request", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Edit brief", exact: true }).click()
  const editor = page.getByRole("dialog", {
    name: "Edit project brief",
    exact: true,
  })
  await editor.getByLabel("Project name", { exact: true }).fill("x")
  await editor.getByRole("button", { name: "Save brief", exact: true }).click()
  await expect(editor.getByRole("alert")).toContainText("between 2 and 160")
  expect(state.writes).toHaveLength(0)
  await editor
    .getByLabel("Project name", { exact: true })
    .fill("Updated launch")
  await editor
    .getByRole("textbox", { name: /^Project brief/ })
    .fill("Updated goals")
  await editor.getByRole("button", { name: "Save brief", exact: true }).click()
  // Keep feedback failure visible in results while checking independent recovery.
  await expect
    .soft(page.getByText("Couldn't update the brief", { exact: true }))
    .toBeVisible()
  await expect(editor.getByLabel("Project name", { exact: true })).toHaveValue(
    "Updated launch",
  )
  await editor.getByRole("button", { name: "Save brief", exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Updated launch", exact: true }),
  ).toBeVisible()
  expect(state.writes.slice(0, 2).map((item) => item.body)).toEqual([
    { name: "Updated launch", description: "Updated goals" },
    { name: "Updated launch", description: "Updated goals" },
  ])
  await page
    .getByRole("button", { name: "New project request", exact: true })
    .click()
  let dialog = page.getByRole("dialog", {
    name: "Request a project change",
    exact: true,
  })
  await dialog
    .getByRole("textbox", { name: /^What needs to change/ })
    .fill("short")
  await expect(
    dialog.getByRole("button", { name: "Send change request", exact: true }),
  ).toBeDisabled()
  await dialog
    .getByRole("textbox", { name: /^What needs to change/ })
    .fill("Please change the header layout")
  await dialog
    .getByRole("button", { name: "Send change request", exact: true })
    .click()
  await expect(
    page.getByText("Please change the header layout", { exact: true }),
  ).toBeVisible()
  expect(state.writes.at(-1)?.body).toEqual({
    details: "Please change the header layout",
  })
  await page
    .getByRole("button", { name: "New project request", exact: true })
    .click()
  dialog = page.getByRole("dialog", {
    name: "Request project cancellation",
    exact: true,
  })
  await dialog
    .getByRole("textbox", { name: /^Why are you requesting cancellation/ })
    .fill("Our business priorities changed")
  await dialog
    .getByRole("button", { name: "Send cancellation request", exact: true })
    .click()
  await expect(
    page.getByText("Our business priorities changed", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Request under review", exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Edit brief", exact: true }),
  ).toHaveCount(0)
  expect(state.project.status).toBe("IN_PROGRESS")
  await page.reload()
  await expect(
    page.getByText("Our business priorities changed", { exact: true }),
  ).toBeVisible()
})

test("[NEX-017] client opens shared files and reviews them with revision validation and failed-response recovery", async ({
  page,
}) => {
  const state = await projectFixture(page)
  await page.goto(`/projects/${state.project.id}?tab=deliverables`)
  await page
    .getByRole("link", { name: "View Website build", exact: true })
    .click()
  await expect(page.getByTitle("Preview: delivery-0.txt")).toBeVisible()
  await page
    .getByRole("button", { name: "Request a revision", exact: true })
    .click()
  const dialog = page.getByRole("dialog", {
    name: "Request a revision",
    exact: true,
  })
  await dialog
    .getByRole("textbox", { name: /^What should be revised/ })
    .fill("ok")
  await expect(
    dialog.getByRole("button", { name: "Send revision request", exact: true }),
  ).toBeDisabled()
  expect(state.writes).toHaveLength(0)
  await dialog
    .getByRole("textbox", { name: /^What should be revised/ })
    .fill("Please improve the contrast")
  await dialog
    .getByRole("button", { name: "Send revision request", exact: true })
    .click()
  await expect
    .soft(page.getByText("Couldn't save your response", { exact: true }))
    .toBeVisible()
  await expect(
    dialog.getByRole("textbox", { name: /^What should be revised/ }),
  ).toHaveValue("Please improve the contrast")
  await dialog
    .getByRole("button", { name: "Send revision request", exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByText("Revision requested", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Approve deliverable", exact: true }),
  ).toHaveCount(0)
  expect(state.writes.at(-1)?.body).toEqual({
    decision: "REVISION_REQUESTED",
    note: "Please improve the contrast",
  })
  await page.reload()
  await expect(
    page.getByText("Your revision note: Please improve the contrast", {
      exact: true,
    }),
  ).toBeVisible()
  await page.goto(`/projects/${state.project.id}/deliverables/delivery-1`)
  await page
    .getByRole("button", { name: "Approve deliverable", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Approve this deliverable?", exact: true })
    .getByRole("button", { name: "Approve deliverable", exact: true })
    .click()
  await expect(
    page.getByText("You approved this version.", { exact: true }),
  ).toBeVisible()
  expect(state.writes.at(-1)?.body).toEqual({ decision: "APPROVED", note: "" })
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download", exact: true }).click()
  expect((await download).suggestedFilename()).toBe("delivery-1.txt")
})

test("[NEX-017] project list and deliverable routes expose loading empty and error states and recover on reload", async ({
  page,
}) => {
  const state = await projectFixture(page)
  let release: () => void = () => undefined
  state.gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.goto("/projects")
  await expect(
    page.getByRole("status", { name: /Loading your projects/i }),
  ).toBeVisible()
  state.listMode = "empty"
  release()
  await expect(
    page.getByRole("heading", { name: "No projects yet", exact: true }),
  ).toBeVisible()
  state.listMode = "error"
  await page.reload()
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Projects temporarily unavailable",
  )
  state.listMode = "ready"
  await page.reload()
  await expect(
    page.getByRole("button", { name: "View Website launch", exact: true }),
  ).toBeVisible()
  state.failDetail = true
  await page.goto(`/projects/${state.project.id}/deliverables/delivery-0`)
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Project temporarily unavailable",
  )
  await expect(
    page.getByRole("link", { name: "Back to project", exact: true }),
  ).toHaveAttribute("href", `/projects/${state.project.id}`)
  state.failDetail = false
  state.failFile = true
  await page.reload()
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Shared deliverable not found",
  )
  state.failFile = false
  await page.reload()
  await expect(page.getByTitle("Preview: delivery-0.txt")).toBeVisible()
})

test("[NEX-017] department head validates a decline note and reviews client project requests", async ({
  page,
}) => {
  const state = await projectFixture(page, "STAFF")
  state.project.changeRequests = ["CHANGE", "CANCELLATION"].map(
    (kind, index) => ({
      id: `request-${index}`,
      kind: kind as "CHANGE" | "CANCELLATION",
      details: `Client request ${index}`,
      status: "PENDING",
      responseNote: null,
      createdAt: timestamp,
      reviewedAt: null,
      requestedBy: { fullName: "Client" },
    }),
  )
  await page.goto(`/projects/${state.project.id}`)
  const change = page
    .getByRole("listitem")
    .filter({ hasText: "Client request 0" })
  await change.getByRole("button", { name: "Not approve", exact: true }).click()
  const decline = page.getByRole("dialog", {
    name: "Decline change request",
    exact: true,
  })
  await expect(
    decline.getByRole("button", { name: "Not approve", exact: true }),
  ).toBeDisabled()
  await decline
    .getByLabel("Response to client (required)", { exact: true })
    .fill("The agreed scope must remain")
  await decline
    .getByRole("button", { name: "Not approve", exact: true })
    .click()
  await expect(change.getByText("Not approved", { exact: true })).toBeVisible()
  await expect(
    change.getByText("Response: The agreed scope must remain", { exact: true }),
  ).toBeVisible()
  const cancellation = page
    .getByRole("listitem")
    .filter({ hasText: "Client request 1" })
  await cancellation
    .getByRole("button", { name: "Approve cancellation", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Approve project cancellation?", exact: true })
    .getByRole("button", { name: "Approve cancellation", exact: true })
    .click()
  await expect(
    cancellation.getByText("Cancelled", { exact: true }),
  ).toBeVisible()
  expect(state.writes.at(-1)?.body).toEqual({
    decision: "ACCEPTED",
    responseNote: "",
  })
})
