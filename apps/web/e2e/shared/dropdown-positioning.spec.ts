import { expect, test, type Locator } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "../regression-support"

configureRegressionTest()

async function expectAnchoredPopup(trigger: Locator, popup: Locator) {
  await trigger.scrollIntoViewIfNeeded()
  const anchor = await trigger.boundingBox()
  await trigger.click()
  await expect(popup).toBeVisible()
  await expect
    .poll(async () => {
      return popup.evaluate((element, triggerBox) => {
        if (!triggerBox) return false
        const box = element.getBoundingClientRect()
        const visible = window.visualViewport
        const left = visible?.offsetLeft ?? 0
        const top = visible?.offsetTop ?? 0
        const right = left + (visible?.width ?? window.innerWidth)
        const bottom = top + (visible?.height ?? window.innerHeight)
        const separateFromTrigger =
          box.bottom <= triggerBox.y - 1 ||
          box.top >= triggerBox.y + triggerBox.height + 1
        const center = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        )
        return (
          box.left >= left + 7 &&
          box.right <= right - 7 &&
          box.top >= top + 7 &&
          box.bottom <= bottom - 7 &&
          separateFromTrigger &&
          Boolean(center && element.contains(center))
        )
      }, anchor)
    })
    .toBe(true)
}

test.describe("Dropdown positioning", () => {
  test.skip(live, "Uses mocked accounts and catalog data")

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 400 },
  ]) {
    test(`service pricing menus stay anchored above form controls at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await restoreSession(page, "ADMIN")
      await page.goto("/services")
      await page
        .getByRole("button", {
          name: "More actions for Test Service",
          exact: true,
        })
        .click()
      await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
      const dialog = page.getByRole("dialog")
      const progress = dialog.getByRole("navigation", {
        name: "Service form progress",
      })
      await progress.getByRole("button", { name: "Options" }).click()
      await dialog.getByRole("radio", { name: /^Packages/ }).check()
      await dialog.getByRole("button", { name: "Next", exact: true }).click()
      const trigger = dialog.getByLabel("Pricing Model", { exact: true }).last()
      await expectAnchoredPopup(trigger, page.getByRole("listbox"))
      await page.screenshot({
        path: testInfo.outputPath("service-pricing.png"),
      })
      await page.getByRole("option", { name: "Recurring", exact: true }).click()
      await expect(trigger).toHaveText("Recurring")
      const interval = dialog.getByLabel("Billing Interval").last()
      await expectAnchoredPopup(interval, page.getByRole("listbox"))
      await page.getByRole("option", { name: "Monthly", exact: true }).click()
      await expect(interval).toHaveText("Monthly")
    })

    test(`department presets stay visible over a scrolling dialog at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await restoreSession(page, "ADMIN")
      await page.goto("/departments")
      await page
        .getByRole("button", { name: "Create Department", exact: true })
        .click()
      const trigger = page.getByLabel("Company Department Preset")
      await expectAnchoredPopup(trigger, page.getByRole("listbox"))
      await page.screenshot({
        path: testInfo.outputPath("department-presets.png"),
      })
      await page
        .getByRole("option", { name: "Custom Department Name...", exact: true })
        .click()
      await expect(trigger).toContainText("Custom Department Name")
    })
  }

  test("custom filter menus scroll when neither side can fit the full list", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 400 })
    const departments = Array.from({ length: 18 }, (_, index) => ({
      id: `department-${index}`,
      name: `Department ${index + 1}`,
      code: `D${index}`,
      color: "teal" as const,
      description: "",
      headId: null,
      head: null,
      memberCount: 0,
      teamCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }))
    await restoreSession(page, "ADMIN", { initialDepartments: departments })
    await page.goto("/services")
    const trigger = page.getByRole("button", { name: /^Filter by department:/ })
    const menu = page.getByRole("menu", {
      name: "Filter by department",
      exact: true,
    })
    await expectAnchoredPopup(trigger, menu)
    await expect
      .poll(() =>
        menu.evaluate((element) => element.scrollHeight > element.clientHeight),
      )
      .toBe(true)
    await page.screenshot({
      path: testInfo.outputPath("department-filter.png"),
    })
    await page.keyboard.press("End")
    await expect(
      menu.getByRole("menuitemradio", { name: "Department 18", exact: true }),
    ).toBeInViewport()
    await page.keyboard.press("Enter")
    await expect(trigger).toContainText("Department 18")
  })
})
