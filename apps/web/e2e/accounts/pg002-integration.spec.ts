import { expect, test } from "@playwright/test"
import { configureRegressionTest } from "../regression-support"

configureRegressionTest()

test("[PG-002-F001-A003-T010] create persists through the browser, Next proxy, Express and PGlite", async ({
  page,
}) => {
  const email = "pg002-browser-created@example.test"
  const fullName = "PG Browser Created"
  const password = "Pg002CreatedUser123!"
  await page.goto("/login")
  const loginResponse = await page.evaluate(async (loginPassword: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "pg002-fixture-admin@example.test",
        password: loginPassword,
      }),
    })
    return {
      status: response.status,
      body: (await response.json()) as {
        token: string
        refreshToken: string
        user: { role: string; email: string }
      },
    }
  }, "PG002FixturePassword1!")
  expect(loginResponse.status).toBe(200)
  expect(loginResponse.body.user.role).toBe("SUPERADMIN")
  await page.evaluate(
    ({ token, refreshToken }) => {
      sessionStorage.setItem("nexus.auth.token", token)
      sessionStorage.setItem("nexus.auth.refreshToken", refreshToken)
    },
    {
      token: loginResponse.body.token,
      refreshToken: loginResponse.body.refreshToken,
    },
  )

  await page.goto("/accounts")
  const table = page.getByRole("table", { name: "Accounts", exact: true })
  await expect(
    table.getByText("PG002 Browser Superadmin", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Create account" })
  await dialog.getByLabel("Email address").fill(email)
  await dialog.getByLabel("Full name").fill(fullName)
  await dialog.getByLabel("Contact number").fill("09123456789")
  await dialog.getByLabel(/^Password/).fill(password)
  await dialog.getByLabel(/^Confirm password/).fill(password)

  const createResponsePromise = page.waitForResponse((response) => {
    const request = response.request()
    return (
      request.method() === "POST" &&
      new URL(response.url()).pathname === "/api/users"
    )
  })
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  const createResponse = await createResponsePromise
  expect(createResponse.status()).toBe(201)
  expect(new URL(createResponse.url()).origin).toBe("http://127.0.0.1:5274")
  const createdPayload = (await createResponse.json()) as {
    user: { id: string; email: string; role: string }
  }
  expect(createdPayload.user.email).toBe(email)
  expect(createdPayload.user.role).toBe("USER")
  await expect(dialog).toHaveCount(0)
  await expect(table.getByText(fullName, { exact: true })).toBeVisible()

  await page.reload()
  const reloadedTable = page.getByRole("table", {
    name: "Accounts",
    exact: true,
  })
  await expect(reloadedTable.getByText(fullName, { exact: true })).toBeVisible()

  const stateResponse = await page.request.get(
    "http://127.0.0.1:31372/state?email=" + encodeURIComponent(email),
  )
  expect(stateResponse.status()).toBe(200)
  const state = (await stateResponse.json()) as {
    user: {
      id: string
      email: string
      fullName: string
      role: string
      isActive: boolean
      accountDeletedAt: string | null
      employeeId: string | null
    }
    createdHistory: Array<{
      actorAccountId: string
      actorRoleAtTime: string
      origin: string
    }>
    workforceCount: number
  }
  expect(state.user).toEqual({
    id: createdPayload.user.id,
    email,
    fullName,
    role: "USER",
    isActive: true,
    accountDeletedAt: null,
    employeeId: null,
  })
  expect(state.createdHistory).toEqual([
    {
      actorAccountId: "pg002-browser-root",
      actorRoleAtTime: "SUPERADMIN",
      origin: "ACCOUNT_MANAGEMENT",
    },
  ])
  expect(state.workforceCount).toBe(0)
})
