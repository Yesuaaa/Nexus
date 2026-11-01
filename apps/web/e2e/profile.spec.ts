import { expect, test } from "@playwright/test"
import type { Profile } from "../src/features/profile/api/profile-api"

for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"] as const) {
  test(`${role} can manage their profile on desktop and mobile`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    const profile: Profile = {
      user: {
        id: "profile-user",
        fullName: "Alex Rivera",
        email: "alex@example.com",
        contactNumber: "09123456789",
        role,
        isActive: true,
        permissions: [
          "dashboard:read",
          "profile:read",
          "profile:change-password",
        ],
        createdAt: "2026-01-01T00:00:00Z",
      },
      employee:
        role === "STAFF"
          ? {
              employeeId: "EXP-000001",
              position: "UI Designer",
              employmentType: "FULL_TIME",
              status: "ACTIVE",
              startDate: "2026-01-01T00:00:00Z",
              department: { id: "design", name: "Design" },
              team: null,
            }
          : null,
      specialist:
        role === "STAFF"
          ? {
              bio: "I design accessible digital products.",
              imageUrl: "",
              specialties: ["UI design"],
              updatedAt: "2026-11-01T00:00:00Z",
              socialLinks: [],
              projects: [],
            }
          : null,
    }
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "profile-test"),
    )
    await page.route("**/api/**", async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === "/api/auth/me")
        return route.fulfill({ json: { user: profile.user } })
      if (path === "/api/auth/profile/specialist") {
        profile.specialist = request.postDataJSON()
        return route.fulfill({ json: profile })
      }
      if (path === "/api/auth/profile") {
        if (request.method() === "PATCH") {
          const data = request.postDataJSON()
          profile.user.fullName = data.fullName
          profile.user.contactNumber = data.contactNumber
        }
        return route.fulfill({ json: profile })
      }
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
    })
    await page.goto("/profile", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: "My profile", exact: true }),
    ).toBeVisible({ timeout: 30000 })
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click()
    await page.getByLabel("Full name", { exact: true }).fill("Alex Updated")
    await expect(page.getByLabel("Email address")).toHaveAttribute(
      "readonly",
      "",
    )
    await page.getByRole("button", { name: "Save personal details" }).click()
    await expect(
      page.getByRole("heading", { name: "Alex Updated" }),
    ).toBeVisible()
    if (role === "STAFF") {
      await page
        .getByRole("button", { name: "Edit specialist profile", exact: true })
        .click()
      await page.getByRole("button", { name: "Add social link" }).click()
      await page.getByLabel("Platform", { exact: true }).fill("LinkedIn")
      await page
        .getByLabel("URL", { exact: true })
        .fill("https://linkedin.com/in/alex")
      await page.getByRole("button", { name: "Add featured project" }).click()
      await page
        .getByLabel("Project title", { exact: true })
        .fill("Brand website")
      await page
        .getByLabel("Summary", { exact: true })
        .fill("A responsive website for a local business.")
      await page.getByLabel("Published · visible to clients").check()
      await page
        .getByRole("button", { name: "Save specialist profile" })
        .click()
      expect(profile.specialist!.projects[0].isPublished).toBe(true)
      await page
        .getByRole("button", { name: "View project: Brand website" })
        .click()
      const projectDialog = page.getByRole("dialog", {
        name: "Brand website",
        exact: true,
      })
      await expect(projectDialog).toBeVisible()
      await expect(projectDialog).toContainText(
        "A responsive website for a local business.",
      )
      await page.keyboard.press("Escape")
      await expect(projectDialog).not.toBeVisible()
    } else {
      await expect(
        page.getByRole("heading", { name: "Specialist profile", exact: true }),
      ).toHaveCount(0)
    }
    await page.getByRole("button", { name: "Open account menu" }).click()
    await expect(
      page.getByRole("menuitem", { name: "Profile", exact: true }),
    ).toHaveAttribute("href", "/profile")
    await page.keyboard.press("Escape")
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: testInfo.outputPath("desktop.png"),
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.getByRole("heading", { name: "My profile", exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await expect
      .poll(() =>
        page
          .getByRole("main", { name: "My profile", exact: true })
          .evaluate((element) => element.scrollWidth - element.clientWidth),
      )
      .toBeLessThanOrEqual(0)
    await page.screenshot({
      path: testInfo.outputPath("mobile.png"),
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click()
    await page.getByRole("button", { name: "Show current password" }).click()
    await expect(
      page.getByLabel("Current password", { exact: true }),
    ).toHaveAttribute("type", "text")
    await page
      .getByLabel("Current password", { exact: true })
      .fill("Current-password-123!")
    await page
      .getByLabel("New password", { exact: true })
      .fill("New-password-123!")
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill("Different-password-123!")
    await page.getByRole("button", { name: "Update password" }).click()
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The new passwords do not match" }),
    ).toContainText("The new passwords do not match")
  })
}
