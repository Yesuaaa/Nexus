import { expect, test } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  accountFor,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

test.describe("Superadmin account management", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  for (const width of [390, 1280]) {
    test(`superadmin changes a listed account password at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "SUPERADMIN")
      let attempts = 0
      let releaseSubmission: () => void = () => {}
      const submission = new Promise<void>((resolve) => {
        releaseSubmission = resolve
      })
      await page.route("**/api/users/user-target/password", async (route) => {
        const request = route.request()
        expect(request.method()).toBe("POST")
        expect(request.headers().authorization).toBe("Bearer test-session")
        expect(request.postDataJSON()).toEqual({
          newPassword: " MyNewPassword123! ",
        })
        attempts += 1
        if (attempts === 1) {
          await route.fulfill({
            status: 503,
            json: { error: "Unable to change password. Please retry." },
          })
        } else {
          await submission
          await route.fulfill({ status: 204 })
        }
      })
      await page.goto("/accounts")
      await expect(
        page.getByRole("button", { name: "Change my password", exact: true }),
      ).toHaveCount(0)
      const openDialog = async () => {
        await page
          .getByRole("button", { name: "More actions for target@example.com" })
          .click()
        await page
          .getByRole("menuitem", { name: "Change password", exact: true })
          .click()
      }
      await openDialog()
      const dialog = page.getByRole("dialog", {
        name: "Change account password",
      })
      const next = dialog.getByLabel("New password", { exact: true })
      const confirmation = dialog.getByLabel("Confirm new password", {
        exact: true,
      })
      const save = dialog.getByRole("button", {
        name: "Change password",
        exact: true,
      })
      await expect(dialog).toContainText("target@example.com")
      await expect(
        dialog.getByLabel("Current password", { exact: true }),
      ).toHaveCount(0)
      await next.fill("discard this value")
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await openDialog()
      await expect(next).toHaveValue("")
      await save.click()
      await expect(next).toBeFocused()
      await expect(
        dialog.getByText("Use at least 12 characters."),
      ).toBeVisible()
      await next.fill("界".repeat(342))
      await confirmation.fill("界".repeat(342))
      await save.click()
      await expect(
        dialog.getByText("Use no more than 1,024 bytes."),
      ).toBeVisible()
      await next.fill(" MyNewPassword123! ")
      await confirmation.fill("mismatched")
      await save.click()
      await expect(dialog.getByText("Passwords do not match.")).toBeVisible()
      expect(attempts).toBe(0)
      await confirmation.fill(" MyNewPassword123! ")
      await dialog
        .getByRole("button", { name: "Show new password", exact: true })
        .click()
      await expect(next).toHaveAttribute("type", "text")
      await dialog
        .getByRole("button", { name: "Hide new password", exact: true })
        .click()
      await expect(next).toHaveAttribute("type", "password")
      await save.click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Unable to change password. Please retry.",
      )
      await expect(page).toHaveURL(/\/accounts$/)
      expect(
        await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("test-session")
      await save.click()
      const pending = dialog.getByRole("button", {
        name: "Changing password…",
        exact: true,
      })
      await expect(pending).toBeDisabled()
      await expect(next).toBeDisabled()
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeDisabled()
      await page.keyboard.press("Escape")
      await expect(dialog).toBeVisible()
      expect(attempts).toBe(2)
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      releaseSubmission()
      await expect(dialog).toHaveCount(0)
      await expect(page).toHaveURL(/\/accounts$/)
      expect(
        await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("test-session")
      await expect(
        page.getByText("Password changed", { exact: true }),
      ).toBeVisible()
      expect(attempts).toBe(2)
    })
  }

  test("superadmin cannot edit their own role or account status", async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN")
    await page.goto("/accounts")
    await expect(page.getByText("Your account", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Role for testsuperadmin@nexus.com/ }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: "More actions for testsuperadmin@nexus.com",
      }),
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "More actions for target@example.com" })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toHaveCount(0)
  })

  test("superadmin can search accounts, modify user roles, and deactivate/reactivate users", async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN")
    await page.goto("/accounts")

    await expect(
      page.getByRole("heading", { name: "Account Management" }),
    ).toBeVisible()
    await expect(page.getByText("Target User")).toBeVisible()

    // 1. Search accounts
    const searchInput = page.getByPlaceholder("Search name or email")
    await searchInput.fill("Target")
    await expect(page.getByText("Target User")).toBeVisible()

    // 2. Modify Role
    const roleDropdown = page.getByRole("button", {
      name: "Role for target@example.com: User",
    })
    await roleDropdown.click()
    await page.getByRole("menuitemradio", { name: "Staff" }).click()

    const saveButton = page.getByRole("button", { name: "Save changes" })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()
    await expect(
      page.getByRole("button", { name: "Role for target@example.com: Staff" }),
    ).toBeVisible()

    // 3. Deactivate User via Row Actions
    const actionsButton = page.getByRole("button", {
      name: "More actions for target@example.com",
    })
    await actionsButton.click()
    await page.getByRole("menuitem", { name: "Deactivate account" }).click()

    // Confirmation dialog opens
    await expect(page.getByText("Deactivate account?")).toBeVisible()
    await page
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click()

    // Status pill reflects Inactive
    await expect(page.getByText("Inactive")).toBeVisible()

    // 4. Reactivate User
    await actionsButton.click()
    await page.getByRole("menuitem", { name: "Reactivate account" }).click()
    await expect(page.getByText("Reactivate account?")).toBeVisible()
    await page
      .getByRole("button", { name: "Reactivate account", exact: true })
      .click()

    // Status pill reflects Active again
    await expect(page.getByText("Active").first()).toBeVisible()
  })

  for (const width of [390, 1280]) {
    test(`superadmin can restore a soft-deleted account at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await restoreSession(page, "SUPERADMIN", {
        initialUsers: [
          {
            ...accountFor("USER"),
            id: "trashed-target",
            email: "target@example.com",
            fullName: "Target User",
            isActive: false,
            accountDeletedAt: "2026-10-01T00:00:00.000Z",
          },
        ],
      })
      let attempts = 0
      let releaseRestore: (() => void) | undefined
      await page.route("**/api/users/trashed-target/restore", async (route) => {
        attempts += 1
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers().authorization).toBe(
          "Bearer test-session",
        )
        if (attempts === 1) {
          await route.fulfill({
            status: 503,
            json: { error: "Restore failed. Please retry." },
          })
          return
        }
        await new Promise<void>((resolve) => {
          releaseRestore = resolve
        })
        await route.fallback()
      })
      await page.goto("/accounts")
      await expect(page.getByText("Target User")).toBeHidden()
      await page.getByRole("button", { name: "Trash", exact: true }).click()
      await expect(page.getByText("Target User")).toBeVisible()
      const openRestore = async () => {
        await page
          .getByRole("button", { name: "More actions for target@example.com" })
          .click()
        await page
          .getByRole("menuitem", { name: "Restore account", exact: true })
          .click()
      }
      await openRestore()
      const dialog = page.getByRole("dialog")
      await expect(
        dialog.getByRole("heading", { name: "Restore account?" }),
      ).toBeVisible()
      await expect(dialog).toContainText("as inactive")
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      expect(attempts).toBe(0)
      await openRestore()
      await dialog
        .getByRole("button", { name: "Restore account", exact: true })
        .click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Restore failed. Please retry.",
      )
      await dialog
        .getByRole("button", { name: "Restore account", exact: true })
        .click()
      await expect(
        dialog.getByRole("button", { name: "Restoring...", exact: true }),
      ).toBeDisabled()
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeDisabled()
      await page.keyboard.press("Escape")
      await expect(dialog).toBeVisible()
      await expect.poll(() => Boolean(releaseRestore)).toBe(true)
      releaseRestore?.()
      await expect(dialog).toBeHidden()
      await expect(page.getByText("Target User")).toBeHidden()
      await page
        .getByRole("button", { name: "Back to Accounts", exact: true })
        .click()
      await expect(page.getByText("Target User")).toBeVisible()
      await expect(page.getByText("Inactive", { exact: true })).toBeVisible()
      await page
        .getByRole("button", { name: "More actions for target@example.com" })
        .click()
      await expect(
        page.getByRole("menuitem", { name: "Restore account", exact: true }),
      ).toBeHidden()
      await page
        .getByRole("menuitem", { name: "Reactivate account", exact: true })
        .click()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Reactivate account", exact: true })
        .click()
      await expect(page.getByText("Active", { exact: true })).toBeVisible()
      expect(attempts).toBe(2)
    })
  }

  test("superadmin can move an inactive account to Trash and delete it permanently", async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN")
    await page.goto("/accounts")

    const searchInput = page.getByPlaceholder("Search name or email")
    await searchInput.fill("Target")

    await page
      .getByRole("button", { name: "More actions for target@example.com" })
      .click()
    await page.getByRole("menuitem", { name: "Deactivate account" }).click()
    await page
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click()

    await page
      .getByRole("button", { name: "More actions for target@example.com" })
      .click()
    await page.getByRole("menuitem", { name: "Move to trash" }).click()
    await expect(page.getByText("Move account to Trash?")).toBeVisible()
    await page.getByRole("button", { name: "Move to Trash" }).click()
    await expect(page.getByText("Target User")).toBeHidden()

    await page.getByRole("button", { name: "Trash", exact: true }).click()
    await expect(page.getByText("Target User")).toBeVisible()
    await expect(
      page
        .getByText("Deleted", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible()

    await page
      .getByRole("button", { name: "More actions for target@example.com" })
      .click()
    await page.getByRole("menuitem", { name: "Delete permanently" }).click()
    await expect(page.getByText("Permanently delete account?")).toBeVisible()
    await page.getByRole("button", { name: "Delete permanently" }).click()
    await expect(page.getByText("Target User")).toBeHidden()
  })
})
