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
    const imageBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lY4AAAAASUVORK5CYII=",
      "base64",
    )
    await page.route("https://profile-test.supabase.co/**", (route) =>
      route.fulfill({ contentType: "image/png", body: imageBuffer }),
    )
    const imageWrites: string[] = []
    let failBannerOnce = role === "USER"
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
      if (path === "/api/auth/profile/images") {
        const { kind, dataUrl } = request.postDataJSON()
        imageWrites.push(kind)
        if (kind === "banner" && failBannerOnce) {
          failBannerOnce = false
          return route.fulfill({
            status: 500,
            json: { error: "Temporary upload failure." },
          })
        }
        expect(dataUrl).toMatch(/^data:image\/png;base64,/)
        const url = `https://profile-test.supabase.co/${kind}.png`
        if (kind === "avatar") {
          profile.imageUrl = url
          if (profile.specialist) profile.specialist.imageUrl = url
        }
        if (kind === "banner") profile.bannerUrl = url
        return route.fulfill({
          status: 201,
          json: { url, profile: kind === "project" ? null : profile },
        })
      }
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
    await page
      .getByRole("button", { name: "Change profile picture", exact: true })
      .click()
    await page
      .getByLabel("Choose profile picture", { exact: true })
      .setInputFiles({
        name: "discarded.png",
        mimeType: "image/png",
        buffer: imageBuffer,
      })
    await expect(
      page.getByRole("img", { name: "Profile picture preview", exact: true }),
    ).toBeVisible()
    expect(imageWrites).toEqual([])
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(imageWrites).toEqual([])
    await page
      .getByRole("button", { name: "Change profile picture", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeDisabled()
    await page
      .getByLabel("Choose profile picture", { exact: true })
      .setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: imageBuffer,
      })
    await page
      .getByLabel("Choose cover banner", { exact: true })
      .setInputFiles({
        name: "banner.png",
        mimeType: "image/png",
        buffer: imageBuffer,
      })
    await expect(
      page.getByRole("img", { name: "Profile picture preview", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("img", { name: "Cover banner preview", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole("button", { name: "Remove selected image", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText("Not uploaded yet", { exact: false }),
    ).toHaveCount(0)
    expect(imageWrites).toEqual([])
    await page.setViewportSize({ width: 1280, height: 1000 })
    await expect
      .poll(async () => {
        const box = await page.getByRole("dialog").boundingBox()
        return !!box && box.x >= 16 && box.x + box.width <= 1264
      })
      .toBe(true)
    await page.screenshot({
      path: testInfo.outputPath("image-editor-desktop.png"),
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect
      .poll(async () => {
        const box = await page.getByRole("dialog").boundingBox()
        return !!box && box.x >= 12 && box.width <= 366
      })
      .toBe(true)
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .scrollIntoViewIfNeeded()
    await page.screenshot({
      path: testInfo.outputPath("image-editor-mobile.png"),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1280, height: 720 })
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click()
    if (role === "USER") {
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Cover banner was not saved." }),
      ).toContainText("Profile picture saved.")
      expect(imageWrites).toEqual(["avatar", "banner"])
      await expect(page.getByRole("dialog")).toBeVisible()
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click()
      await expect
        .poll(() => imageWrites)
        .toEqual(["avatar", "banner", "banner"])
    } else await expect.poll(() => imageWrites).toEqual(["avatar", "banner"])
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(profile.imageUrl).toBe("https://profile-test.supabase.co/avatar.png")
    expect(profile.bannerUrl).toBe(
      "https://profile-test.supabase.co/banner.png",
    )
    await expect(
      page.getByRole("img", { name: "Profile banner", exact: true }),
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
        .getByLabel("Choose project 1 image", { exact: true })
        .setInputFiles({
          name: "project.png",
          mimeType: "image/png",
          buffer: imageBuffer,
        })
      await expect(
        page.getByRole("img", { name: "Project 1 image preview", exact: true }),
      ).toBeVisible()
      await page
        .getByRole("button", { name: "Upload image", exact: true })
        .click()
      await expect(
        page.getByLabel("Project image URL", { exact: true }),
      ).toHaveValue("https://profile-test.supabase.co/project.png")
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
    await expect(page).toHaveURL(/\/settings/)
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
