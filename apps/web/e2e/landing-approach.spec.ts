import { expect, test } from "@playwright/test"

test("the conversation starts when the chat reaches its pinned position", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({ json: { services: [], total: 0, page: 1 } }),
  )
  await page.goto("/")
  await expect(page.locator("#expertise")).toContainText(
    "No services are available right now.",
  )

  const panel = page.locator("#approach aside")
  await panel.evaluate((element) => {
    const header = Number.parseFloat(getComputedStyle(element).top)
    window.scrollBy({
      top: element.getBoundingClientRect().top - header - 120,
      behavior: "instant",
    })
  })
  await page.waitForTimeout(3000)
  await expect(panel.locator('[data-chat="draft"]')).toBeEmpty()
  await expect(panel.getByText("Manager", { exact: true })).toBeHidden()

  await page.evaluate(() => window.scrollBy({ top: 140, behavior: "instant" }))
  await expect(panel.locator('[data-chat="draft"]')).not.toBeEmpty()
  await expect(panel.getByText("Manager", { exact: true })).toBeVisible({
    timeout: 10_000,
  })
})

test("the desktop approach chat stays pinned and restores each stage", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({ json: { services: [], total: 0, page: 1 } }),
  )
  await page.goto("/")
  await expect(page.locator("#expertise")).toContainText(
    "No services are available right now.",
  )

  const approach = page.locator("#approach")
  const stages = approach.getByRole("article")
  const panel = approach.locator("aside")
  const scrollToStage = (index: number) =>
    stages
      .nth(index)
      .evaluate((stage) =>
        stage.scrollIntoView({ block: "center", behavior: "instant" }),
      )

  await scrollToStage(0)
  await expect(panel.getByText("Manager", { exact: true })).toBeVisible()
  await expect(panel).toHaveCSS("position", "sticky")
  const pinnedTop = await panel.evaluate(
    (element) => element.getBoundingClientRect().top,
  )

  for (const [index, label, visibleText, hiddenText] of [
    [1, "Quote", "Accept quotation", "Quotation accepted"],
    [2, "Approve", "Project activated", "Accept quotation"],
    [1, "Quote", "Accept quotation", "Project activated"],
    [0, "Discuss", "Manager", "Accept quotation"],
  ] as const) {
    await scrollToStage(index)
    await expect(panel.getByText(label, { exact: true })).toBeVisible()
    await expect(panel.getByText(visibleText, { exact: true })).toBeVisible()
    await expect(panel.getByText(hiddenText, { exact: true })).toBeHidden()
    await expect
      .poll(() =>
        panel.evaluate(
          (element, top) => Math.abs(element.getBoundingClientRect().top - top),
          pinnedTop,
        ),
      )
      .toBeLessThan(1)
  }

  await page
    .locator("#faq")
    .evaluate((section) =>
      section.scrollIntoView({ block: "start", behavior: "instant" }),
    )
  await expect
    .poll(() =>
      panel.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThan(pinnedTop)
})

test("the approach chat plays each stage and restores the quotation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({ json: { services: [], total: 0, page: 1 } }),
  )
  await page.goto("/")
  await expect(page.locator("#expertise")).toContainText(
    "No services are available right now.",
  )
  const panel = page.locator("#approach aside")
  await page
    .locator("#approach article")
    .first()
    .evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    )
  await expect(panel.getByLabel("The design manager is typing")).toBeVisible()
  await expect(panel.getByText("Manager", { exact: true })).toBeVisible()
  const top = await panel.evaluate(
    (element) => element.getBoundingClientRect().top,
  )
  await page.mouse.wheel(0, 650)
  await expect(
    panel.getByText("Accept quotation", { exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      panel.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeCloseTo(top, 0)
  await page.mouse.wheel(0, 650)
  await expect(
    panel.getByText("Quotation accepted", { exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByText("Commencement requirements verified"),
  ).toBeVisible()
  await expect(
    panel.getByText("Project activated", { exact: true }),
  ).toBeVisible()
  await page.mouse.wheel(0, -650)
  await expect(
    panel.getByText("Accept quotation", { exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByText("Project activated", { exact: true }),
  ).toBeHidden()
  await page.mouse.wheel(0, -650)
  await expect(panel.getByText("Manager", { exact: true })).toBeVisible()
  await expect(
    panel.getByText("Accept quotation", { exact: true }),
  ).toBeHidden()
})

test("the same chat stays in view through all stages on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({ json: { services: [], total: 0, page: 1 } }),
  )
  await page.goto("/")
  await expect(page.locator("#expertise")).toContainText(
    "No services are available right now.",
  )

  const approach = page.locator("#approach")
  const chat = approach.getByRole("region", {
    name: "Project conversation demo",
  })
  await expect(chat).toHaveCount(1)

  for (const [index, message] of [
    [0, "Manager"],
    [1, "Accept quotation"],
    [2, "Project activated"],
    [1, "Accept quotation"],
  ] as const) {
    await approach
      .getByRole("article")
      .nth(index)
      .evaluate((article) => {
        const panel = article.closest("section")!.querySelector("aside")!
        const header = Number.parseFloat(getComputedStyle(panel).top)
        const target = (header + panel.offsetHeight + window.innerHeight) / 2
        const { top, height } = article.getBoundingClientRect()
        window.scrollBy({ top: top + height / 2 - target, behavior: "instant" })
      })
    await expect(chat.getByText(message, { exact: true })).toBeInViewport()
  }
})
