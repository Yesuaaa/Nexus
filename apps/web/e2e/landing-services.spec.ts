import { expect, test } from "@playwright/test"

for (const linkName of ["Flow", "Connect with Us"]) {
  test(`landing navigation to ${linkName} from services stays client-side`, async ({
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

    await page.getByRole("link", { name: linkName }).click()

    const target = linkName === "Flow" ? "approach" : linkName.toLowerCase()
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

test("a landing service opens its details without an image flight", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  const service = {
    id: "first",
    name: "First service",
    description: "First description",
    imageUrl: "/test-service-preview.svg",
    imageAltText: "Service preview",
    clientRequirements: [],
    keyBenefits: [],
    pricing: null,
    packages: [],
  }
  await page.route("**/test-service-preview.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="blue"/></svg>',
    }),
  )
  await page.route("**/api/public/services?*", (route) =>
    route.fulfill({ json: { services: [service], total: 1, page: 1 } }),
  )
  let releaseDetails: () => void = () => {}
  const details = new Promise<void>((resolve) => {
    releaseDetails = resolve
  })
  await page.route("**/api/public/services/first", async (route) => {
    await details
    await route.fulfill({
      json: {
        service: {
          ...service,
          keyBenefits: [
            {
              id: "benefit",
              title: "A clearer identity",
              description: "Stand out.",
            },
          ],
        },
      },
    })
  })

  await page.goto("/")
  const section = page.locator("#expertise")
  const source = section.getByRole("img", { name: "Service preview" })
  const link = section.getByRole("link", { name: "View service" })
  await link.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      source.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  const overlay = page.locator("body > [data-service-image-flight]")
  const benefit = page.getByText("A clearer identity", { exact: true })
  try {
    await link.click()
    await expect(page).toHaveURL(/\/explore\/services\/first$/)
    await expect(overlay).toHaveCount(0)
    await expect(benefit).toHaveCount(0)
  } finally {
    releaseDetails()
  }
  await expect(page.getByRole("img", { name: "Service preview" })).toBeVisible()
  await expect(benefit).toBeVisible()
})
