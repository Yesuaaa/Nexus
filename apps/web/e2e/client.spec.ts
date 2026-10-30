import { expect, test } from "@playwright/test"
import type { Service } from "../src/features/services/api/services-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test.describe("Client service requests", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  for (const width of [390, 1280, 1920]) {
    for (const packageCount of [0, 1, 2]) {
      test(`client package card sizing with ${packageCount} packages at ${width}px`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 })
        const timestamp = "2026-01-01T00:00:00.000Z"
        await restoreSession(page, "USER", {
          initialServices: [
            {
              id: "layout-service",
              name: "Layout Service",
              description: "Support for your next project.",
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
              departments: [],
              createdAt: timestamp,
              updatedAt: timestamp,
              packages: Array.from({ length: packageCount }, (_, index) => ({
                id: `package-${index}`,
                name: `Package ${index + 1}`,
                description: "Project support.",
                includedFeatures: ["Dedicated specialist"],
                pricingModel: "CUSTOM_QUOTE",
                currency: "PHP",
                amount: null,
                billingInterval: null,
                isPricingPublic: false,
                isActive: true,
                isRecommended: index === 0,
                displayOrder: index,
                createdAt: timestamp,
                updatedAt: timestamp,
              })),
            },
          ],
        })
        await page.goto("/services")
        await page
          .getByRole("button", { name: "Explore Layout Service" })
          .click()
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "EXPlore", exact: true })
          .click()
        const cards = page
          .getByRole("group", { name: "Packages & pricing" })
          .getByRole("article")
        await expect(cards).toHaveCount(Math.max(1, packageCount))
        const bounds = await cards.evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              width: rect.width,
              height: rect.height,
              overflow: element.scrollWidth > element.clientWidth,
            }
          }),
        )
        for (const card of bounds) {
          expect(card.width).toBeGreaterThanOrEqual(280)
          expect(card.width).toBeLessThanOrEqual(331)
          expect(card.height).toBeLessThan(500)
          expect(card.overflow).toBe(false)
        }
        await cards.first().scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath("card-layout.png") })
      })
    }
  }

  for (const width of [1280, 390]) {
    test(`client selects service packages and returns to the catalog at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      const timestamp = "2026-01-01T00:00:00.000Z"
      const basePackage = {
        description: "Social media support for your business.",
        includedFeatures: ["Content calendar", "Monthly reporting"],
        pricingModel: "RECURRING" as const,
        currency: "PHP",
        amount: "2500.00",
        billingInterval: "MONTHLY" as const,
        isPricingPublic: true,
        isActive: true,
        isRecommended: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await restoreSession(page, "USER", {
        initialServices: [
          {
            id: "social-service",
            name: "Social Media Management",
            description: "Grow your brand and connect with your audience.",
            iconKey: "social",
            imageUrl: null,
            imageAltText: null,
            clientRequirements: ["Brand guidelines", "Target audience"],
            requiresConsultation: true,
            consultationNotes:
              "We will discuss your goals and target audience.",
            keyBenefits: [],
            isActive: true,
            pricingTemplateId: null,
            pricingTemplate: null,
            departments: [],
            createdAt: timestamp,
            updatedAt: timestamp,
            packages: [
              {
                ...basePackage,
                id: "weekly",
                name: "Weekly Spark",
                displayOrder: 0,
                billingInterval: "WEEKLY",
                amount: "750.00",
                includedFeatures: [
                  "Dedicated specialist",
                  "2 rounds of revisions",
                  "48-hour response time",
                  "Source files included",
                ],
              },
              {
                ...basePackage,
                id: "starter",
                name: "Starter",
                displayOrder: 1,
                isRecommended: true,
              },
              {
                ...basePackage,
                id: "custom",
                name: "Custom plan",
                displayOrder: 2,
                isPricingPublic: false,
                amount: "99999.00",
              },
              {
                ...basePackage,
                id: "growth",
                name: "Growth plan",
                displayOrder: 3,
              },
              {
                ...basePackage,
                id: "annual",
                name: "Annual plan",
                displayOrder: 4,
                billingInterval: "YEARLY",
              },
              {
                ...basePackage,
                id: "retired",
                name: "Retired package",
                displayOrder: 0,
                isActive: false,
              },
            ],
          },
        ],
      })
      await page.goto("/services")
      await page
        .getByRole("button", { name: "Explore Social Media Management" })
        .click()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "EXPlore", exact: true })
        .click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(
        page.getByRole("heading", {
          name: "Social Media Management",
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "2",
      )
      await expect(
        page.getByText("Most popular", { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByText("Retired package", { exact: true }),
      ).toHaveCount(0)
      await expect(page.getByText(/99,999/)).toHaveCount(0)
      await expect(
        page.getByRole("button", { name: "Continue to project requirements" }),
      ).toBeDisabled()
      const packageCards = page
        .getByRole("group", { name: "Packages & pricing" })
        .getByRole("article")
      await expect(packageCards).toHaveCount(5)
      const cardLayout = await packageCards.evaluateAll((cards) =>
        cards.map((card) => {
          const bounds = card.getBoundingClientRect()
          return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            width: bounds.width,
            buttonTop: card.querySelector("button")!.getBoundingClientRect()
              .top,
          }
        }),
      )
      const firstRow = cardLayout.filter(
        (card) => Math.abs(card.top - cardLayout[0].top) < 1,
      )
      const lastRow = cardLayout.filter(
        (card) => Math.abs(card.top - cardLayout.at(-1)!.top) < 1,
      )
      expect(
        Math.abs(
          firstRow[0].left +
            firstRow.at(-1)!.right -
            (lastRow[0].left + lastRow.at(-1)!.right),
        ),
      ).toBeLessThan(2)
      for (const card of cardLayout) {
        expect(Math.abs(card.width - cardLayout[0].width)).toBeLessThan(1)
      }
      for (const card of firstRow) {
        expect(Math.abs(card.buttonTop - firstRow[0].buttonTop)).toBeLessThan(1)
      }
      await page
        .getByRole("button", { name: "Select Starter", exact: true })
        .click()
      await expect(page.getByRole("status")).toContainText("Starter")
      await expect(page.getByRole("status")).toContainText("₱2,500")
      await expect(page.getByRole("status")).toContainText("/ month")
      await page.getByRole("group", { name: "Packages & pricing" }).screenshot({
        path: testInfo.outputPath("packages.png"),
      })
      await page
        .getByRole("button", { name: "View service details", exact: true })
        .click()
      await page.getByRole("button", { name: "Close service details" }).click()
      await expect(
        page.getByRole("button", { name: "Select Starter", exact: true }),
      ).toHaveAttribute("aria-pressed", "true")
      await page
        .getByRole("button", { name: "Select Custom plan", exact: true })
        .click()
      await expect(page.getByRole("status")).toContainText(
        "Contact for pricing",
      )
      await expect(
        page.getByText("Consultation required", { exact: true }),
      ).toBeVisible()
      await page
        .getByRole("button", { name: "Continue to project requirements" })
        .click()
      await expect(
        page.getByRole("heading", {
          name: "Project Requirements",
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "3",
      )
      await expect(
        page.getByRole("complementary", { name: "Project context" }),
      ).toContainText("Custom plan")
      await expect(
        page.getByText("Brand guidelines", { exact: true }),
      ).toBeVisible()
      await page
        .getByRole("textbox", { name: "Project goals", exact: true })
        .scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath("requirements.png") })
      await page
        .getByRole("button", { name: "Save requirements", exact: true })
        .click()
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(3)
      await page
        .getByRole("button", { name: "Continue to preferred specialist" })
        .click()
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "3",
      )
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(3)
      await expect(
        page.getByRole("textbox", { name: "Project goals", exact: true }),
      ).toBeFocused()
      await page
        .getByRole("textbox", { name: "Project goals", exact: true })
        .fill("Increase awareness and generate qualified leads.")
      await page
        .getByRole("textbox", { name: "Project requirements", exact: true })
        .fill("Create a content calendar and 12 posts each month.")
      await page
        .getByRole("textbox", { name: "Expected timeline", exact: true })
        .fill("Launch within six weeks, with a flexible start date.")
      await page
        .getByRole("textbox", { name: /^Additional details/ })
        .fill(
          "Our audience is small business owners. Follow our existing brand colors.",
        )
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0)
      await page
        .getByRole("button", { name: "Save requirements", exact: true })
        .click()
      await expect(page.getByRole("status")).toContainText(
        "Project requirements saved in this draft.",
      )
      await page.getByRole("button", { name: "Back to packages" }).click()
      await expect(
        page.getByRole("button", { name: "Select Custom plan", exact: true }),
      ).toHaveAttribute("aria-pressed", "true")
      await page
        .getByRole("button", { name: "Select Starter", exact: true })
        .click()
      await page
        .getByRole("button", { name: "Continue to project requirements" })
        .click()
      await expect(
        page.getByRole("textbox", { name: "Project goals", exact: true }),
      ).toHaveValue("Increase awareness and generate qualified leads.")
      await expect(
        page.getByRole("textbox", {
          name: "Project requirements",
          exact: true,
        }),
      ).toHaveValue("Create a content calendar and 12 posts each month.")
      await expect(
        page.getByRole("textbox", { name: "Expected timeline", exact: true }),
      ).toHaveValue("Launch within six weeks, with a flexible start date.")
      await expect(
        page.getByRole("textbox", { name: /^Additional details/ }),
      ).toHaveValue(
        "Our audience is small business owners. Follow our existing brand colors.",
      )
      await expect(
        page.getByRole("complementary", { name: "Project context" }),
      ).toContainText("Starter")
      await page
        .getByRole("textbox", { name: "Project goals", exact: true })
        .fill("Grow our online community.")
      await expect(page.getByRole("status")).toHaveCount(0)
      let specialistResponse: "error" | "populated" | "empty" = "error"
      await page.route(
        "**/api/client/services/social-service/specialists",
        async (route) => {
          if (specialistResponse === "error") {
            await route.fulfill({ status: 503, json: { error: "Unavailable" } })
          } else {
            await route.fulfill({
              json: {
                specialists:
                  specialistResponse === "empty"
                    ? []
                    : [
                        {
                          id: "specialist-1",
                          fullName: "Alex Santos",
                          position: "Social Media Specialist",
                          department: { id: "marketing", name: "Marketing" },
                        },
                        {
                          id: "specialist-2",
                          fullName: "Jamie Reyes",
                          position: "Content Strategist",
                          department: { id: "marketing", name: "Marketing" },
                        },
                      ],
              },
            })
          }
        },
      )
      await page
        .getByRole("button", { name: "Continue to preferred specialist" })
        .click()
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "4",
      )
      await expect(
        page.getByRole("heading", {
          name: "Who would you like to work with?",
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "couldn’t load",
      )
      specialistResponse = "populated"
      await page.getByRole("button", { name: "Retry specialists" }).click()
      await page
        .getByRole("radio", { name: "Prefer Alex Santos", exact: true })
        .check()
      await expect(
        page.getByRole("complementary", {
          name: "Specialist selection summary",
        }),
      ).toContainText("Alex Santos")
      await expect(
        page.getByText(
          "Subject to availability and Department Manager approval",
          { exact: true },
        ),
      ).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath("specialist.png") })
      await page
        .getByRole("button", { name: "Back to project requirements" })
        .click()
      await expect(
        page.getByRole("textbox", { name: "Project goals", exact: true }),
      ).toHaveValue("Grow our online community.")
      await page
        .getByRole("button", { name: "Continue to preferred specialist" })
        .click()
      await expect(
        page.getByRole("radio", { name: "Prefer Alex Santos", exact: true }),
      ).toBeChecked()
      await page
        .getByRole("radio", { name: "Prefer Jamie Reyes", exact: true })
        .check()
      await expect(page.getByRole("status")).toHaveCount(0)
      specialistResponse = "empty"
      await page
        .getByRole("button", { name: "Back to project requirements" })
        .click()
      await page
        .getByRole("button", { name: "Continue to preferred specialist" })
        .click()
      await expect(
        page.getByText(/No specialists are currently listed/),
      ).toBeVisible()
      await expect(
        page.getByRole("button", {
          name: "Submit service request for review",
          exact: true,
        }),
      ).toBeDisabled()
      await page
        .getByRole("radio", { name: /Let the department assign a specialist/ })
        .check()
      await page
        .getByRole("button", { name: "Back to project requirements" })
        .click()
      await page.getByRole("button", { name: "Back to packages" }).click()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await page
        .getByRole("button", { name: "Continue to project requirements" })
        .click()
      specialistResponse = "populated"
      await page
        .getByRole("button", { name: "Continue to preferred specialist" })
        .click()
      await expect(
        page.getByRole("radio", { name: "Prefer Alex Santos", exact: true }),
      ).toBeVisible()
      if (width === 1280)
        await page
          .getByRole("radio", { name: "Prefer Alex Santos", exact: true })
          .check()
      const submissions: Record<string, unknown>[] = []
      let releaseSubmission: (() => void) | undefined
      await page.route("**/api/client/service-requests", async (route) => {
        submissions.push(
          route.request().postDataJSON() as Record<string, unknown>,
        )
        if (submissions.length === 1) {
          await route.fulfill({
            status: 503,
            json: {
              error: "Submission temporarily unavailable. Please try again.",
            },
          })
        } else {
          await new Promise<void>((resolve) => {
            releaseSubmission = resolve
          })
          await route.fulfill({
            status: 201,
            json: {
              serviceRequest: {
                id: "request-123",
                status: "SUBMITTED",
                createdAt: timestamp,
              },
            },
          })
        }
      })
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuemax",
        "4",
      )
      await expect(page.getByText("Step 4 of 4", { exact: true })).toBeVisible()
      await page
        .getByRole("button", {
          name: "Submit service request for review",
          exact: true,
        })
        .click()
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Submission temporarily unavailable",
      )
      await page
        .getByRole("button", {
          name: "Submit service request for review",
          exact: true,
        })
        .click()
      await expect.poll(() => submissions.length).toBe(2)
      await expect(
        page.getByRole("button", { name: "Submitting request…", exact: true }),
      ).toBeDisabled()
      await expect(
        page.getByRole("button", { name: "Back to project requirements" }),
      ).toBeDisabled()
      await expect(
        page.getByRole("radio", { name: "Prefer Alex Santos", exact: true }),
      ).toBeDisabled()
      expect(submissions[0].submissionKey).toBe(submissions[1].submissionKey)
      expect(submissions[1]).toMatchObject({
        serviceId: "social-service",
        packageId: "starter",
        preferredSpecialistId: width === 1280 ? "specialist-1" : null,
        goals: "Grow our online community.",
        requirements: "Create a content calendar and 12 posts each month.",
        expectedTimeline:
          "Launch within six weeks, with a flexible start date.",
        additionalDetails:
          "Our audience is small business owners. Follow our existing brand colors.",
      })
      expect(submissions[1]).not.toHaveProperty("clientId")
      releaseSubmission!()
      await expect(
        page.getByRole("heading", {
          name: "Service request submitted for review",
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByText("request-123", { exact: true })).toBeVisible()
      await expect(
        page.getByText("Pending review", { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByText("Request not submitted", { exact: true }),
      ).toBeHidden()
      await expect(
        page.getByRole("button", {
          name: "Submit service request for review",
          exact: true,
        }),
      ).toHaveCount(0)
      await page.screenshot({
        path: testInfo.outputPath("request-submitted.png"),
      })
      await page
        .getByRole("button", { name: "Start another request", exact: true })
        .click()
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "1",
      )
      await expect(
        page.getByRole("button", { name: "Explore Social Media Management" }),
      ).toBeVisible()
    })
  }

  test("client catalog retries failures and resets pagination when filtering", async ({
    page,
  }) => {
    const timestamp = "2026-10-30T00:00:00.000Z"
    const services: Service[] = Array.from({ length: 10 }, (_, index) => ({
      id: `catalog-${index}`,
      name: `Catalog Service ${index + 1}`,
      description: "Business support",
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
      departments: [
        {
          id: index < 8 ? "engineering" : "marketing",
          name: index < 8 ? "Engineering" : "Marketing",
          code: null,
          color: "teal",
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    await restoreSession(page, "USER", { initialServices: services })
    await page.route(
      "**/api/client/services",
      (route) =>
        route.fulfill({
          status: 503,
          json: { error: "Catalog temporarily unavailable" },
        }),
      { times: 1 },
    )
    await page.goto("/services")
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Catalog temporarily unavailable",
    )
    await page.getByRole("button", { name: "Try again", exact: true }).click()
    await expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(8)
    await page.getByRole("button", { name: "Next page", exact: true }).click()
    await expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(2)
    await page
      .getByRole("combobox", { name: "Filter services by department" })
      .click()
    await page.getByRole("option", { name: "Engineering", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Page 1", exact: true }),
    ).toHaveAttribute("aria-current", "page")
    await expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(8)
    await page
      .getByRole("searchbox", { name: "Search services" })
      .fill("' OR 1=1 --")
    await expect(
      page.getByText("No services found", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(0)
    await page
      .getByRole("searchbox", { name: "Search services" })
      .fill("Catalog Service 3")
    await expect(
      page.getByRole("button", { name: /^Explore Catalog Service/ }),
    ).toHaveCount(1)
    await expect(
      page.getByRole("button", {
        name: "Explore Catalog Service 3",
        exact: true,
      }),
    ).toBeVisible()
  })
})
