import { expect, test, type Page } from "@playwright/test"
import { serviceRequestStatuses } from "../../src/features/services/model/service-request-status"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

async function openHelp(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 })
  await restoreSession(page, "USER")
  await page.goto("/help")
  return page.getByRole("main")
}

test("[P21-WEB-001] USER can read Help and reach the booking support links", async ({
  page,
}) => {
  const main = await openHelp(page)

  await expect(
    main.getByRole("heading", { name: "Help & Support", level: 1 }),
  ).toBeVisible()
  await expect(
    main.getByRole("region", { name: "Bookings and requests" }),
  ).toBeVisible()
  await expect(
    main.getByRole("region", { name: "Quotations and consultations" }),
  ).toBeVisible()
  await expect(
    main.getByRole("searchbox", { name: "Search questions" }),
  ).toBeVisible()
  await expect(
    main.getByRole("complementary", { name: "Need help with a booking?" }),
  ).toBeVisible()
  await expect(
    main.getByRole("link", { name: "Open messages" }),
  ).toHaveAttribute("href", "/messages")
  await expect(
    main.getByRole("link", { name: "support@exp.test" }),
  ).toHaveAttribute("href", "mailto:support@exp.test")
  await expect(
    page.getByRole("link", { name: "Help & Support", exact: true }),
  ).toBeVisible()
})

test("[P21-WEB-002] Help search trims and folds case, announces no results, and restores questions when cleared", async ({
  page,
}) => {
  const main = await openHelp(page)
  const search = main.getByRole("searchbox", { name: "Search questions" })

  await expect(main.getByRole("button")).toHaveCount(6)
  await search.fill("  QUOTATION  ")
  await expect(
    main.getByRole("button", { name: "Where do I review my quotation?" }),
  ).toBeVisible()
  await expect(main.getByRole("button")).toHaveCount(1)

  await search.fill("nothing matches this query")
  const emptyState = main.getByRole("status")
  await expect(emptyState).toBeVisible()
  await expect(emptyState).toHaveAttribute("aria-live", "polite")

  await search.fill("")
  await expect(main.getByRole("button")).toHaveCount(6)
  await expect(main.getByRole("status")).toHaveCount(0)
})

test("[P21-WEB-003] FAQ disclosures expose state and support Enter and Space", async ({
  page,
}) => {
  const main = await openHelp(page)
  const firstQuestion = main.getByRole("button", {
    name: "How do I book a service?",
  })
  const secondQuestion = main.getByRole("button", {
    name: "What happens after I book a service?",
  })
  const firstPanelId = await firstQuestion.getAttribute("aria-controls")
  const secondPanelId = await secondQuestion.getAttribute("aria-controls")

  expect(firstPanelId).toBeTruthy()
  expect(secondPanelId).toBeTruthy()
  await expect(firstQuestion).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator(`#${firstPanelId}`)).toHaveAttribute(
    "aria-hidden",
    "false",
  )

  await firstQuestion.focus()
  await page.keyboard.press("Enter")
  await expect(firstQuestion).toHaveAttribute("aria-expanded", "false")

  await secondQuestion.focus()
  await page.keyboard.press("Space")
  await expect(secondQuestion).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator(`#${secondPanelId}`)).toHaveAttribute(
    "aria-hidden",
    "false",
  )
  await expect(
    main.getByRole("button", { name: /How do I book a service\?/ }),
  ).toHaveAttribute("aria-expanded", "false")
})

test("[P21-WEB-004] the booking support call to action opens Messages by keyboard", async ({
  page,
}) => {
  const main = await openHelp(page)
  const messagesLink = main.getByRole("link", { name: "Open messages" })

  await messagesLink.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/messages$/)
})

test("[P21-WEB-005] the support email destination is not a reserved test address", async ({
  page,
}) => {
  const main = await openHelp(page)
  const href = await main
    .getByRole("link", { name: "support@exp.test" })
    .getAttribute("href")

  expect(href).toMatch(/^mailto:[^\s@]+@[^\s@]+\.[a-z]{2,}$/i)
  expect(href).not.toMatch(/\.test$/i)
})

test("[P21-WEB-006] the request status answer explains every status shown in Booked Requests", async ({
  page,
}) => {
  const main = await openHelp(page)
  const question = main.getByRole("button", {
    name: "What does my request status mean?",
  })
  const panelId = await question.getAttribute("aria-controls")

  await question.click()
  const answer = page.locator(`#${panelId}`)
  const answerText = await answer.innerText()

  for (const { label } of Object.values(serviceRequestStatuses)) {
    expect(
      answerText,
      `status explanation should include “${label}”`,
    ).toContain(label)
  }
})

for (const accessCase of [
  { id: "P21-WEB-007", name: "STAFF", role: "STAFF" as const },
  {
    id: "P21-WEB-008",
    name: "department-head STAFF",
    role: "STAFF" as const,
    headOf: { id: "help-design", name: "Design" },
  },
  { id: "P21-WEB-009", name: "ADMIN", role: "ADMIN" as const },
  { id: "P21-WEB-010", name: "SUPERADMIN", role: "SUPERADMIN" as const },
]) {
  test(`[${accessCase.id}] ${accessCase.name} is routed away from USER Help`, async ({
    page,
  }) => {
    await restoreSession(
      page,
      accessCase.role,
      accessCase.headOf
        ? { account: { headOf: accessCase.headOf } }
        : undefined,
    )
    await page.goto("/help")

    await expect(page).toHaveURL(/\/module$/)
    await expect(
      page.getByRole("link", { name: "Help & Support", exact: true }),
    ).toHaveCount(0)
  })
}

test("[P21-WEB-011] unauthenticated Help access returns to the client login", async ({
  page,
}) => {
  await page.goto("/help")
  await expect(page).toHaveURL(/\/login$/)
})

test("[P21-WEB-012] Help stays readable without horizontal overflow at desktop, tablet, and mobile widths", async ({
  page,
}, testInfo) => {
  const main = await openHelp(page)

  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await expect(
      main.getByRole("heading", { name: "Help & Support", level: 1 }),
    ).toBeVisible()
    await expect(
      main.getByRole("searchbox", { name: "Search questions" }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `document should not overflow at ${width}px`,
    ).toBe(true)
  }

  await page.screenshot({
    path: testInfo.outputPath("page-21-help-mobile-390.png"),
    fullPage: true,
  })
})
