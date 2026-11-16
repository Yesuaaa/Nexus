import { expect, test } from "@playwright/test"
import type { Department } from "../../src/features/departments/api/departments-api"
import type { Service } from "../../src/features/services/api/services-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const timestamp = "2026-01-01T00:00:00.000Z"

function departmentFixture(id: string, name: string, code: string): Department {
  return {
    id,
    name,
    color: "teal",
    code,
    description: `${name} department`,
    headId: null,
    head: null,
    memberCount: 0,
    teamCount: 0,
    serviceCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function serviceFixture(number: number, departments: Department[]): Service {
  const department = number % 2 === 0 ? departments[1]! : departments[0]!
  const date = new Date(Date.UTC(2026, 0, number)).toISOString()
  return {
    id: `service-${String(number).padStart(2, "0")}`,
    name: `Service ${String(number).padStart(2, "0")}`,
    description: `Description for service ${number}`,
    iconKey: "sparkles",
    imageUrl: null,
    imageAltText: null,
    clientRequirements: [],
    requiresConsultation: false,
    requiresAgreement: true,
    requiresPayment: true,
    requiresQuotationApproval: false,
    consultationNotes: null,
    keyBenefits: [],
    isActive: number % 3 !== 0,
    pricingTemplateId: null,
    pricingTemplate: null,
    packages: [],
    departments: [
      {
        id: department.id,
        name: department.name,
        code: department.code,
        color: department.color,
      },
    ],
    createdAt: date,
    updatedAt: date,
  }
}

test("service directory combines department and status filters, then sorts", async ({
  page,
}) => {
  const departments = [
    departmentFixture("dept-engineering", "Engineering", "ENG"),
    departmentFixture("dept-design", "Design", "DSN"),
  ]
  const services = Array.from({ length: 12 }, (_, index) =>
    serviceFixture(index + 1, departments),
  )

  await restoreSession(page, "ADMIN", {
    initialDepartments: departments,
    initialServices: services,
  })
  await page.goto("/services")

  const rows = page.getByRole("rowheader")
  const summary = page.getByRole("status").filter({
    hasText: "services",
  })
  await expect(rows).toHaveCount(10)
  await expect(summary).toHaveText("Showing 1–10 of 12 services")

  const pagination = page.getByRole("navigation", { name: "Service pages" })
  await pagination.getByRole("button", { name: "Next page" }).click()
  await expect(rows).toHaveCount(2)
  await expect(summary).toHaveText("Showing 11–12 of 12 services")

  const search = page.getByRole("searchbox", { name: "Search services" })
  await search.fill("Service 02")
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText("Service 02")
  await expect(summary).toHaveText("Showing 1–1 of 1 services")
  await search.fill("")

  await page.getByRole("button", { name: /^Filter by department:/ }).click()
  await page.getByRole("menuitemradio", { name: "Design" }).click()
  await page.getByRole("button", { name: /^Filter by status:/ }).click()
  await page.getByRole("menuitemradio", { name: "Inactive" }).click()

  await expect(rows).toHaveCount(2)
  await expect(summary).toHaveText("Showing 1–2 of 2 services")
  await expect(rows.nth(0)).toContainText("Service 12")
  await expect(rows.nth(1)).toContainText("Service 06")
  await expect(
    page.getByRole("row").filter({ hasText: "Service 12" }),
  ).toContainText("Design")
  await expect(
    page.getByRole("row").filter({ hasText: "Service 12" }),
  ).toContainText("Inactive")

  await page.getByRole("button", { name: "Sort by Service Name" }).click()
  await expect(rows.nth(0)).toContainText("Service 06")
  await expect(rows.nth(1)).toContainText("Service 12")
})

test("service directory resets to page one when search is cleared", async ({
  page,
}) => {
  const departments = [
    departmentFixture("dept-engineering", "Engineering", "ENG"),
    departmentFixture("dept-design", "Design", "DSN"),
  ]
  const services = Array.from({ length: 12 }, (_, index) =>
    serviceFixture(index + 1, departments),
  )
  await restoreSession(page, "ADMIN", {
    initialDepartments: departments,
    initialServices: services,
  })
  await page.goto("/services")

  const rows = page.getByRole("rowheader")
  const summary = page.getByRole("status").filter({
    hasText: "services",
  })
  await expect(rows).toHaveCount(10)
  await expect(summary).toHaveText("Showing 1–10 of 12 services")

  await page
    .getByRole("navigation", { name: "Service pages" })
    .getByRole("button", { name: "Next page" })
    .click()
  await expect(rows).toHaveCount(2)
  await expect(summary).toHaveText("Showing 11–12 of 12 services")

  const search = page.getByRole("searchbox", { name: "Search services" })
  await search.fill("Service 02")
  await expect(rows).toHaveCount(1)
  await expect(summary).toHaveText("Showing 1–1 of 1 services")
  await search.fill("")
  await expect(rows).toHaveCount(10)
  await expect(summary).toHaveText("Showing 1–10 of 12 services")
})
