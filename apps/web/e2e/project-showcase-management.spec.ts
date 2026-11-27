import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"
import type {
  ShowcaseEntry,
  ShowcaseEntryInput,
} from "../src/features/projects/model/showcase-projects"

configureRegressionTest()
test.skip(live, "Showcase administration uses isolated API fixtures")

test("showcase rows can be reordered by dragging and keyboard controls", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  let entries: ShowcaseEntry[] = ["Alpha", "Beta", "Gamma"].map(
    (name, index) => ({
      id: name,
      name,
      slug: name.toLowerCase(),
      client: name,
      type: "Test Service",
      image: "/landing/converyn-team-design.webp",
      fictional: true,
      year: 2026,
      description: "Example project",
      galleryLayout: "single-wide",
      additionalImages: [],
      position: index,
      published: true,
      featured: true,
      version: 0,
      archivedAt: null,
    }),
  )
  await page.route(
    /\/api\/project-showcase(?:\/reorder|\?.*)?$/,
    async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          projects: { id: string; version: number }[]
        }
        entries = body.projects.map(({ id }, position) => ({
          ...entries.find((entry) => entry.id === id)!,
          position,
          version: entries.find((entry) => entry.id === id)!.version + 1,
        }))
      }
      await route.fulfill({ json: { projects: entries } })
    },
  )
  await page.goto("/project-showcase")
  const rows = page
    .getByRole("table", { name: "Showcase projects" })
    .getByRole("row")
  await expect(rows.nth(1)).toContainText("Alpha")
  const gamma = rows.filter({ hasText: "Gamma" })
  const handle = gamma.locator(".touch-none")
  const start = (await handle.boundingBox())!
  const target = (await rows.filter({ hasText: "Alpha" }).boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    start.x + start.width / 2,
    target.y + target.height / 2,
    { steps: 20 },
  )
  await expect
    .poll(async () => (await gamma.boundingBox())!.y)
    .toBeLessThan(start.y - 30)
  await page.mouse.up()
  await expect(rows.nth(1)).toContainText("Gamma")
  await rows
    .filter({ hasText: "Alpha" })
    .getByRole("button", { name: "Move Alpha up" })
    .click()
  await expect(rows.nth(1)).toContainText("Alpha")
  await page.reload()
  await expect(rows.nth(1)).toContainText("Alpha")
  await expect(rows.nth(2)).toContainText("Gamma")
})

test("a superadmin can manage showcase entries from the Administration sidebar", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  const entries: ShowcaseEntry[] = []
  await page.route(/\/api\/project-showcase(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON() as ShowcaseEntryInput
      const project = {
        ...input,
        id: "new-entry",
        version: 0,
        archivedAt: null,
      }
      entries.push(project)
      await route.fulfill({ status: 201, json: { project } })
      return
    }
    const archived =
      new URL(route.request().url()).searchParams.get("archived") === "true"
    await route.fulfill({
      json: {
        projects: entries.filter(
          (entry) => Boolean(entry.archivedAt) === archived,
        ),
      },
    })
  })
  await page.route("**/api/project-showcase/new-entry", async (route) => {
    if (route.request().method() === "DELETE") {
      entries.splice(0, 1)
      await route.fulfill({ status: 204 })
      return
    }
    const input = route.request().postDataJSON() as ShowcaseEntryInput
    const project = { ...input, id: "new-entry", version: 1, archivedAt: null }
    entries[0] = project
    await route.fulfill({ json: { project } })
  })
  await page.route("**/api/project-showcase/new-entry/*", async (route) => {
    const archived = route.request().url().endsWith("/archive")
    entries[0] = {
      ...entries[0]!,
      archivedAt: archived ? new Date().toISOString() : null,
      published: false,
      version: entries[0]!.version + 1,
    }
    await route.fulfill({ json: { project: entries[0] } })
  })

  await page.goto("/accounts")
  await page.getByRole("link", { name: "Project Showcase" }).click()
  await expect(page).toHaveURL(/\/project-showcase$/)
  await expect(
    page.getByRole("heading", { name: "Project Showcase", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("No showcase projects yet")).toBeVisible()

  await page
    .getByRole("button", { name: "Add project", exact: true })
    .first()
    .click()
  const editor = page.getByRole("dialog", { name: "Add showcase project" })
  await editor.getByLabel("Project title").fill("Studio Rebrand")
  await editor.getByLabel("Page address").fill("studio-rebrand")
  await editor.getByLabel("Client").fill("Demo Studio")
  await editor.getByRole("combobox", { name: "Service", exact: true }).click()
  await page.getByRole("option", { name: "Test Service", exact: true }).click()
  await editor.getByLabel("Year").fill("2026")
  await editor
    .getByLabel("Description")
    .fill("A new visual identity for the studio.")
  await editor.getByRole("button", { name: "Save project" }).click()
  await expect(editor.getByRole("tab", { name: "Images" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(
    page.getByText("Upload a cover image before saving."),
  ).toBeVisible()
  for (const count of [1, 3, 4, 5, 2]) {
    const accordion = editor.getByRole("button", {
      name: count === 1 ? "1 image" : `${count} images`,
      exact: true,
    })
    if ((await accordion.getAttribute("aria-expanded")) !== "true")
      await accordion.click()
    const layouts = editor.getByRole("group", {
      name: `${count} image layouts`,
    })
    await expect(layouts.getByRole("button")).toHaveCount(count === 1 ? 2 : 3)
    if (count === 1)
      await expect(
        layouts.getByRole("button", { name: "Portrait" }),
      ).toHaveCount(0)
    await layouts.getByRole("button").first().click()
    await expect(
      editor
        .getByRole("tabpanel", { name: "Images" })
        .getByRole("button", { name: /Upload (cover image|image [2-5])/ }),
    ).toHaveCount(count)
  }
  await editor
    .getByRole("group", { name: "2 image layouts" })
    .getByRole("button", { name: "Wide left" })
    .click()
  const imageFiles = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 10
    canvas.height = 10
    const context = canvas.getContext("2d")!
    context.fillStyle = "#203f8c"
    context.fillRect(0, 0, 10, 10)
    return {
      jpg: canvas.toDataURL("image/jpeg").split(",")[1]!,
      png: canvas.toDataURL("image/png").split(",")[1]!,
    }
  })
  await editor.getByRole("button", { name: "Upload cover image" }).click()
  await editor.getByLabel("Choose gallery image").setInputFiles({
    name: "cover.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(imageFiles.jpg, "base64"),
  })
  await expect(
    editor.getByRole("button", { name: "Replace cover image" }),
  ).toBeVisible()
  await editor.getByRole("button", { name: "Upload image 2" }).click()
  await editor.getByLabel("Choose gallery image").setInputFiles({
    name: "detail.png",
    mimeType: "image/png",
    buffer: Buffer.from(imageFiles.png, "base64"),
  })
  await expect(
    editor.getByRole("button", { name: "Replace image 2" }),
  ).toBeVisible()
  await editor.getByRole("tab", { name: "Details" }).click()
  await expect(editor.getByLabel("Project title")).toHaveValue("Studio Rebrand")
  await editor.getByLabel("Publish on the projects page").check()
  await editor.getByLabel("Feature on the homepage when published").check()
  await editor.getByRole("button", { name: "Save project" }).click()
  await expect.poll(() => entries.length).toBe(1)
  expect(entries[0]!.image).toMatch(/^data:image\/webp;base64,/)
  expect(entries[0]!.additionalImages[0]).toMatch(/^data:image\/webp;base64,/)

  const row = page.getByRole("row", { name: /Studio Rebrand/ })
  await expect(row).toContainText("Published")
  await expect(row).toContainText("Showing")
  await row
    .getByRole("button", { name: "More actions for Studio Rebrand" })
    .click()
  await expect(
    page.getByRole("menuitem", { name: "View public project" }),
  ).toBeVisible()
  await page.getByRole("menuitem", { name: "Edit project" }).click()
  const sidePanel = page.getByRole("dialog", { name: "Edit showcase project" })
  await expect(sidePanel.getByLabel("Project title")).toHaveValue(
    "Studio Rebrand",
  )
  await sidePanel.getByRole("tab", { name: "Images" }).click()
  await expect(
    sidePanel.getByRole("button", { name: "Wide left" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    sidePanel.getByRole("button", { name: "Replace image 2" }),
  ).toBeVisible()
  await sidePanel.getByRole("tab", { name: "Details" }).click()
  await sidePanel.getByLabel("Publish on the projects page").uncheck()
  await sidePanel.getByRole("button", { name: "Save changes" }).click()
  await expect(sidePanel).toBeHidden()
  await expect(row).toContainText("Draft")
  await row
    .getByRole("button", { name: "More actions for Studio Rebrand" })
    .click()
  await expect(
    page.getByRole("menuitem", { name: "View public project" }),
  ).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Archive project" }).click()
  await page
    .getByRole("dialog", { name: "Archive project?" })
    .getByRole("button", { name: "Archive project" })
    .click()
  await expect(page.getByText("No showcase projects yet")).toBeVisible()
  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(page.getByRole("row", { name: /Studio Rebrand/ })).toContainText(
    "Archived",
  )
  await page
    .getByRole("button", { name: "More actions for Studio Rebrand" })
    .click()
  await page.getByRole("menuitem", { name: "Delete permanently" }).click()
  await page
    .getByRole("dialog", { name: "Permanently delete project?" })
    .getByRole("button", { name: "Delete permanently" })
    .click()
  await expect(page.getByText("No archived projects")).toBeVisible()
})
