import { expect, test } from "@playwright/test"
import type { WorkspaceDirectoryRow } from "../../src/features/project-workspace/api/project-workspace-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("[NEX-007] manager can rename and archive a workspace with confirmation and recovery", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", {
    account: { headOf: { id: "dept-1", name: "Engineering" } },
  })

  let workspace: WorkspaceDirectoryRow = {
    rowId: "group:workspace-nex007",
    id: "workspace-nex007",
    kind: "group",
    name: "Website launch",
    clientName: "Casey Client",
    statuses: ["IN_PROGRESS"],
    projectCount: 1,
    departmentNames: ["Engineering"],
    updatedAt: "2026-11-10T08:00:00.000Z",
    progress: null,
    canManage: true,
    canRename: true,
  }
  let renameAttempts = 0
  let cancellationCount = 0

  await page.route("**/api/project-workspace**", async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())

    if (
      pathname === "/api/project-workspace/directory" &&
      request.method() === "GET"
    ) {
      const archived =
        new URL(request.url()).searchParams.get("view") === "archive"
      const isCancelled = workspace.statuses.includes("CANCELLED")
      const rows =
        isCancelled === archived ? [workspace] : ([] as WorkspaceDirectoryRow[])
      return route.fulfill({
        json: {
          rows,
          page: 1,
          pageSize: 20,
          total: rows.length,
          totalPages: rows.length ? 1 : 0,
          hasWorkspaces: true,
        },
      })
    }

    if (
      pathname ===
        `/api/project-workspace/${encodeURIComponent(workspace.rowId)}` &&
      request.method() === "PATCH"
    ) {
      renameAttempts += 1
      const input = request.postDataJSON() as { name: string }
      if (renameAttempts === 1)
        return route.fulfill({
          status: 409,
          json: { error: "A workspace with that name already exists." },
        })
      workspace = { ...workspace, name: input.name }
      return route.fulfill({ json: { saved: true } })
    }

    if (
      pathname ===
        `/api/project-workspace/${encodeURIComponent(workspace.rowId)}/cancel` &&
      request.method() === "POST"
    ) {
      cancellationCount += 1
      workspace = {
        ...workspace,
        statuses: ["CANCELLED"],
        canRename: false,
      }
      return route.fulfill({ json: { saved: true } })
    }

    return route.fallback()
  })

  await page.goto("/project-workspace")
  await expect(page.getByText("Website launch", { exact: true })).toBeVisible()

  await page
    .getByRole("button", { name: "More actions for Website launch" })
    .click()
  await page
    .getByRole("menuitem", { name: "Edit project", exact: true })
    .click()
  const editDialog = page.getByRole("dialog", { name: "Edit project" })
  await editDialog.getByLabel("Project name").fill("Client portal")
  await editDialog.getByRole("button", { name: "Save name" }).click()
  await expect(editDialog.getByRole("alert")).toContainText(
    "A workspace with that name already exists.",
  )
  await expect(page.getByText("Website launch", { exact: true })).toBeVisible()
  await expect(editDialog.getByLabel("Project name")).toHaveValue(
    "Client portal",
  )

  await editDialog.getByRole("button", { name: "Save name" }).click()
  await expect(editDialog).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Client portal", exact: true }),
  ).toBeVisible()
  expect(renameAttempts).toBe(2)

  await page
    .getByRole("button", { name: "More actions for Client portal" })
    .click()
  await page.getByRole("menuitem", { name: "Cancel project" }).click()
  let cancelDialog = page.getByRole("dialog", { name: "Cancel this project?" })
  await cancelDialog.getByRole("button", { name: "Keep project" }).click()
  await expect(cancelDialog).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Client portal", exact: true }),
  ).toBeVisible()
  expect(cancellationCount).toBe(0)

  await page
    .getByRole("button", { name: "More actions for Client portal" })
    .click()
  await page.getByRole("menuitem", { name: "Cancel project" }).click()
  cancelDialog = page.getByRole("dialog", { name: "Cancel this project?" })
  await cancelDialog
    .getByRole("button", { name: "Cancel project", exact: true })
    .click()
  await expect(cancelDialog).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Client portal", exact: true }),
  ).toHaveCount(0)
  expect(cancellationCount).toBe(1)

  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(
    page.getByRole("link", { name: "Client portal", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible()
})
