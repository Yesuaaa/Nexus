import { expect, test } from "@playwright/test"

test("guest login form is visible before JavaScript hydrates", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const response = await page.goto(`${baseURL}/login`)
  expect(response?.status()).toBe(200)
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible()
  await context.close()
})

test("mobile auth does not download or rotate hidden community photos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const photos: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("community-")) photos.push(request.url())
  })
  await page.goto("/login")
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await page.waitForTimeout(6500)
  expect(photos).toEqual([])
})

test("standalone image optimizer resizes and compresses community photos", async ({
  request,
}) => {
  const response = await request.get(
    "/_next/image?url=%2Fauth%2Fcommunity-1.png&w=828&q=70",
    {
      headers: { Accept: "image/webp" },
    },
  )
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toBe("image/webp")
  expect((await response.body()).length).toBeLessThan(100_000)
})

test("desktop carousel keeps keyboard controls and reduced-motion behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1350, height: 940 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/login")
  const first = page.getByRole("button", { name: "Show photo 1", exact: true })
  const second = page.getByRole("button", { name: "Show photo 2", exact: true })
  await expect(first).toHaveAttribute("aria-current", "true")
  await second.focus()
  await page.keyboard.press("Enter")
  await expect(second).toHaveAttribute("aria-current", "true")
  await expect
    .poll(() =>
      page
        .locator("aside img")
        .last()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(1)
})

test("the photo source matches the layout at its exact 850px breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 850, height: 940 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/login")
  await expect(page.locator("aside")).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator("aside img")
        .last()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(1)
})

test("desktop cover images retain detail across the panel height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1350, height: 940 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/login")
  for (const index of [1, 2, 3]) {
    await page
      .getByRole("button", { name: `Show photo ${index}`, exact: true })
      .click()
    const dimensions = await page
      .locator("aside img")
      .last()
      .evaluate(async (element) => {
        const image = element as HTMLImageElement
        await image.decode()
        const bitmap = await createImageBitmap(
          await fetch(image.currentSrc).then((response) => response.blob()),
        )
        const result = {
          decodedHeight: bitmap.height,
          panelHeight: image.getBoundingClientRect().height,
        }
        bitmap.close()
        return result
      })
    // The third source is shorter than the panel even at its original size.
    expect(dimensions.decodedHeight).toBeGreaterThanOrEqual(
      Math.min(index === 3 ? 793 : 941, dimensions.panelHeight),
    )
  }
})
