import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import { Permissions } from "../src/features/auth/model/permissions"
import {
  accountFor,
  configureRegressionTest,
  live,
  restoreSession,
  type MockApiOptions,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Attendance entry uses isolated regression account fixtures")

const attendanceState = {
  asOf: "2026-11-23T00:00:00.000Z",
  employeeId: "entry-test-employee",
  needsPolicy: true,
  workday: null,
}

const attendanceHistory = {
  asOf: "2026-11-23T00:00:00.000Z",
  employeeId: "entry-test-employee",
  total: 0,
  page: 1,
  pageSize: 20,
  workdays: [],
}

async function stubPersonalAttendanceReads(page: Page) {
  await page.route("**/api/attendance/me/current", (route) =>
    route.fulfill({ json: attendanceState }),
  )
  await page.route("**/api/attendance/me/history**", (route) =>
    route.fulfill({ json: attendanceHistory }),
  )
}

function trackAttendanceWrites(page: Page) {
  const writes: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (
      url.pathname.startsWith("/api/attendance/") &&
      !["GET", "HEAD"].includes(request.method())
    ) {
      writes.push(`${request.method()} ${url.pathname}`)
    }
  })
  return writes
}

test("[PG-003-F001-A001-T003] active STAFF enters personal check-ins", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPersonalAttendanceReads(page)
  const writes = trackAttendanceWrites(page)

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  expect(writes).toEqual([])
})

test("[PG-003-F001-A001-T004] active ADMIN without employees:read enters personal check-ins", async ({
  page,
}) => {
  const permissions = accountFor("ADMIN").permissions.filter(
    (permission) => permission !== Permissions.EMPLOYEES_READ,
  )
  await restoreSession(page, "ADMIN", { account: { permissions } })
  await stubPersonalAttendanceReads(page)
  const writes = trackAttendanceWrites(page)

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  expect(writes).toEqual([])
})

test("[PG-003-F001-A003-T006] signed-in ineligible profiles are redirected before attendance entry", async ({
  page,
  context,
}) => {
  const superadminPermissions = accountFor("SUPERADMIN").permissions.filter(
    (permission) => permission !== Permissions.EMPLOYEES_READ,
  )
  const profiles: {
    label: string
    role: Account["role"]
    options?: MockApiOptions
    destination: "/dashboard" | "/module"
  }[] = [
    {
      label: "active USER",
      role: "USER",
      destination: "/dashboard",
    },
    {
      label: "inactive STAFF",
      role: "STAFF",
      options: { account: { isActive: false } },
      destination: "/module",
    },
    {
      label: "SUPERADMIN without employees:read",
      role: "SUPERADMIN",
      options: { account: { permissions: superadminPermissions } },
      destination: "/module",
    },
  ]

  for (const [index, profile] of profiles.entries()) {
    const scenarioPage = index === 0 ? page : await context.newPage()
    await restoreSession(scenarioPage, profile.role, profile.options)
    await scenarioPage.goto("/attendance")

    await expect(
      scenarioPage,
      `${profile.label} must follow the portal route policy`,
    ).toHaveURL(new RegExp(`${profile.destination}$`))
    await expect(scenarioPage).not.toHaveURL(/\/attendance(?:\/|$)/)
  }
})

test("[PG-003-F001-A003-T007] an unauthenticated visitor is sent to login", async ({
  page,
}) => {
  const attendanceRequests: string[] = []
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.startsWith("/api/attendance/"))
      attendanceRequests.push(pathname)
  })

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/login$/)
  expect(attendanceRequests).toEqual([])
})

test("[PG-003-F001-A004-T008] the pending entry status is announced before redirect", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPersonalAttendanceReads(page)

  let observedStatus: { role: string | null; text: string } | null = null
  await page.exposeFunction(
    "__capturePg003EntryStatus",
    (role: string | null, text: string) => {
      observedStatus = { role, text }
    },
  )
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const status = document.querySelector('[role="status"]')
      if (!status?.textContent?.includes("Opening attendance…")) return

      const browserWindow = window as Window & {
        __capturePg003EntryStatus?: (
          role: string | null,
          text: string,
        ) => Promise<void>
      }
      void browserWindow.__capturePg003EntryStatus?.(
        status.getAttribute("role"),
        status.textContent.trim(),
      )
      observer.disconnect()
    })

    observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })

  await page.goto("/attendance")

  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  await expect
    .poll(() => observedStatus)
    .toEqual({
      role: "status",
      text: "Opening attendance…",
    })
})

test("[PG-003-F001-A001-T009] replace redirect leaves no attendance entry in browser history", async ({
  page,
}) => {
  await restoreSession(page, "STAFF")
  await stubPersonalAttendanceReads(page)
  await page.goto("/module")
  await expect(
    page.getByRole("main", { name: "Workspace selector", exact: true }),
  ).toBeVisible()

  await page.goto("/attendance")
  await expect(page).toHaveURL(/\/attendance\/check-ins$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/module$/)
})
