import { expect, test } from "@playwright/test"

test("a fresh homepage visit shows the logo loader and releases the page", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  const loader = page.getByRole("status", { name: "Loading Converyn" })
  await expect(loader).toBeVisible()
  await expect(loader).toBeHidden({ timeout: 10000 })
  await expect(
    page.getByRole("link", { name: "Explore services", exact: true }).first(),
  ).toBeVisible()
})

test("reduced motion releases the homepage and navigation does not replay the intro", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(
    page.getByRole("status", { name: "Loading Converyn" }),
  ).toBeHidden()
  await page
    .getByRole("link", { name: "Explore services", exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/explore\/services/)
  await page.goBack()
  await expect(
    page.getByRole("status", { name: "Loading Converyn" }),
  ).toHaveCount(0)
})
