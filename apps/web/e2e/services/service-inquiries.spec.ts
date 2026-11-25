import { expect, test } from "@playwright/test"
import { Permissions } from "../../src/features/auth/model/permissions"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"

configureRegressionTest()
test("inbox filters, paginates, retains drafts and saves reviews", async ({
  page,
}, testInfo) => {
  const account = accountFor("ADMIN")
  await restoreSession(page, "ADMIN", {
    account: {
      permissions: [
        ...account.permissions,
        Permissions.SERVICE_INQUIRIES_READ,
        Permissions.SERVICE_INQUIRIES_MANAGE,
      ],
    },
  })
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: `inquiry-${i}`,
    fullName: `Guest ${i}`,
    email: `guest${i}@example.com`,
    contactNumber: "09123456789",
    subject: `Inquiry ${i}`,
    message: "A detailed requirement.\nSecond line.",
    status: "PENDING",
    internalNote: null as string | null,
    version: 0,
    reviewedAt: null,
    reviewedById: null,
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
    service: { id: "service", name: "Graphic Design" },
  }))
  await page.route("**/api/service-inquiries**", async (route) => {
    const request = route.request()
    if (request.method() === "PATCH") {
      const target = rows.find((item) => request.url().endsWith(item.id))!
      const body = request.postDataJSON() as {
        status: string
        internalNote: string
        version: number
      }
      expect(body.version).toBe(target.version)
      Object.assign(target, body, { version: target.version + 1 })
      return route.fulfill({ json: { inquiry: target } })
    }
    const url = new URL(request.url())
    const status = url.searchParams.get("status")
    const query = (url.searchParams.get("q") ?? "").toLowerCase()
    const filtered = rows.filter(
      (item) =>
        (status === "ALL" || item.status === status) &&
        [item.fullName, item.subject, item.email, item.service.name].some(
          (field) => field.toLowerCase().includes(query),
        ),
    )
    const current = Number(url.searchParams.get("page") ?? 1)
    return route.fulfill({
      json: {
        inquiries: filtered.slice((current - 1) * 10, current * 10),
        total: filtered.length,
        page: current,
        pageSize: 10,
        counts: {
          total: 12,
          PENDING: rows.filter((item) => item.status === "PENDING").length,
          CONTACTED: rows.filter((item) => item.status === "CONTACTED").length,
          CLOSED: 0,
          SPAM: 0,
        },
      },
    })
  })
  await page.goto("/service-inquiries")
  await expect(
    page.getByRole("heading", { name: "Guest Inquiries" }),
  ).toBeVisible()
  await expect(page.getByRole("tab", { name: /Pending 12/ })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(
    page.getByRole("tab", { name: /All inquiries 12/ }),
  ).toBeVisible()
  await page.getByRole("tab", { name: /Pending 12/ }).focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("tab", { name: /Contacted 0/ })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await page.getByRole("tab", { name: /Spam 0/ }).click()
  await expect(page.getByText("No matching inquiries")).toBeVisible()
  await page.getByRole("tab", { name: /Pending 12/ }).click()
  await expect(page.getByText("Showing 1–10 of 12 inquiries")).toBeVisible()
  await page.getByRole("button", { name: /Guest 0/ }).click()
  const selectedRow = page.getByRole("button", { name: /Guest 0/ })
  await expect(selectedRow).toHaveCSS("background-color", "rgb(32, 63, 140)")
  await expect(selectedRow).toHaveCSS("color", "rgb(255, 255, 255)")
  expect(
    await selectedRow.evaluate(
      (button) => getComputedStyle(button.parentElement!).borderBottomColor,
    ),
  ).not.toBe("rgb(32, 63, 140)")
  await expect(
    page.getByRole("link", { name: "Guest Inquiries" }).locator("svg"),
  ).toBeVisible()
  await page.getByRole("button", { name: "Collapse sidebar" }).click()
  await expect(
    page.getByRole("link", { name: "Guest Inquiries" }).locator("svg"),
  ).toBeVisible()
  await page.getByRole("button", { name: "Expand sidebar" }).click()
  await expect(page.getByText("A detailed requirement.")).toBeVisible()
  await page.getByLabel("Internal follow-up note").fill("Call tomorrow")
  await page.getByRole("button", { name: /Guest 1/ }).click()
  await page.getByRole("button", { name: /Guest 0/ }).click()
  await expect(page.getByLabel("Internal follow-up note")).toHaveValue(
    "Call tomorrow",
  )
  await page.getByLabel("Status", { exact: true }).click()
  await page.getByRole("option", { name: "Contacted" }).click()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Inquiry review saved.")).toBeVisible()
  await page.getByRole("button", { name: "Page 2" }).click()
  await expect(page.getByText("Showing 11–11 of 11 inquiries")).toBeVisible()
  await page.getByLabel("Search inquiries").fill("Guest 1")
  await expect(page.getByText("Showing 1–3 of 3 inquiries")).toBeVisible()
  await page.getByRole("tab", { name: /All inquiries/ }).click()
  await page.getByLabel("Search inquiries").fill("")
  await page.getByRole("button", { name: /Guest 0/ }).click()
  await expect(page.getByLabel("Internal follow-up note")).toHaveValue(
    "Call tomorrow",
  )
  await page.screenshot({
    path: testInfo.outputPath("inquiries-desktop.png"),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  const refresh = await page
    .getByRole("button", { name: "Refresh inquiries" })
    .boundingBox()
  const inbox = await page
    .getByRole("region", { name: "Inquiry inbox" })
    .boundingBox()
  expect(
    refresh && inbox && refresh.x + refresh.width <= inbox.x + inbox.width,
  ).toBe(true)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath("inquiries-mobile.png"),
    fullPage: true,
  })
})
