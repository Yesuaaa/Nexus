import { expect, test } from "@playwright/test"

for (const linkName of ["Flow", "Contact"]) {
  test(`footer navigation to ${linkName} from services stays client-side`, async ({
    page,
  }) => {
    await page.goto("/explore/services")

    let rootDocumentRequests = 0
    page.on("request", (request) => {
      if (
        request.isNavigationRequest() &&
        new URL(request.url()).pathname === "/"
      ) {
        rootDocumentRequests += 1
      }
    })

    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: linkName })
      .click()

    const target = linkName === "Flow" ? "approach" : "contact"
    await expect(page).toHaveURL(new RegExp(`/#${target}$`))
    expect(rootDocumentRequests).toBe(0)
  })
}

test("landing preview uses catalog services and links to the selected service", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({
      json: {
        services: [
          {
            id: "first",
            name: "First service",
            description: "First description",
            imageUrl: null,
          },
          {
            id: "second",
            name: "Second service",
            description: "Second description",
            imageUrl: null,
          },
          {
            id: "third",
            name: "Third service",
            description: "Third description",
            imageUrl: null,
          },
          {
            id: "fourth",
            name: "Fourth service",
            description: "Fourth description",
            imageUrl: null,
          },
          {
            id: "fifth",
            name: "Fifth service",
            description: "Fifth description",
            imageUrl: null,
          },
          {
            id: "sixth",
            name: "Sixth service",
            description: "Sixth description",
            imageUrl: null,
          },
        ],
        total: 6,
        page: 1,
        pageSize: 12,
      },
    }),
  )
  await page.goto("/")
  const section = page.locator("#expertise")
  await expect(
    section.getByRole("link", { name: /first service/i }),
  ).toBeVisible()
  await expect(
    section.getByRole("link", { name: /fifth service/i }),
  ).toBeVisible()
  await expect(
    section.getByRole("link", { name: /sixth service/i }),
  ).toHaveCount(0)
  const serviceLink = section.getByRole("link", { name: /second service/i })
  await serviceLink.hover()
  await expect(section.getByText("Second description")).toBeVisible()
  await expect(
    section.getByRole("link", { name: "View service" }),
  ).toHaveAttribute("href", "/explore/services/second")
  await expect(serviceLink).toHaveAttribute("href", "/explore/services/second")

  const nextService = section.getByRole("link", { name: /third service/i })
  const current = (await serviceLink.boundingBox())!
  const next = (await nextService.boundingBox())!
  const stationaryCursor = {
    clientX: Math.round(current.x + current.width / 2),
    clientY: Math.round(current.y + current.height / 2),
  }
  await page.mouse.move(stationaryCursor.clientX, stationaryCursor.clientY)
  await page.evaluate(
    (top) => window.scrollBy({ top, behavior: "instant" }),
    next.y - current.y,
  )
  // A hover target can change during scroll without any mouse movement.
  await nextService.dispatchEvent("pointermove", stationaryCursor)
  await expect(section.getByText("Second description")).toBeVisible()

  await page.mouse.move(stationaryCursor.clientX + 16, stationaryCursor.clientY)
  await expect(section.getByText("Third description")).toBeVisible()
})

test("the pinned hero canvas pauses behind Services and resumes on return", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({ json: { services: [], total: 0, page: 1 } }),
  )
  await page.goto("/")
  const canvas = page.locator("[data-pinned-hero] canvas")
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d")!
    const clear = context.clearRect.bind(context)
    let paints = 0
    context.clearRect = (...args) => {
      element.dataset.paintCount = String(++paints)
      clear(...args)
    }
  })

  const paints = () =>
    canvas.evaluate((element) => Number(element.dataset.paintCount ?? 0))
  await expect.poll(paints).toBeGreaterThan(1)
  await page
    .locator("#expertise")
    .evaluate((section) => section.scrollIntoView({ behavior: "instant" }))
  await expect(canvas).toBeInViewport()
  await expect
    .poll(() =>
      canvas.evaluate(
        (element) =>
          new Promise<number>((resolve) => {
            const before = Number(element.dataset.paintCount)
            window.setTimeout(
              () => resolve(Number(element.dataset.paintCount) - before),
              180,
            )
          }),
      ),
    )
    .toBe(0)

  const pausedPaints = await paints()
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await expect.poll(paints).toBeGreaterThan(pausedPaints)
})

test("landing preview provides retry when the catalog is unavailable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({ status: 503, json: {} }),
  )
  await page.goto("/")
  const section = page.locator("#expertise")
  await expect(section.getByRole("alert")).toBeVisible()
  await expect(section.getByRole("button", { name: "Try again" })).toBeVisible()
})

test("a slow service opens with its content ready for the reveal", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/explore/services")
  await page
    .getByRole("link", { name: "View details for Test Service" })
    .click()
  await expect(page.locator("#module-reveal-mask")).toBeAttached()
  await expect(
    page.getByRole("heading", { name: "Test Service" }),
  ).toBeVisible()
  await expect(
    page.getByText("A clearer identity", { exact: true }),
  ).toBeVisible()
  await expect(page.locator("#module-reveal-mask")).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Create an Account to Start Your Inquiry" }),
  ).toHaveAttribute("href", "/register?service=service-1")
})

test("service detail serves content without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  })
  try {
    const page = await context.newPage()
    expect((await page.goto("/explore/services/service-1"))?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { name: "Test Service" }),
    ).toBeVisible()
  } finally {
    await context.close()
  }
})

test("missing service returns 404 and links back to the catalog", async ({
  page,
}) => {
  expect((await page.goto("/explore/services/missing-service"))?.status()).toBe(
    404,
  )
  await expect(
    page.getByRole("heading", { name: "Service not found" }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Explore services", exact: true }),
  ).toHaveAttribute("href", "/explore/services")
})

test("Go Back restores the service search and page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.route("**/api/public/services?*", async (route) => {
    const { searchParams } = new URL(route.request().url())
    await route.fulfill({
      json: {
        services: [
          {
            id: "service-1",
            name: "Test Service",
            description: "Description",
            imageUrl: null,
          },
        ],
        total: 13,
        pageSize: 12,
        page: Number(searchParams.get("page")),
      },
    })
  })
  await page.goto("/explore/services")
  await page.getByRole("searchbox", { name: "Search services" }).fill("Test")
  await expect(page).toHaveURL("/explore/services?q=Test")
  await page
    .getByRole("combobox", { name: "Filter services by category" })
    .click()
  await page.getByRole("option", { name: "Web & Development" }).click()
  await expect(page).toHaveURL("/explore/services?q=Test&category=code")
  await page.getByRole("link", { name: "Next" }).click()
  await expect(page.getByText("Page 2 of 2")).toBeVisible()
  await page
    .getByRole("link", { name: "View details for Test Service" })
    .click()
  await expect(page.locator("#module-reveal-mask")).toHaveCount(0)
  await page.getByRole("link", { name: "Go Back" }).click()
  await expect(page.locator("#module-reveal-mask")).toBeAttached()
  await expect(page).toHaveURL("/explore/services?q=Test&page=2&category=code")
  await expect(page.locator("#module-reveal-mask")).toHaveCount(0)
  await expect(
    page.getByRole("searchbox", { name: "Search services" }),
  ).toHaveValue("Test")
  await expect(
    page.getByRole("combobox", { name: "Filter services by category" }),
  ).toContainText("Web & Development")
  await expect(page.getByText("Page 2 of 2")).toBeVisible()
})
