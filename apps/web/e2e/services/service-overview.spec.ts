import { expect, test } from "@playwright/test"
import type {
  Service,
  ServicePackage,
  PricingTemplate,
} from "../../src/features/services/api/services-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()
const date = "2026-01-01T00:00:00.000Z"
const template: PricingTemplate = {
  id: "price-1",
  name: "Fixed",
  pricingModel: "FIXED",
  currency: "PHP",
  amount: "1000.00",
  billingInterval: null,
  isPublic: true,
  createdAt: date,
  updatedAt: date,
}
const services: Service[] = Array.from({ length: 12 }, (_, index) => ({
  id: `service-${index}`,
  name: `Service ${String(index + 1).padStart(2, "0")}`,
  description: "Test service",
  iconKey: "sparkles",
  imageUrl: null,
  imageAltText: null,
  clientRequirements: [],
  requiresConsultation: index % 2 === 0,
  requiresAgreement: true,
  requiresPayment: false,
  requiresQuotationApproval: false,
  consultationNotes: null,
  keyBenefits: [],
  isActive: true,
  pricingTemplateId: index < 3 ? template.id : null,
  pricingTemplate: index < 3 ? template : null,
  packages: Array.from(
    { length: index % 4 },
    (_, item) => ({ id: `package-${index}-${item}` }) as ServicePackage,
  ),
  departments: [
    {
      id: index % 2 ? "marketing" : "design",
      name: index % 2 ? "Marketing" : "Design",
      code: null,
      color: "blue",
    },
  ],
  createdAt: date,
  updatedAt: date,
}))

for (const role of ["ADMIN", "SUPERADMIN"] as const) {
  test(`${role} sees global metrics and can filter and paginate requirements`, async ({
    page,
  }, testInfo) => {
    await restoreSession(page, role, {
      initialServices: services,
      pricingTemplates: [template],
    })
    await page.goto("/services/overview")
    await expect(
      page.getByRole("heading", { name: "Service Overview" }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Manage services" }),
    ).toHaveAttribute("href", "/services")
    const figures = page.getByRole("region", { name: "Service figures" })
    await expect(figures).toContainText("12")
    await expect(figures).toContainText("18")
    await expect(figures).toContainText("3 / 12")
    await expect(figures).toContainText("1 / 1")
    await expect(
      page.getByRole("region", { name: "Service Readiness" }),
    ).toContainText("25%")
    await expect(
      page
        .getByRole("region", { name: "Package Distribution" })
        .getByRole("progressbar"),
    ).toHaveCount(5)
    const bars = page
      .getByRole("region", { name: "Package Distribution" })
      .getByRole("progressbar")
    await expect(bars.nth(0)).toHaveAttribute(
      "aria-label",
      "Service 04: 3 packages",
    )
    await expect(bars.nth(1)).toHaveAttribute(
      "aria-label",
      "Service 08: 3 packages",
    )
    if (role === "ADMIN") {
      await page.screenshot({
        path: testInfo.outputPath("service-overview-desktop.png"),
        fullPage: true,
      })
      await page.setViewportSize({ width: 390, height: 844 })
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath("service-overview-mobile.png"),
        fullPage: true,
      })
      await page.setViewportSize({ width: 1280, height: 720 })
    }
    await expect(page.getByText("Showing 1–10 of 12 services")).toBeVisible()
    await page.getByRole("button", { name: "Page 2" }).click()
    await expect(page.getByText("Showing 11–12 of 12 services")).toBeVisible()
    await page.getByLabel("Search services").fill("Service 01")
    await expect(page.getByText("Showing 1–1 of 1 services")).toBeVisible()
    await expect(figures).toContainText("3 / 12")
    await page.getByRole("button", { name: "Reset filters" }).click()
    await page.getByLabel("Filter by pricing").click()
    await page.getByRole("option", { name: "Pricing configured" }).click()
    await expect(page.getByText("Showing 1–3 of 3 services")).toBeVisible()
    await page.getByLabel("Filter by department").click()
    await page.getByRole("option", { name: "Marketing" }).click()
    await expect(page.getByText("Showing 1–1 of 1 services")).toBeVisible()
  })
}

test("empty catalogs have safe counts and empty states", async ({ page }) => {
  await restoreSession(page, "ADMIN", {
    initialServices: [],
    pricingTemplates: [],
  })
  await page.goto("/services/overview")
  await expect(
    page.getByRole("region", { name: "Service Readiness" }),
  ).toContainText("0%")
  await expect(page.getByText("No packages configured yet.")).toBeVisible()
  await expect(page.getByText("No services yet", { exact: true })).toBeVisible()
})

test("catalog errors can be retried without showing fabricated metrics", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN", {
    initialServices: services,
    pricingTemplates: [template],
  })
  let fails = true
  await page.route("**/api/services", (route) =>
    route.fulfill(
      fails
        ? { status: 503, json: { error: "Services unavailable" } }
        : { json: { services } },
    ),
  )
  await page.goto("/services/overview")
  await expect(
    page.getByRole("region", { name: "Service figures" }),
  ).toContainText("Data unavailable")
  fails = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.getByRole("region", { name: "Service figures" }),
  ).toContainText("3 / 12")
})
