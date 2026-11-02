import { expect, test } from "@playwright/test"
import type {
  PricingTemplate,
  Service,
} from "../src/features/services/api/services-api"
import { Permissions } from "../src/features/auth/model/permissions"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

const timestamp = "2026-01-01T00:00:00.000Z"
const sharedTemplate: PricingTemplate = {
  id: "shared-pricing",
  name: "Shared pricing",
  pricingModel: "FIXED",
  currency: "PHP",
  amount: "1000.00",
  billingInterval: null,
  isPublic: true,
  createdAt: timestamp,
  updatedAt: timestamp,
}
const unusedTemplate: PricingTemplate = {
  ...sharedTemplate,
  id: "unused-pricing",
  name: "Unused pricing",
}
const service: Service = {
  id: "service-1",
  name: "Test Service",
  description: "A service using reusable pricing.",
  iconKey: "sparkles",
  imageUrl: null,
  imageAltText: null,
  clientRequirements: [],
  requiresConsultation: false,
  consultationNotes: null,
  keyBenefits: [],
  isActive: true,
  pricingTemplateId: sharedTemplate.id,
  pricingTemplate: sharedTemplate,
  packages: [],
  departments: [
    { id: "dept-1", name: "Engineering", code: "ENG", color: "teal" },
  ],
  createdAt: timestamp,
  updatedAt: timestamp,
}

test.describe("Pricing template management", () => {
  test.skip(live, "Uses an offline mocked catalog")

  for (const width of [1440, 390]) {
    test(`customizes shared templates and confirms deletion of unused templates at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "ADMIN", {
        initialServices: [{ ...service }],
        pricingTemplates: [{ ...sharedTemplate }, { ...unusedTemplate }],
      })
      await page.goto("/services")
      await page
        .getByRole("button", { name: "Pricing Templates", exact: true })
        .click()
      const manager = page.getByRole("dialog", {
        name: "Pricing Templates",
        exact: true,
      })
      await expect(manager).toContainText("Used by 1 service: Test Service")
      await expect(
        manager.getByRole("button", { name: "Delete Template", exact: true }),
      ).toBeDisabled()
      await manager
        .getByLabel("Template Name", { exact: true })
        .fill("Monthly support")
      await manager.getByLabel("Pricing Model", { exact: true }).click()
      await page.getByRole("option", { name: "Recurring", exact: true }).click()
      await manager.getByLabel("Amount (PHP)").fill("1500.50")
      await manager
        .getByRole("button", { name: "Save Template", exact: true })
        .click()
      await expect(manager.getByRole("alert")).toHaveText(
        "Select a billing interval",
      )
      await manager.getByLabel("Billing Interval").click()
      await page.getByRole("option", { name: "Monthly", exact: true }).click()
      await manager.getByLabel("Display pricing publicly").uncheck()
      const saved = page.waitForRequest(
        (request) =>
          request.method() === "PUT" &&
          new URL(request.url()).pathname ===
            "/api/services/pricing-templates/shared-pricing",
      )
      await manager
        .getByRole("button", { name: "Save Template", exact: true })
        .click()
      expect((await saved).postDataJSON()).toEqual({
        name: "Monthly support",
        pricingModel: "RECURRING",
        currency: "PHP",
        amount: 1500.5,
        billingInterval: "MONTHLY",
        isPublic: false,
      })
      await expect(
        manager.getByLabel("Pricing Template", { exact: true }),
      ).toContainText("Monthly support")
      await page.screenshot({
        path: testInfo.outputPath(`pricing-template-${width}.png`),
      })
      await manager.getByLabel("Pricing Template", { exact: true }).click()
      await page
        .getByRole("option", { name: "Unused pricing", exact: true })
        .click()
      await manager
        .getByRole("button", { name: "Delete Template", exact: true })
        .click()
      await manager
        .getByRole("button", { name: "Cancel deletion", exact: true })
        .click()
      await expect(
        manager.getByLabel("Template Name", { exact: true }),
      ).toHaveValue("Unused pricing")
      await manager
        .getByRole("button", { name: "Delete Template", exact: true })
        .click()
      await manager
        .getByRole("button", { name: "Delete permanently", exact: true })
        .click()
      await expect(
        manager.getByLabel("Template Name", { exact: true }),
      ).toHaveValue("Monthly support")
      await manager
        .getByRole("button", { name: "Close pricing templates", exact: true })
        .click()
      await page.reload()
      await page
        .getByRole("button", { name: "Edit Test Service", exact: true })
        .click()
      const serviceDialog = page.getByRole("dialog", {
        name: "Edit Service",
        exact: true,
      })
      await serviceDialog
        .getByLabel("Service Name")
        .fill("Unsubmitted service draft")
      await serviceDialog
        .getByRole("navigation", { name: "Service form progress" })
        .getByRole("button", { name: "Pricing" })
        .click()
      await expect(
        serviceDialog.getByLabel("Pricing Template", { exact: true }),
      ).toContainText("Monthly support")
      await serviceDialog
        .getByRole("button", { name: "Customize template", exact: true })
        .click()
      await expect(manager.getByLabel("Amount (PHP)")).toHaveValue("1500.50")
      await expect(manager.getByLabel("Billing Interval")).toContainText(
        "Monthly",
      )
      await manager.getByLabel("Pricing Template", { exact: true }).click()
      await expect(
        page.getByRole("option", { name: "Unused pricing", exact: true }),
      ).toHaveCount(0)
      await page.keyboard.press("Escape")
      await manager
        .getByRole("button", { name: "Close pricing templates", exact: true })
        .click()
      await serviceDialog
        .getByRole("navigation", { name: "Service form progress" })
        .getByRole("button", { name: "Details" })
        .click()
      await expect(serviceDialog.getByLabel("Service Name")).toHaveValue(
        "Unsubmitted service draft",
      )
      await serviceDialog
        .getByRole("button", { name: "Close dialog", exact: true })
        .click()
      await page
        .getByRole("button", { name: "Edit Test Service", exact: true })
        .click()
      await serviceDialog
        .getByRole("navigation", { name: "Service form progress" })
        .getByRole("button", { name: "Pricing" })
        .click()
      await serviceDialog
        .getByLabel("Pricing Template", { exact: true })
        .click()
      await page
        .getByRole("option", { name: "No pricing configured", exact: true })
        .click()
      await serviceDialog
        .getByRole("button", { name: "Save Changes", exact: true })
        .click()
      await expect(serviceDialog).toHaveCount(0)
      await page
        .getByRole("button", { name: "Pricing Templates", exact: true })
        .click()
      await expect(
        manager.getByRole("button", { name: "Delete Template", exact: true }),
      ).toBeEnabled()
      await manager
        .getByRole("button", { name: "Delete Template", exact: true })
        .click()
      await manager
        .getByRole("button", { name: "Delete permanently", exact: true })
        .click()
      await expect(manager).toContainText("No pricing templates yet")
    })
  }

  test("failed template changes preserve input and deletion can be retried", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN", {
      pricingTemplates: [{ ...unusedTemplate }],
    })
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Pricing Templates", exact: true })
      .click()
    const manager = page.getByRole("dialog", {
      name: "Pricing Templates",
      exact: true,
    })
    await manager
      .getByLabel("Template Name", { exact: true })
      .fill("Draft template name")
    await page.route(
      "**/api/services/pricing-templates/unused-pricing",
      (route) =>
        route.fulfill({ status: 403, json: { error: "Permission revoked" } }),
      { times: 1 },
    )
    await manager
      .getByRole("button", { name: "Save Template", exact: true })
      .click()
    await expect(manager.getByRole("alert")).toHaveText("Permission revoked")
    await expect(
      manager.getByLabel("Template Name", { exact: true }),
    ).toHaveValue("Draft template name")
    await manager
      .getByRole("button", { name: "Delete Template", exact: true })
      .click()
    await page.route(
      "**/api/services/pricing-templates/unused-pricing",
      (route) =>
        route.fulfill({
          status: 500,
          json: { error: "Temporary deletion failure" },
        }),
      { times: 1 },
    )
    await manager
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click()
    await expect(manager.getByRole("alert")).toHaveText(
      "Temporary deletion failure",
    )
    await manager
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click()
    await expect(manager).toContainText("No pricing templates yet")
  })

  test("read-only service access hides pricing template management", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN", {
      account: {
        permissions: [Permissions.SERVICES_READ, Permissions.DEPARTMENTS_READ],
      },
      pricingTemplates: [{ ...unusedTemplate }],
    })
    await page.goto("/services")
    await expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Pricing Templates", exact: true }),
    ).toHaveCount(0)
  })
})
