import { expect, test } from "@playwright/test"

for (const route of ["/login", "/register", "/internal/login"]) {
  test(`${route} fetches its preloaded font without waiting for CSS`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const fonts: string[] = []
    page.on("request", (request) => {
      if (request.resourceType() === "font") fonts.push(request.url())
    })
    let releaseStyles!: () => void
    const stylesReleased = new Promise<void>((resolve) => {
      releaseStyles = resolve
    })
    await page.route("**/_next/static/**/*.css", async (request) => {
      await stylesReleased
      await request.continue()
    })

    let preloadedFont: string
    try {
      // Holding CSS makes a font discovered through @font-face unable to load.
      const fontRequest = page.waitForRequest(
        (request) => request.resourceType() === "font",
        { timeout: 5000 },
      )
      const response = await page.goto(route, { waitUntil: "commit" })
      preloadedFont = (await fontRequest).url()
      const link = await response?.headerValue("link")
      expect(link).toContain(
        `<${new URL(preloadedFont).pathname}>; rel=preload; as="font"; crossorigin=""`,
      )
    } finally {
      releaseStyles()
    }

    await page.waitForLoadState("load")
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await expect(
      page.getByLabel("Email address", { exact: true }),
    ).toBeVisible()
    // The preloaded resource must be reused by CSS instead of downloading twice.
    expect(fonts).toEqual([preloadedFont])
  })
}

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
  await expect(page.locator("main[lang]")).toHaveCSS("display", "grid")
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator("main[lang]")).toHaveCSS("display", "block")
  await expect(page.locator("aside")).toBeHidden()
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
  page,
}) => {
  const response = await request.get(
    "/_next/image?url=%2Fauth%2Fcommunity-1.webp&w=828&q=70",
    {
      headers: { Accept: "image/webp" },
    },
  )
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toBe("image/webp")
  expect((await response.body()).length).toBeLessThan(100_000)
  const width = await page.evaluate(
    async (base64) => {
      const blob = await fetch(`data:image/webp;base64,${base64}`).then(
        (response) => response.blob(),
      )
      const image = await createImageBitmap(blob)
      const width = image.width
      image.close()
      return width
    },
    (await response.body()).toString("base64"),
  )
  expect(width).toBe(828)
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
