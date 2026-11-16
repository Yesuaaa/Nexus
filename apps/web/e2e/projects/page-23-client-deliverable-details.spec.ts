import { expect, test, type Page } from "@playwright/test"
import type { ProjectWorkspace } from "../../src/features/projects/api/projects-api"
import { configureRegressionTest, mockApi } from "../regression-support"

configureRegressionTest()

const timestamp = "2026-11-10T08:00:00.000Z"
const projectId = "p23-project"
const deliverableId = "p23-deliverable"
const fileName = "Converyn – Design Kit V3.txt"

function projectFixture(
  mimeType = "text/plain",
  status: ProjectWorkspace["status"] = "COMPLETED",
): ProjectWorkspace {
  return {
    id: projectId,
    name: "Aurora launch",
    description: "Client-facing project brief",
    status,
    startDate: timestamp,
    createdAt: timestamp,
    workspaceManaged: true,
    canManage: false,
    canReviewChanges: false,
    request: {
      id: "p23-request",
      referenceNumber: "P23-001",
      service: { name: "Brand design" },
    },
    milestones: [],
    progress: { completed: 4, total: 4 },
    changeRequests: [],
    deliverables: [
      {
        id: deliverableId,
        title: "Approved brand concept",
        description: "Review the final palette and typography treatment.",
        expectedFileType: "Text document",
        sentToClientAt: timestamp,
        workflowFile: {
          id: "p23-file",
          name: fileName,
          mimeType,
          size: 26,
          createdAt: timestamp,
        },
        clientReviews: [],
      },
    ],
  }
}

async function routeProject(
  page: Page,
  project: ProjectWorkspace,
  options: {
    failFile?: boolean
    projectGate?: Promise<void>
    fileGate?: Promise<void>
  } = {},
) {
  await mockApi(page, "USER")
  // Blob preview iframes have an opaque origin; only seed the portal document.
  await page.addInitScript(() => {
    if (window !== window.top) return
    sessionStorage.setItem("nexus.auth.token", "test-session")
    sessionStorage.setItem("nexus.auth.refreshToken", "test-refresh")
  })
  const fileReads: string[] = []
  const writes: { path: string; body: Record<string, unknown> }[] = []
  await page.route(`**/api/projects/${projectId}**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    expect(request.headers().authorization).toBe("Bearer test-session")
    if (path === `/api/projects/${projectId}` && request.method() === "GET") {
      await options.projectGate
      return route.fulfill({ json: project })
    }
    if (
      path ===
        `/api/projects/${projectId}/deliverables/${deliverableId}/file` &&
      request.method() === "GET"
    ) {
      fileReads.push(path)
      await options.fileGate
      if (options.failFile)
        return route.fulfill({
          status: 503,
          json: { error: "File temporarily unavailable" },
        })
      return route.fulfill({
        status: 200,
        contentType: project.deliverables?.[0]?.workflowFile.mimeType,
        body: "Page 23 test deliverable bytes",
      })
    }
    if (
      path ===
        `/api/projects/${projectId}/deliverables/${deliverableId}/review` &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>
      writes.push({ path, body })
      const deliverable = project.deliverables?.[0]
      if (deliverable) {
        deliverable.clientReviews = [
          {
            status: body.decision as "APPROVED" | "REVISION_REQUESTED",
            note: (body.note as string) || null,
            workflowFileId: deliverable.workflowFile.id,
            createdAt: timestamp,
          },
        ]
      }
      return route.fulfill({ json: project })
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } })
  })
  return { fileReads, writes }
}

for (const width of [1440, 768, 390]) {
  test(`P23-WEB-001 client sees the selected shared file and keyboard-accessible project return at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const project = projectFixture()
    const state = await routeProject(page, project)
    await page.goto(`/projects/${projectId}/deliverables/${deliverableId}`)

    await expect(
      page.getByRole("heading", {
        name: "Approved brand concept",
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByTitle(`Preview: ${fileName}`)).toBeVisible()
    const details = page.getByRole("complementary")
    await expect(
      details.getByText("Aurora launch", { exact: true }),
    ).toBeVisible()
    await expect(details.getByText(fileName, { exact: true })).toBeVisible()
    await expect(details.getByText(".txt", { exact: true })).toBeVisible()
    await expect(details.getByText("text/plain", { exact: true })).toBeVisible()
    await expect(
      details.getByText("Review the final palette and typography treatment.", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText("Awaiting your review", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Approve deliverable", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Request a revision", exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`page-23-deliverable-${width}.png`),
      fullPage: true,
    })
    expect(state.fileReads).toEqual([
      `/api/projects/${projectId}/deliverables/${deliverableId}/file`,
    ])
    expect(state.writes).toEqual([])

    const backLink = page.getByRole("link", {
      name: "Back to Aurora launch deliverables",
      exact: true,
    })
    await backLink.focus()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(`/projects/${projectId}?tab=deliverables`)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test("P23-WEB-006 detail announces loading through project and file reads", async ({
  page,
}) => {
  let releaseProject: () => void = () => undefined
  let releaseFile: () => void = () => undefined
  const projectGate = new Promise<void>((resolve) => {
    releaseProject = resolve
  })
  const fileGate = new Promise<void>((resolve) => {
    releaseFile = resolve
  })
  const project = projectFixture()
  const state = await routeProject(page, project, { projectGate, fileGate })

  const navigation = page.goto(
    `/projects/${projectId}/deliverables/${deliverableId}`,
  )
  const loading = page.getByRole("status")
  await expect(loading).toHaveText("Loading deliverable…")
  releaseProject()
  await expect.poll(() => state.fileReads.length).toBe(1)
  await expect(loading).toHaveText("Loading deliverable…")
  releaseFile()
  await navigation
  await expect(
    page.getByRole("heading", {
      name: "Approved brand concept",
      exact: true,
    }),
  ).toBeVisible()
})

test("P23-WEB-002 unsupported MIME types provide a usable source-named download", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const project = projectFixture("application/zip", "IN_PROGRESS")
  const state = await routeProject(page, project)
  await page.goto(`/projects/${projectId}/deliverables/${deliverableId}`)

  await expect(
    page.getByRole("heading", { name: "Preview unavailable", exact: true }),
  ).toBeVisible()
  await expect(page.getByTitle(`Preview: ${fileName}`)).toHaveCount(0)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download file", exact: true }).click()
  expect((await download).suggestedFilename()).toBe(fileName)
  expect(state.fileReads).toHaveLength(1)
  expect(state.writes).toEqual([])
})

test("P23-WEB-003 revision notes enforce the trimmed Unicode minimum and 2,000-character maximum", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const project = projectFixture("text/plain", "IN_PROGRESS")
  const state = await routeProject(page, project)
  await page.goto(`/projects/${projectId}/deliverables/${deliverableId}`)
  await page
    .getByRole("button", { name: "Request a revision", exact: true })
    .click()

  const dialog = page.getByRole("dialog", {
    name: "Request a revision",
    exact: true,
  })
  const note = dialog.getByRole("textbox", {
    name: /^What should be revised/,
  })
  const submit = dialog.getByRole("button", {
    name: "Send revision request",
    exact: true,
  })
  await note.fill("   ")
  await expect(submit).toBeDisabled()
  await note.fill("🙂")
  await expect(submit).toBeDisabled()
  await note.fill("🙂x")
  await expect(submit).toBeEnabled()
  expect(state.writes).toEqual([])

  await note.fill("x".repeat(1999))
  await note.pressSequentially("x")
  await expect(dialog.getByText("2000/2,000", { exact: true })).toBeVisible()
  await note.pressSequentially("x")
  await expect(dialog.getByText("2000/2,000", { exact: true })).toBeVisible()
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByText("Revision requested", { exact: true }),
  ).toBeVisible()
  expect(state.writes).toEqual([
    {
      path: `/api/projects/${projectId}/deliverables/${deliverableId}/review`,
      body: { decision: "REVISION_REQUESTED", note: "x".repeat(2000) },
    },
  ])
})

test("P23-WEB-004 failed file downloads present accessible recovery feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const project = projectFixture("application/zip", "IN_PROGRESS")
  const state = await routeProject(page, project, { failFile: true })
  await page.goto(`/projects/${projectId}/deliverables/${deliverableId}`)

  await expect(
    page.getByRole("heading", { name: "Preview unavailable", exact: true }),
  ).toBeVisible()
  const download = page.getByRole("button", {
    name: "Download file",
    exact: true,
  })
  await download.click()
  await expect(
    page.getByText("Couldn't download file", { exact: true }),
  ).toBeVisible()
  await expect(download).toBeEnabled()
  expect(state.fileReads).toHaveLength(1)
  expect(state.writes).toEqual([])
})

test("P23-WEB-005 keyboard users can confirm one approval on a completed project", async ({
  page,
}) => {
  const project = projectFixture("text/plain", "COMPLETED")
  const state = await routeProject(page, project)
  await page.goto(`/projects/${projectId}/deliverables/${deliverableId}`)

  const approve = page.getByRole("button", {
    name: "Approve deliverable",
    exact: true,
  })
  await approve.focus()
  await page.keyboard.press("Enter")
  const dialog = page.getByRole("dialog", {
    name: "Approve this deliverable?",
    exact: true,
  })
  await expect(dialog).toBeVisible()
  const confirm = dialog.getByRole("button", {
    name: "Approve deliverable",
    exact: true,
  })
  await confirm.focus()
  await page.keyboard.press("Enter")

  await expect(
    page.getByText("You approved this version.", { exact: true }),
  ).toBeVisible()
  expect(state.writes).toEqual([
    {
      path: `/api/projects/${projectId}/deliverables/${deliverableId}/review`,
      body: { decision: "APPROVED", note: "" },
    },
  ])
})
