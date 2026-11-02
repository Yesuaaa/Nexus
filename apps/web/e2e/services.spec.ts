import { expect, test } from "@playwright/test"
import { Permissions } from "../src/features/auth/model/permissions"
import {
  configureRegressionTest,
  live,
  restoreSession,
  storedTokens,
} from "./regression-support"

configureRegressionTest()

test.describe("Service management", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  test("read-only service permission hides every mutation action", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN", {
      account: {
        permissions: [Permissions.SERVICES_READ, Permissions.DEPARTMENTS_READ],
      },
    })
    await page.goto("/services")
    await expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
    for (const name of [
      "Create Service",
      "Edit Test Service",
      "More actions for Test Service",
    ]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        0,
      )
    }
    await page.getByRole("button", { name: "View Test Service" }).click()
    const detailsPanel = page.getByRole("dialog")
    await expect(detailsPanel).toContainText(
      "A service used by the regression suite.",
    )
    const panelBounds = await detailsPanel.boundingBox()
    expect(panelBounds).not.toBeNull()
    expect(panelBounds?.x).toBeGreaterThan(600)
    expect(panelBounds?.width).toBeLessThan(620)
  })

  test("service wizard persists consultation and single recurring pricing after reload", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    const selectStep = (name: string) =>
      dialog
        .getByRole("navigation", { name: "Service form progress" })
        .getByRole("button", { name })
        .click()
    await selectStep("Benefits")
    await dialog.getByRole("button", { name: "Add Benefit" }).click()
    await dialog.getByLabel("Benefit Title").fill("Launch with confidence")
    await dialog
      .getByLabel("Benefit Description")
      .fill("A guided process from discovery through delivery.")
    await page.mouse.click(2, 2)
    await page.keyboard.press("Escape")
    await expect(dialog.getByLabel("Benefit Title")).toHaveValue(
      "Launch with confidence",
    )
    await selectStep("Requirements")
    await dialog
      .getByRole("textbox", { name: /Client Requirements/ })
      .fill("  Brand guide  \n\nProject brief")
    await dialog
      .getByLabel("Consultation is required before proceeding")
      .check()
    await dialog.getByLabel("Consultation Notes").fill("Discuss project scope")
    await selectStep("Pricing")
    await dialog.getByLabel("Pricing Template", { exact: true }).click()
    await page
      .getByRole("option", { name: "Create a reusable template" })
      .click()
    await dialog
      .getByLabel("Template Name", { exact: true })
      .fill("Monthly support")
    await dialog.getByLabel("Pricing Model", { exact: true }).click()
    await page.getByRole("option", { name: "Recurring", exact: true }).click()
    await dialog.getByLabel("Amount (PHP)").fill("1500.50")
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Select a billing interval",
    )
    await dialog.getByLabel("Billing Interval").click()
    await page.getByRole("option", { name: "Monthly", exact: true }).click()
    const saved = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        new URL(request.url()).pathname === "/api/services/service-1",
    )
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    expect((await saved).postDataJSON()).toMatchObject({
      clientRequirements: ["Brand guide", "Project brief"],
      requiresConsultation: true,
      consultationNotes: "Discuss project scope",
      keyBenefits: [
        {
          title: "Launch with confidence",
          description: "A guided process from discovery through delivery.",
        },
      ],
      pricingTemplateId: null,
      pricingTemplate: {
        name: "Monthly support",
        pricingModel: "RECURRING",
        amount: 1500.5,
        currency: "PHP",
        billingInterval: "MONTHLY",
        isPublic: true,
      },
      packages: [],
    })
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await page
      .getByRole("button", { name: "View Test Service", exact: true })
      .click()
    for (const text of [
      "Brand guide; Project brief",
      "Discuss project scope",
    ]) {
      await expect(dialog).toContainText(text)
    }
    await dialog.getByRole("button", { name: "Close details" }).click()
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    await selectStep("Benefits")
    await expect(dialog.getByLabel("Benefit Title")).toHaveValue(
      "Launch with confidence",
    )
    await selectStep("Requirements")
    await expect(dialog.getByLabel("Consultation Notes")).toHaveValue(
      "Discuss project scope",
    )
    await dialog
      .getByLabel("Consultation is required before proceeding")
      .uncheck()
    await selectStep("Pricing")
    await expect(
      dialog.getByLabel("Pricing Template", { exact: true }),
    ).toContainText("Monthly support")
    await selectStep("Options")
    await expect(dialog.getByRole("radio", { name: /^Pricing/ })).toBeChecked()
    await expect(
      dialog.getByRole("radio", { name: /^Packages/ }),
    ).not.toBeChecked()
    await expect(
      dialog.getByRole("button", { name: "Save Changes" }),
    ).toHaveCount(0)
    await dialog.getByRole("button", { name: "Next", exact: true }).click()
    await expect(
      dialog.getByLabel("Pricing Template", { exact: true }),
    ).toBeVisible()
    const updated = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        new URL(request.url()).pathname === "/api/services/service-1",
    )
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    expect((await updated).postDataJSON()).toMatchObject({
      requiresConsultation: false,
      consultationNotes: null,
      pricingTemplateId: "pricing-1",
      pricingTemplate: null,
      packages: [],
    })
    await expect(dialog).toHaveCount(0)
  })

  test("service packages are exclusive with pricing and can be replaced during editing", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    const selectStep = (name: string) =>
      dialog
        .getByRole("navigation", { name: "Service form progress" })
        .getByRole("button", { name })
        .click()
    await selectStep("Pricing")
    await dialog.getByLabel("Pricing Template", { exact: true }).click()
    await page
      .getByRole("option", { name: "Create a reusable template" })
      .click()
    // An unfinished draft in the other mode must not block saving packages.
    await selectStep("Options")
    await dialog.getByRole("radio", { name: /^Packages/ }).check()
    await expect(
      dialog.getByRole("button", { name: "Save Changes" }),
    ).toHaveCount(0)
    await dialog.getByRole("button", { name: "Next", exact: true }).click()
    await expect(dialog.getByLabel("Package Name")).toHaveCount(2)
    await expect(
      dialog.getByLabel("Pricing Template", { exact: true }),
    ).toHaveCount(0)
    for (const [index, name] of ["Starter", "Premium"].entries()) {
      await dialog.getByLabel("Package Name").nth(index).fill(name)
      await dialog
        .getByLabel("Description", { exact: true })
        .nth(index)
        .fill(`${name} support package`)
      await dialog
        .getByLabel("Included Features")
        .nth(index)
        .fill(" Email support \n\nMonthly review")
    }
    await dialog.getByLabel("Recommended", { exact: true }).first().check()
    await dialog
      .getByRole("button", { name: "Remove", exact: true })
      .last()
      .click()
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Add at least two packages, or choose Pricing for a single option",
    )
    await dialog.getByRole("button", { name: "Add Package" }).click()
    await dialog.getByLabel("Package Name").last().fill("Premium")
    await dialog
      .getByLabel("Description", { exact: true })
      .last()
      .fill("Premium support package")
    await dialog.getByLabel("Included Features").last().fill("Priority support")
    const saved = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        new URL(request.url()).pathname === "/api/services/service-1",
    )
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    expect((await saved).postDataJSON()).toMatchObject({
      pricingTemplateId: null,
      pricingTemplate: null,
      packages: [
        expect.objectContaining({
          name: "Starter",
          includedFeatures: ["Email support", "Monthly review"],
          isRecommended: true,
        }),
        expect.objectContaining({ name: "Premium" }),
      ],
    })
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    await selectStep("Options")
    await expect(dialog.getByRole("radio", { name: /^Packages/ })).toBeChecked()
    await selectStep("Packages")
    await expect(dialog.getByLabel("Package Name").first()).toHaveValue(
      "Starter",
    )
    await expect(dialog.getByLabel("Package Name").last()).toHaveValue(
      "Premium",
    )
    // Invalid package drafts must not block switching back to single pricing.
    await dialog.getByLabel("Package Name").first().fill("")
    await selectStep("Options")
    await dialog.getByRole("radio", { name: /^Pricing/ }).check()
    await selectStep("Pricing")
    await expect(dialog.getByLabel("Package Name")).toHaveCount(0)
    const updated = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        new URL(request.url()).pathname === "/api/services/service-1",
    )
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    expect((await updated).postDataJSON()).toMatchObject({ packages: [] })
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    await selectStep("Options")
    await expect(dialog.getByRole("radio", { name: /^Pricing/ })).toBeChecked()
  })

  test("service deletion requires deactivation and explicit confirmation", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/services")
    const actions = page.getByRole("button", {
      name: "More actions for Test Service",
    })
    await actions.click()
    await expect(
      page.getByRole("menuitem", { name: "Delete service" }),
    ).toHaveCount(0)
    await page.getByRole("menuitem", { name: "Deactivate service" }).click()
    await page
      .getByRole("button", { name: "Deactivate Service", exact: true })
      .click()
    await expect(
      page.getByRole("row").filter({ hasText: "Test Service" }),
    ).toContainText("Inactive")
    await actions.click()
    await page.getByRole("menuitem", { name: "Delete service" }).click()
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
    await actions.click()
    await page.getByRole("menuitem", { name: "Delete service" }).click()
    await page
      .getByRole("button", { name: "Delete service", exact: true })
      .click()
    await expect(
      page.getByText("No services have been created yet."),
    ).toBeVisible()
  })

  test("service descriptions render untrusted markup as text", async ({
    page,
  }) => {
    const payload = '<img src=x onerror="window.__regressionXss=true">'
    await restoreSession(page, "ADMIN", {
      initialServices: [
        {
          id: "unsafe",
          name: "Untrusted service",
          description: payload,
          iconKey: "sparkles",
          imageUrl: null,
          imageAltText: null,
          clientRequirements: [],
          requiresConsultation: false,
          consultationNotes: null,
          keyBenefits: [],
          isActive: true,
          pricingTemplateId: null,
          pricingTemplate: null,
          packages: [],
          departments: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    })
    await page.goto("/services")
    await expect(page.getByText(payload, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "View Untrusted service" }).click()
    await expect(page.getByRole("dialog")).toContainText(payload)
    expect(
      await page.evaluate(() => Reflect.get(window, "__regressionXss")),
    ).toBeUndefined()
    await expect(page.locator('img[src="x"]')).toHaveCount(0)
  })

  for (const status of [403, 500]) {
    test(`service list handles HTTP ${status} and recovers on retry`, async ({
      page,
    }) => {
      await restoreSession(page, "ADMIN")
      await page.route(
        "**/api/services",
        (route) =>
          route.fulfill({
            status,
            json: { error: "Service list unavailable" },
          }),
        { times: 1 },
      )
      await page.goto("/services")
      await expect(
        page.getByRole("table", { name: "Services" }).getByRole("alert"),
      ).toContainText("Service list unavailable")
      expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
      await expect(
        page.getByRole("rowheader", { name: "Test Service" }),
      ).toHaveCount(0)
      await page.getByRole("button", { name: "Try again" }).click()
      await expect(
        page.getByRole("rowheader", { name: "Test Service" }),
      ).toBeVisible()
    })
  }

  for (const offering of ["Pricing", "Packages"] as const) {
    test(`service creation with ${offering} validates department selection and preserves rejected edits`, async ({
      page,
    }) => {
      await restoreSession(page, "ADMIN")
      await page.goto("/services")
      await page
        .getByRole("button", { name: "Create Service", exact: true })
        .click()
      const dialog = page.getByRole("dialog")
      await dialog.getByLabel("Service Name").fill("Consulting")
      await dialog
        .getByLabel("Description", { exact: false })
        .fill("Business consulting")
      await dialog
        .getByRole("button", { name: "Continue", exact: true })
        .click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Please select at least one responsible department",
      )
      await page
        .getByRole("button", { name: "Select responsible departments" })
        .click()
      await page.getByRole("menuitemcheckbox", { name: "Engineering" }).click()
      await page.keyboard.press("Escape")
      for (let step = 0; step < 3; step++) {
        await dialog
          .getByRole("button", { name: "Continue", exact: true })
          .click()
      }
      await expect(
        dialog.getByRole("radio", { name: /^Pricing/ }),
      ).not.toBeChecked()
      await dialog
        .getByRole("button", { name: "Continue", exact: true })
        .click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Choose Pricing or Packages to continue",
      )
      await dialog
        .getByRole("radio", { name: new RegExp(`^${offering}`) })
        .check()
      await dialog
        .getByRole("button", { name: "Continue", exact: true })
        .click()
      if (offering === "Packages") {
        for (const [index, name] of ["Starter", "Premium"].entries()) {
          await dialog.getByLabel("Package Name").nth(index).fill(name)
          await dialog
            .getByLabel("Description", { exact: true })
            .nth(index)
            .fill(`${name} consulting`)
          await dialog
            .getByLabel("Included Features")
            .nth(index)
            .fill("Business analysis")
        }
      }
      const created = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          new URL(request.url()).pathname === "/api/services",
      )
      await dialog
        .getByRole("button", { name: "Create Service", exact: true })
        .click()
      expect((await created).postDataJSON()).toEqual({
        name: "Consulting",
        description: "Business consulting",
        iconKey: "sparkles",
        departmentIds: ["dept-1"],
        isActive: true,
        imageDataUrl: null,
        imageAltText: null,
        removeImage: false,
        clientRequirements: [],
        requiresConsultation: false,
        requiresAgreement: true,
        requiresPayment: true,
        requiresQuotationApproval: false,
        consultationNotes: null,
        keyBenefits: [],
        pricingTemplateId: null,
        pricingTemplate: null,
        packages:
          offering === "Packages"
            ? [
                expect.objectContaining({
                  name: "Starter",
                  includedFeatures: ["Business analysis"],
                }),
                expect.objectContaining({
                  name: "Premium",
                  includedFeatures: ["Business analysis"],
                }),
              ]
            : [],
      })
      await expect(
        page.getByRole("rowheader", { name: "Consulting", exact: true }),
      ).toBeVisible()
      await page
        .getByRole("button", { name: "Edit Consulting", exact: true })
        .click()
      await dialog.getByLabel("Service Name").fill("Updated Consulting")
      await page.route("**/api/services/service-2", (route) =>
        route.fulfill({ status: 403, json: { error: "Permission revoked" } }),
      )
      const updates: string[] = []
      page.on("request", (request) => {
        if (
          request.method() === "PUT" &&
          new URL(request.url()).pathname === "/api/services/service-2"
        )
          updates.push(request.url())
      })
      for (let step = 0; step < 4; step++) {
        await expect(
          dialog.getByRole("button", { name: "Save Changes" }),
        ).toHaveCount(0)
        await dialog.getByRole("button", { name: "Next", exact: true }).click()
      }
      expect(updates).toEqual([])
      await dialog.getByRole("button", { name: "Save Changes" }).click()
      await expect(dialog.getByRole("alert")).toHaveText("Permission revoked")
      expect(updates).toHaveLength(1)
      await dialog
        .getByRole("navigation", { name: "Service form progress" })
        .getByRole("button", { name: "Details" })
        .click()
      await expect(dialog.getByLabel("Service Name")).toHaveValue(
        "Updated Consulting",
      )
      await dialog.getByRole("button", { name: "Close dialog" }).click()
      await expect(
        page.getByRole("rowheader", { name: "Consulting", exact: true }),
      ).toBeVisible()
      if (offering === "Packages") {
        await page.unroute("**/api/services/service-2")
        await page
          .getByRole("button", { name: "Edit Consulting", exact: true })
          .click()
        await dialog
          .getByRole("navigation", { name: "Service form progress" })
          .getByRole("button", { name: "5 Packages", exact: true })
          .click()
        const premium = dialog.getByRole("article").filter({
          has: page.getByRole("heading", { name: "Package 2", exact: true }),
        })
        await premium
          .getByRole("button", { name: "Remove", exact: true })
          .click()
        await expect(dialog.getByLabel("Package Name")).toHaveCount(1)
        await expect(dialog.getByLabel("Package Name")).toHaveValue("Starter")
        await dialog
          .getByRole("button", { name: "Save Changes", exact: true })
          .click()
        await expect(dialog.getByRole("alert")).toHaveText(
          "Add at least two packages, or choose Pricing for a single option",
        )
        expect(updates).toHaveLength(1)
        await dialog
          .getByRole("button", { name: "Add Package", exact: true })
          .click()
        await dialog.getByLabel("Package Name").nth(1).fill("Replacement")
        await dialog
          .getByLabel("Description", { exact: true })
          .nth(1)
          .fill("Replacement consulting")
        await dialog
          .getByLabel("Included Features")
          .nth(1)
          .fill("Business analysis")
        const update = page.waitForRequest(
          (request) =>
            request.method() === "PUT" &&
            new URL(request.url()).pathname === "/api/services/service-2",
        )
        await dialog
          .getByRole("button", { name: "Save Changes", exact: true })
          .click()
        const body = (await update).postDataJSON() as {
          packages: { name: string }[]
        }
        expect(body.packages.map((item) => item.name)).toEqual([
          "Starter",
          "Replacement",
        ])
        await expect(dialog).toHaveCount(0)
        await page
          .getByRole("button", { name: "Edit Consulting", exact: true })
          .click()
        await dialog
          .getByRole("navigation", { name: "Service form progress" })
          .getByRole("button", { name: "5 Packages", exact: true })
          .click()
        await expect(dialog.getByLabel("Package Name")).toHaveCount(2)
        await expect(dialog.getByLabel("Package Name").nth(0)).toHaveValue(
          "Starter",
        )
        await expect(dialog.getByLabel("Package Name").nth(1)).toHaveValue(
          "Replacement",
        )
        await dialog
          .getByRole("button", { name: "Close dialog", exact: true })
          .click()
      }
    })
  }

  test("services cannot be created without a responsible department", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN", {
      initialDepartments: [],
      initialServices: [],
    })
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Create Service", exact: true })
      .click()
    await expect(
      page.getByText("Create a department before creating a service."),
    ).toBeVisible()
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled()
  })
})
