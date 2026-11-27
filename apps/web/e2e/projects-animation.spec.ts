import { expect, test } from "@playwright/test"

test("hover reveals a blue overlay above the project image", async ({
  page,
}) => {
  await page.goto("/explore/projects")
  const card = page.locator("article").filter({ hasText: "Jollybee" })
  await card.scrollIntoViewIfNeeded()
  await card.hover()
  const overlay = card.locator('div[aria-hidden="true"]')
  await expect(overlay).toHaveCSS("opacity", "1")
  await expect(overlay).toHaveCSS("background-color", "rgba(16, 43, 107, 0.6)")
  await expect(overlay).toHaveCSS("z-index", "10")
})

test("project cards reveal the detail page from the clicked point", async ({
  page,
}) => {
  await page.goto("/explore/projects")
  await page
    .getByRole("link", { name: "View Jollybee project details" })
    .click()
  await expect(page.locator("#module-reveal-mask")).toBeAttached()
  await expect(page).toHaveURL(/\/explore\/projects\/jollybee$/)
  await expect(page.locator("#module-reveal-mask")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Jollybee" })).toBeVisible()
  await page.getByRole("link", { name: "Go Back" }).click()
  await expect(page.locator("#module-reveal-mask")).toBeAttached()
  await expect(page).toHaveURL(/\/explore\/projects$/)
  await expect(page.locator("#module-reveal-mask")).toHaveCount(0)
})

test("project text and cards fade up on their first viewport entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  const heading = page.getByRole("heading", {
    name: "Selected projects",
    exact: true,
  })
  const card = page.locator("article").filter({ hasText: "Jollybee" })

  for (const target of [heading, card]) {
    await page.goto("/explore/projects")
    await expect(target).not.toBeInViewport()
    await expect(target).toHaveCSS("opacity", "0")
    const animated = await target.evaluate(async (element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" })
      const deadline = performance.now() + 1500
      while (performance.now() < deadline) {
        await new Promise(requestAnimationFrame)
        const opacity = Number(getComputedStyle(element).opacity)
        if (opacity > 0 && opacity < 1) return true
      }
      return false
    })
    expect(animated).toBe(true)
    await expect(target).toHaveCSS("opacity", "1")
  }
})

test("project content stays visible with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/explore/projects")
  const heading = page.getByRole("heading", {
    name: "Selected projects",
    exact: true,
  })
  await heading.scrollIntoViewIfNeeded()
  await expect(heading).toHaveCSS("opacity", "1")
  await expect(heading).toHaveCSS("transform", "none")
})

test("the homepage and public listing open the same showcase detail", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page
    .locator("#projects")
    .getByRole("link", { name: "Jollybee" })
    .click()
  await expect(page).toHaveURL(/\/explore\/projects\/jollybee$/)
  await expect(page.getByRole("heading", { name: "Jollybee" })).toBeVisible()
  await expect(page.getByText("2026", { exact: true })).toBeVisible()
  const gallery = page.getByRole("group", { name: "Project images" })
  await expect(gallery.locator("img")).toHaveCount(2)
  await expect(gallery.locator(":scope > span")).toHaveCSS(
    "grid-template-areas",
    '"a a b"',
  )

  await page.goto("/explore/projects")
  await page
    .getByRole("link", { name: "View Jollybee project details" })
    .click()
  await expect(page).toHaveURL(/\/explore\/projects\/jollybee$/)
  await expect(
    page.getByText("A fictional brand campaign.", { exact: true }),
  ).toBeVisible()
})
