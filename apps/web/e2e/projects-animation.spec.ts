import { expect, test } from "@playwright/test"

test("project text and cards fade up on viewport entry and replay on return", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.goto("/explore/projects")
  const heading = page.getByRole("heading", {
    name: "Selected projects",
    exact: true,
  })
  const card = page.locator("article").filter({ hasText: "Jollybee" })

  for (const target of [heading, card, heading]) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(target).not.toBeInViewport()
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
