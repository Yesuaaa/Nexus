import { expect, test, type Page } from "@playwright/test"

const user = {
  id: "social-user",
  email: "jane@example.com",
  fullName: "Jane Doe",
  contactNumber: "+63 912 345 6789",
  role: "USER",
  permissions: ["dashboard:read", "profile:read"],
  createdAt: "2026-01-01T00:00:00.000Z",
}

async function mockCurrentAccount(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("nexus.auth.token", "A".repeat(43))
  })
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user } }),
  )
}

test("social buttons honor enabled providers and start with a hashed, stored verifier", async ({
  page,
}) => {
  let startBody: Record<string, unknown> | undefined
  let storedVerifier: string | null | undefined
  await page.route("**/api/auth/social/providers", (route) =>
    route.fulfill({
      json: { providers: { google: true, facebook: false, apple: true } },
    }),
  )
  await page.route("**/api/auth/social/google/start", async (route) => {
    startBody = route.request().postDataJSON()
    storedVerifier = await page.evaluate(() => {
      const pending = sessionStorage.getItem("nexus.auth.social.pending")
      return pending ? JSON.parse(pending).verifier : null
    })
    await route.fulfill({
      json: { url: "https://identity.example/google/authorize" },
    })
  })
  await page.route("https://identity.example/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Authorization page" }),
  )

  await page.goto("/login")
  const google = page.getByRole("button", { name: "Continue with Google" })
  await expect(google).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Continue with Facebook" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeVisible()
  await google.click()
  await page.waitForURL("https://identity.example/google/authorize")

  expect(startBody?.verifierHash).toMatch(/^[a-f0-9]{64}$/)
  expect(storedVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
})

test("provider loading errors can retry and empty provider lists are explained", async ({
  page,
}) => {
  let requests = 0
  await page.route("**/api/auth/social/providers", async (route) => {
    requests += 1
    if (requests === 1) {
      await route.fulfill({ status: 503, json: { error: "Unavailable" } })
      return
    }
    await route.fulfill({
      json: { providers: { google: false, facebook: false, apple: false } },
    })
  })

  await page.goto("/login")
  await expect(page.locator("main p[role='alert']")).toContainText(
    "couldn't be loaded",
  )
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.locator("main [role='status']")).toContainText(
    "not available right now",
  )
  await expect(page.getByRole("button", { name: /Continue with/ })).toHaveCount(
    0,
  )
  expect(requests).toBe(2)
})

test("provider cancellation clears the callback fragment without exchanging a code", async ({
  page,
}) => {
  let completionRequests = 0
  await page.route("**/api/auth/social/complete", async (route) => {
    completionRequests += 1
    await route.fulfill({ json: { onboarding: true, emailRequired: false } })
  })

  await page.goto("/auth/social/complete#error=cancelled")
  await expect(page.locator("main p[role='alert']")).toContainText(
    "Sign-in was cancelled",
  )
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("")
  expect(completionRequests).toBe(0)
})

test("storage failure during callback clears the fragment and shows a handled error", async ({
  page,
}) => {
  let completionRequests = 0
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "nexus.auth.social.pending",
      JSON.stringify({
        verifier: "V".repeat(43),
        purpose: "signin",
        provider: "google",
      }),
    )
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "nexus.auth.social.pending") {
        throw new DOMException("Storage is disabled", "SecurityError")
      }
      return originalSetItem.call(this, key, value)
    }
  })
  await page.route("**/api/auth/social/complete", async (route) => {
    completionRequests += 1
    await route.fulfill({ json: { onboarding: true, emailRequired: false } })
  })

  await page.goto(`/auth/social/complete#code=${"C".repeat(43)}`)
  await expect(page.locator("main p[role='alert']")).toContainText(
    "Social sign-in didn't finish",
  )
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("")
  expect(completionRequests).toBe(0)
})

test("blocked session storage prevents starting social sign-in", async ({
  page,
}) => {
  let startRequests = 0
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "nexus.auth.social.pending") {
        throw new DOMException("Storage is disabled", "SecurityError")
      }
      return originalSetItem.call(this, key, value)
    }
  })
  await page.route("**/api/auth/social/providers", (route) =>
    route.fulfill({
      json: { providers: { google: true, facebook: false, apple: false } },
    }),
  )
  await page.route("**/api/auth/social/google/start", async (route) => {
    startRequests += 1
    await route.fulfill({ json: { url: "https://identity.example/authorize" } })
  })

  await page.goto("/login")
  await page.getByRole("button", { name: "Continue with Google" }).click()
  await expect(page.locator("main p[role='alert']")).toContainText(
    "Couldn't start social sign-in",
  )
  expect(startRequests).toBe(0)
})

test("social onboarding verifies a missing email and completes into a session", async ({
  page,
}) => {
  const completionBodies: Array<Record<string, unknown>> = []
  let emailRequest: Record<string, unknown> | undefined
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "nexus.auth.social.pending",
      JSON.stringify({
        verifier: "V".repeat(43),
        purpose: "signin",
        provider: "google",
      }),
    )
  })
  await page.route("**/api/auth/social/complete", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    completionBodies.push(body)
    if (!body.fullName) {
      await route.fulfill({
        json: { onboarding: true, emailRequired: true, fullName: "" },
      })
      return
    }
    await route.fulfill({
      json: { token: "B".repeat(43), user, expiresIn: 3600 },
    })
  })
  await page.route("**/api/auth/social/email", async (route) => {
    emailRequest = route.request().postDataJSON()
    await route.fulfill({ json: { sent: true } })
  })
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user } }),
  )

  await page.goto(`/auth/social/complete#code=${"C".repeat(43)}`)
  await expect(
    page.getByRole("heading", { name: "Complete your account" }),
  ).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("")
  await page.getByLabel("Full name").fill("Jane Doe")
  await page.getByLabel("Contact number").fill("+63 912 345 6789")
  await page.getByLabel("Email address").fill("jane@example.com")
  await page.getByRole("button", { name: "Send email code" }).click()
  await expect(page.locator("main [role='status']")).toContainText(
    "sent a verification code",
  )
  await page.getByLabel("Email verification code").fill("12345678")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  expect(emailRequest).toEqual({
    code: "C".repeat(43),
    verifier: "V".repeat(43),
    email: "jane@example.com",
  })
  expect(completionBodies).toHaveLength(2)
  expect(completionBodies[1]).toMatchObject({
    code: "C".repeat(43),
    verifier: "V".repeat(43),
    fullName: "Jane Doe",
    contactNumber: "+63 912 345 6789",
    email: "jane@example.com",
    emailCode: "12345678",
  })
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nexus.auth.token")))
    .toBe("B".repeat(43))
})

test("password accounts confirm the password before linking a provider", async ({
  page,
}) => {
  let startRequest:
    | {
        body: Record<string, unknown>
        authorization: string | undefined
      }
    | undefined
  await mockCurrentAccount(page)
  await page.route("**/api/auth/social/providers", (route) =>
    route.fulfill({
      json: { providers: { google: false, facebook: true, apple: false } },
    }),
  )
  await page.route("**/api/auth/social/connections", (route) =>
    route.fulfill({ json: { providers: [], hasPassword: true } }),
  )
  await page.route("**/api/auth/social/facebook/start", async (route) => {
    startRequest = {
      body: route.request().postDataJSON(),
      authorization: route.request().headers().authorization,
    }
    await route.fulfill({
      json: { url: "https://identity.example/facebook/connect" },
    })
  })
  await page.route("https://identity.example/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Authorization page" }),
  )

  await page.goto("/settings/connections")
  await page.getByLabel("Confirm your password").fill("current-password")
  await page.getByRole("button", { name: "Connect Facebook" }).click()
  await page.waitForURL("https://identity.example/facebook/connect")

  expect(startRequest?.body.purpose).toBe("link")
  expect(startRequest?.body.currentPassword).toBe("current-password")
  expect(startRequest?.body.verifierHash).toMatch(/^[a-f0-9]{64}$/)
  expect(startRequest?.authorization).toBe(`Bearer ${"A".repeat(43)}`)
})

test("connections loading errors end in a retry state instead of spinning", async ({
  page,
}) => {
  let requests = 0
  await mockCurrentAccount(page)
  await page.route("**/api/auth/social/providers", (route) =>
    route.fulfill({
      json: { providers: { google: true, facebook: false, apple: false } },
    }),
  )
  await page.route("**/api/auth/social/connections", async (route) => {
    requests += 1
    if (requests === 1) {
      await route.fulfill({ status: 503, json: { error: "Unavailable" } })
      return
    }
    await route.fulfill({ json: { providers: ["google"], hasPassword: false } })
  })

  await page.goto("/settings/connections")
  await expect(page.locator("main p[role='alert']")).toContainText(
    "Couldn't load your sign-in methods",
  )
  await expect(page.locator("main [role='status']")).toHaveCount(0)
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("Connected to your EXP account")).toBeVisible()
  expect(requests).toBe(2)
})

test("social-only accounts reauthenticate before the requested provider link", async ({
  page,
}) => {
  const starts: Array<{ provider: string; body: Record<string, unknown> }> = []
  await mockCurrentAccount(page)
  await page.route("**/api/auth/social/providers", (route) =>
    route.fulfill({
      json: { providers: { google: true, facebook: false, apple: true } },
    }),
  )
  await page.route("**/api/auth/social/connections", (route) =>
    route.fulfill({ json: { providers: ["google"], hasPassword: false } }),
  )
  await page.route("**/api/auth/social/google/start", async (route) => {
    starts.push({
      provider: "google",
      body: route.request().postDataJSON(),
    })
    await route.fulfill({
      json: { url: `/auth/social/complete#code=${"R".repeat(43)}` },
    })
  })
  await page.route("**/api/auth/social/complete", async (route) =>
    route.fulfill({ json: { reauthenticated: true } }),
  )
  await page.route("**/api/auth/social/apple/start", async (route) => {
    starts.push({
      provider: "apple",
      body: route.request().postDataJSON(),
    })
    await route.fulfill({
      json: { url: "https://identity.example/apple/connect" },
    })
  })
  await page.route("https://identity.example/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Authorization page" }),
  )

  await page.goto("/settings/connections")
  await page.getByRole("button", { name: "Verify with Google" }).click()
  await page.waitForURL("https://identity.example/apple/connect")

  expect(starts).toHaveLength(2)
  expect(starts[0]).toMatchObject({
    provider: "google",
    body: {
      purpose: "reauth",
      verifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
  })
  expect(starts[1]).toMatchObject({
    provider: "apple",
    body: {
      purpose: "link",
      verifierHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
  })
  expect(starts[1].body.currentPassword).toBeUndefined()
})
