import { expect, test } from "@playwright/test"
import type { Profile } from "../../src/features/profile/api/profile-api"

function profileForStaff(): Profile {
  return {
    user: {
      id: "page-17-staff",
      fullName: "Morgan Lee",
      email: "morgan@example.com",
      contactNumber: "09123456789",
      role: "STAFF",
      isActive: true,
      permissions: [
        "dashboard:read",
        "profile:read",
        "profile:change-password",
      ],
      createdAt: "2026-01-01T00:00:00Z",
    },
    employee: null,
    specialist: null,
  }
}

test("profile retries failed reads and keeps personal edits available after a failed save", async ({
  page,
}) => {
  const profile = profileForStaff()
  let profileReads = 0
  let profileWrites = 0
  const savedBodies: { fullName: string; contactNumber: string }[] = []

  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "page-17-profile-test"),
  )
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === "/api/auth/settings")
      return route.fulfill({
        json: {
          preferences: {
            timeZone: "Asia/Manila",
            dateFormat: "MM/DD/YYYY",
            timeFormat: "12h",
            workflowNotifications: true,
          },
          sessions: [],
        },
      })
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: profile.user } })
    if (path === "/api/auth/profile" && request.method() === "GET") {
      profileReads += 1
      if (profileReads === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Profile temporarily unavailable." },
        })
      return route.fulfill({ json: profile })
    }
    if (path === "/api/auth/profile" && request.method() === "PATCH") {
      profileWrites += 1
      const body = request.postDataJSON() as {
        fullName: string
        contactNumber: string
      }
      savedBodies.push(body)
      if (!body.fullName.trim())
        return route.fulfill({
          status: 400,
          json: { error: "Provide a valid full name" },
        })
      if (profileWrites === 2)
        return route.fulfill({
          status: 500,
          json: { error: "Profile update failed. Try again." },
        })
      profile.user.fullName = body.fullName
      profile.user.contactNumber = body.contactNumber
      return route.fulfill({ json: profile })
    }
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto("/profile", { waitUntil: "domcontentloaded" })
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Profile temporarily unavailable." }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "My profile", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "Morgan Lee" })).toBeVisible()
  expect(profileReads).toBe(2)

  await page.getByRole("button", { name: "Edit profile", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Edit personal details" })
  const fullName = dialog.getByLabel("Full name", { exact: true })
  await fullName.fill("Morgan Lee Updated")
  await expect(dialog.getByLabel("Email address")).toHaveAttribute(
    "readonly",
    "",
  )
  await expect(dialog.getByLabel("Account role")).toHaveAttribute(
    "readonly",
    "",
  )

  await fullName.fill("   ")
  await dialog.getByRole("button", { name: "Save personal details" }).click()
  await expect(dialog.getByRole("alert")).toContainText(
    "Provide a valid full name",
  )
  await expect(fullName).toHaveValue("   ")
  expect(profileWrites).toBe(1)
  expect(profile.user.fullName).toBe("Morgan Lee")

  await fullName.fill("Morgan Lee Updated")
  await dialog.getByRole("button", { name: "Save personal details" }).click()
  await expect(dialog.getByRole("alert")).toContainText(
    "Profile update failed. Try again.",
  )
  await expect(fullName).toHaveValue("Morgan Lee Updated")
  await expect(dialog).toBeVisible()
  expect(profile.user.fullName).toBe("Morgan Lee")
  expect(profileWrites).toBe(2)

  await dialog.getByRole("button", { name: "Save personal details" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Morgan Lee Updated" }),
  ).toBeVisible()
  expect(profileWrites).toBe(3)
  expect(savedBodies).toEqual([
    { fullName: "   ", contactNumber: "09123456789" },
    { fullName: "Morgan Lee Updated", contactNumber: "09123456789" },
    { fullName: "Morgan Lee Updated", contactNumber: "09123456789" },
  ])

  await page.getByRole("button", { name: "Open account menu" }).click()
  await expect(
    page.getByRole("menu").getByText("Morgan Lee Updated", { exact: true }),
  ).toBeVisible()
})

test("unlinked STAFF accounts see read-only employment data and no specialist editor", async ({
  page,
}) => {
  const profile = profileForStaff()
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "page-17-unlinked-staff"),
  )
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/settings")
      return route.fulfill({
        json: {
          preferences: {
            timeZone: "Asia/Manila",
            dateFormat: "MM/DD/YYYY",
            timeFormat: "12h",
            workflowNotifications: true,
          },
          sessions: [],
        },
      })
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: profile.user } })
    if (path === "/api/auth/profile") return route.fulfill({ json: profile })
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.goto("/profile", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("main", { name: "My profile", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Morgan Lee", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Featured projects", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Ask an administrator to link your employee record", {
      exact: false,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Edit specialist profile", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText("Employment details", { exact: true }),
  ).toHaveCount(0)

  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(
      page.getByRole("main", { name: "My profile", exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  }
})
