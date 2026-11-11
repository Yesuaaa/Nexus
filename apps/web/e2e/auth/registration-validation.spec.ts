import { expect, test, type Page } from "@playwright/test"
import {
  configureRegressionTest,
  mockApi,
  storedTokens,
} from "../regression-support"

configureRegressionTest()

const validRegistration = {
  fullName: "Taylor Tester",
  contactNumber: "09123456789",
  email: "taylor@example.com",
  password: "CorrectHorse123!",
  confirmPassword: "CorrectHorse123!",
}

type RegistrationValues = typeof validRegistration

async function fillRegistration(
  page: Page,
  values: Partial<RegistrationValues> = {},
) {
  const registration = { ...validRegistration, ...values }
  await page
    .getByLabel("Full name", { exact: true })
    .fill(registration.fullName)
  await page
    .getByLabel("Contact number", { exact: true })
    .fill(registration.contactNumber)
  await page
    .getByLabel("Email address", { exact: true })
    .fill(registration.email)
  await page.getByLabel("Password", { exact: true }).fill(registration.password)
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill(registration.confirmPassword)
}

function createAccountButton(page: Page) {
  return page.getByRole("button", { name: "Create Account", exact: true })
}

const invalidFields = [
  {
    field: "Contact number",
    value: "0912345678",
    error: "Enter 11 digits starting with 09 or 08.",
    password: "CorrectHorse123!",
    confirmation: "CorrectHorse123!",
  },
  {
    field: "Email address",
    value: "not-an-email",
    error: "Enter a valid email address, such as name@example.com.",
    password: "CorrectHorse123!",
    confirmation: "CorrectHorse123!",
  },
  {
    field: "Password",
    value: "short",
    error: "Use at least 12 characters for your password.",
    password: "short",
    confirmation: "short",
  },
  {
    field: "Confirm Password",
    value: "DifferentHorse123!",
    error: "Passwords do not match. Enter the same password.",
    password: "CorrectHorse123!",
    confirmation: "DifferentHorse123!",
  },
] as const

for (const scenario of invalidFields) {
  test(`[NEX-010] registration shows the ${scenario.field.toLowerCase()} error without submitting`, async ({
    page,
  }) => {
    let registrationRequests = 0
    await page.route("**/api/auth/register", async (route) => {
      registrationRequests += 1
      return route.fulfill({ status: 201, json: {} })
    })

    await page.goto("/register")
    await page.getByLabel("Full name", { exact: true }).fill("Taylor Tester")
    await page
      .getByLabel("Contact number", { exact: true })
      .fill(
        scenario.field === "Contact number" ? scenario.value : "09123456789",
      )
    await page
      .getByLabel("Email address", { exact: true })
      .fill(
        scenario.field === "Email address"
          ? scenario.value
          : "taylor@example.com",
      )
    await page.getByLabel("Password", { exact: true }).fill(scenario.password)
    await page
      .getByLabel("Confirm Password", { exact: true })
      .fill(scenario.confirmation)

    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click()

    await expect(page.getByText(scenario.error, { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
    expect(registrationRequests).toBe(0)
  })
}

test("registration renders required fields, password controls, and Login navigation", async ({
  page,
}) => {
  await page.goto("/register")

  await expect(
    page.getByRole("heading", { name: "Create Account", exact: true }),
  ).toBeVisible()
  const fullName = page.getByLabel("Full name", { exact: true })
  const contactNumber = page.getByLabel("Contact number", { exact: true })
  const email = page.getByLabel("Email address", { exact: true })
  const password = page.getByLabel("Password", { exact: true })
  const confirmation = page.getByLabel("Confirm Password", { exact: true })

  await expect(fullName).toHaveAttribute("autocomplete", "name")
  await expect(fullName).toHaveJSProperty("required", true)
  await expect(fullName).toHaveAttribute("minlength", "2")
  await expect(fullName).toHaveAttribute("maxlength", "100")
  await expect(contactNumber).toHaveAttribute("type", "tel")
  await expect(contactNumber).toHaveAttribute("autocomplete", "tel")
  await expect(contactNumber).toHaveAttribute("maxlength", "11")
  await expect(contactNumber).toHaveJSProperty("required", true)
  await expect(email).toHaveAttribute("type", "email")
  await expect(email).toHaveAttribute("autocomplete", "email")
  await expect(email).toHaveAttribute("maxlength", "254")
  await expect(email).toHaveJSProperty("required", true)
  await expect(password).toHaveAttribute("autocomplete", "new-password")
  await expect(password).toHaveAttribute("type", "password")
  await expect(password).toHaveJSProperty("required", true)
  await expect(confirmation).toHaveAttribute("autocomplete", "new-password")
  await expect(confirmation).toHaveAttribute("type", "password")
  await expect(confirmation).toHaveJSProperty("required", true)
  await expect(createAccountButton(page)).toBeEnabled()

  await password.fill("SyntheticPassword123!")
  await page.getByRole("button", { name: "Show password" }).click()
  await expect(password).toHaveAttribute("type", "text")
  await expect(password).toHaveValue("SyntheticPassword123!")
  await expect(
    page.getByRole("button", { name: "Hide password" }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Hide password" }).click()
  await expect(password).toHaveAttribute("type", "password")
  await expect(password).toHaveValue("SyntheticPassword123!")

  await page.getByRole("link", { name: "Sign in", exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test("empty and whitespace-only registration input focuses each required field without posting", async ({
  page,
}) => {
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    await route.fulfill({ status: 201, json: {} })
  })
  await page.goto("/register")
  const fullName = page.getByLabel("Full name", { exact: true })
  const contactNumber = page.getByLabel("Contact number", { exact: true })
  const email = page.getByLabel("Email address", { exact: true })
  const password = page.getByLabel("Password", { exact: true })
  const confirmation = page.getByLabel("Confirm Password", { exact: true })
  const submit = createAccountButton(page)

  await submit.click()
  await expect(
    page.getByText("Enter your full name.", { exact: true }),
  ).toBeVisible()
  await expect(fullName).toBeFocused()
  await expect(fullName).toHaveAttribute("aria-invalid", "true")

  await fullName.fill("   ")
  await submit.click()
  await expect(
    page.getByText("Enter your full name.", { exact: true }),
  ).toBeVisible()
  await expect(fullName).toBeFocused()

  await fullName.fill("Taylor Tester")
  await submit.click()
  await expect(
    page.getByText("Enter your contact number.", { exact: true }),
  ).toBeVisible()
  await expect(contactNumber).toBeFocused()

  await contactNumber.fill("09123456789")
  await submit.click()
  await expect(
    page.getByText("Enter your email address.", { exact: true }),
  ).toBeVisible()
  await expect(email).toBeFocused()

  await email.fill("taylor@example.com")
  await submit.click()
  await expect(
    page.getByText("Enter your password.", { exact: true }),
  ).toBeVisible()
  await expect(password).toBeFocused()

  await password.fill("CorrectHorse123!")
  await submit.click()
  await expect(
    page.getByText("Confirm your password.", { exact: true }),
  ).toBeVisible()
  await expect(confirmation).toBeFocused()
  expect(registrationRequests).toBe(0)
})

test("registration accepts the 100-character full-name boundary", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    await route.fallback()
  })
  await page.goto("/register")

  const maximumName = "A".repeat(100)
  await fillRegistration(page, { fullName: maximumName })
  const submitted = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  const request = await submitted
  expect((request.postDataJSON() as { fullName: string }).fullName).toBe(
    maximumName,
  )
  expect(registrationRequests).toBe(1)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("registration rejects unsupported name punctuation and accepts Unicode names", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    await route.fallback()
  })
  await page.goto("/register")

  await fillRegistration(page, { fullName: "Taylor_Tester" })
  await createAccountButton(page).click()
  await expect(
    page.getByText("Letters, spaces, hyphens, apostrophes and periods only.", {
      exact: true,
    }),
  ).toBeVisible()
  expect(registrationRequests).toBe(0)

  await page.getByLabel("Full name", { exact: true }).fill("李明")
  const submitted = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  expect(
    (await submitted).postDataJSON() as { fullName: string },
  ).toMatchObject({
    fullName: "李明",
  })
  expect(registrationRequests).toBe(1)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("registration enforces the contact prefix and email suffix rules", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    await route.fallback()
  })
  await page.goto("/register")
  await fillRegistration(page, {
    contactNumber: "07123456789",
    email: "member@example.org",
  })
  await createAccountButton(page).click()
  await expect(
    page.getByText("Enter 11 digits starting with 09 or 08.", { exact: true }),
  ).toBeVisible()
  expect(registrationRequests).toBe(0)

  await page.getByLabel("Contact number", { exact: true }).fill("09123456789")
  await createAccountButton(page).click()
  await expect(
    page.getByText("Enter a valid email address, such as name@example.com.", {
      exact: true,
    }),
  ).toBeVisible()
  expect(registrationRequests).toBe(0)

  await page
    .getByLabel("Email address", { exact: true })
    .fill("member@example.ph")
  const submitted = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  expect((await submitted).postDataJSON() as { email: string }).toMatchObject({
    email: "member@example.ph",
  })
  expect(registrationRequests).toBe(1)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("registration strips separators from a formatted contact number", async ({
  page,
}) => {
  await page.goto("/register")
  const contactNumber = page.getByLabel("Contact number", { exact: true })
  await contactNumber.fill("08-1234 56789")
  await expect(contactNumber).toHaveValue("08123456789")
})

test("registration accepts the 254-character email boundary", async ({
  page,
}) => {
  await mockApi(page, "USER")
  await page.goto("/register")
  const email = `${"a".repeat(242)}@example.com`
  expect(email.length).toBe(254)
  await fillRegistration(page, { email })

  const submitted = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  expect((await submitted).postDataJSON() as { email: string }).toMatchObject({
    email,
  })
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("registration trims profile fields and preserves password whitespace", async ({
  page,
}) => {
  await mockApi(page, "USER")
  await page.goto("/register")
  await fillRegistration(page, {
    fullName: " 李明 ",
    contactNumber: "08123456789",
    email: " User@Example.PH ",
    password: " CorrectHorse123! ",
    confirmPassword: " CorrectHorse123! ",
  })

  const requestPromise = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  const request = await requestPromise
  expect(request.method()).toBe("POST")
  expect(await request.headerValue("authorization")).toBeNull()
  expect(request.postDataJSON()).toEqual({
    fullName: "李明",
    contactNumber: "08123456789",
    email: "User@Example.PH",
    password: " CorrectHorse123! ",
  })
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
  expect(
    await page.evaluate(() => localStorage.getItem("nexus.auth.token")),
  ).toBeNull()
})

const missingPasswordRequirements = [
  {
    name: "capital letter",
    password: "lowercase123!",
    error: "Include at least one capital letter.",
  },
  {
    name: "lowercase letter",
    password: "UPPERCASE123!",
    error: "Include at least one lowercase letter.",
  },
  {
    name: "number",
    password: "MixedPassword!",
    error: "Include at least one number.",
  },
  {
    name: "special character",
    password: "MixedPassword123",
    error: "Include at least one special character.",
  },
] as const

for (const scenario of missingPasswordRequirements) {
  test(`registration rejects a password without a ${scenario.name}`, async ({
    page,
  }) => {
    let registrationRequests = 0
    await page.route("**/api/auth/register", async (route) => {
      registrationRequests += 1
      await route.fulfill({ status: 201, json: {} })
    })
    await page.goto("/register")
    await fillRegistration(page, {
      password: scenario.password,
      confirmPassword: scenario.password,
    })
    await createAccountButton(page).click()
    await expect(page.getByText(scenario.error, { exact: true })).toBeVisible()
    expect(registrationRequests).toBe(0)
  })
}

test("registration enforces the 1024-byte password limit and accepts its UTF-8 boundary", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    await route.fallback()
  })
  await page.goto("/register")

  const boundaryPassword = `${"A".repeat(1018)}a1😀`
  const overLimitPassword = `${boundaryPassword}A`
  expect(new TextEncoder().encode(boundaryPassword).length).toBe(1024)
  expect(new TextEncoder().encode(overLimitPassword).length).toBe(1025)
  await fillRegistration(page, {
    password: overLimitPassword,
    confirmPassword: overLimitPassword,
  })
  await createAccountButton(page).click()
  await expect(
    page.getByText("Password is too long. Use fewer characters.", {
      exact: true,
    }),
  ).toBeVisible()
  expect(registrationRequests).toBe(0)

  await page.getByLabel("Password", { exact: true }).fill(boundaryPassword)
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill(boundaryPassword)
  const submitted = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  const request = await submitted
  expect((request.postDataJSON() as { password: string }).password).toBe(
    boundaryPassword,
  )
  expect(registrationRequests).toBe(1)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("registration confirmation can be corrected after a mismatch", async ({
  page,
}) => {
  await mockApi(page, "USER")
  await page.goto("/register")
  await fillRegistration(page, { confirmPassword: "DifferentHorse123!" })
  await createAccountButton(page).click()
  await expect(
    page.getByText("Passwords do not match. Enter the same password.", {
      exact: true,
    }),
  ).toBeVisible()
  expect(await storedTokens(page)).toEqual([null, null])

  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill(validRegistration.password)
  const submitted = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  await submitted
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})

test("registration handles HTTP 400 validation responses and permits a corrected retry", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    if (registrationRequests === 1) {
      await route.fulfill({
        status: 400,
        json: { error: "Provide a valid name and contact number" },
      })
      return
    }
    await route.fallback()
  })
  await page.goto("/register")
  await fillRegistration(page)
  await createAccountButton(page).click()

  await expect(
    page.getByRole("alert").filter({
      hasText: "Something went wrong. Please try again.",
    }),
  ).toBeVisible()
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    validRegistration.email,
  )
  expect(await storedTokens(page)).toEqual([null, null])
  await expect(page).toHaveURL(/\/register$/)

  await page.getByLabel("Full name", { exact: true }).fill("Corrected Tester")
  const retry = page.waitForRequest("**/api/auth/register")
  await createAccountButton(page).click()
  await retry
  expect(registrationRequests).toBe(2)
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})

test("registration server errors retain form values and permit retry", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    if (registrationRequests === 1) {
      await route.fulfill({ status: 503, json: { error: "Unavailable" } })
      return
    }
    await route.fallback()
  })
  await page.goto("/register")
  await fillRegistration(page)
  await createAccountButton(page).click()

  await expect(
    page.getByText("The server is having trouble. Please try again shortly."),
  ).toBeVisible()
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    validRegistration.email,
  )
  await expect(createAccountButton(page)).toBeEnabled()
  expect(await storedTokens(page)).toEqual([null, null])
  await expect(page).toHaveURL(/\/register$/)

  await createAccountButton(page).click()
  expect(registrationRequests).toBe(2)
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})

test("registration rate limits keep the form open without creating a session", async ({
  page,
}) => {
  await mockApi(page, "USER")
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 429,
      json: { error: "Too many registration attempts. Try again later." },
    }),
  )
  await page.goto("/register")
  await fillRegistration(page)
  await createAccountButton(page).click()

  await expect(
    page.getByText(
      "Too many sign-in attempts. Please wait 15 minutes and try again.",
      { exact: true },
    ),
  ).toBeVisible()
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    validRegistration.email,
  )
  expect(await storedTokens(page)).toEqual([null, null])
  await expect(page).toHaveURL(/\/register$/)
})

test("registration network failures retain values and permit retry", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    if (registrationRequests === 1) {
      await route.abort("failed")
      return
    }
    await route.fallback()
  })
  await page.goto("/register")
  await fillRegistration(page)
  await createAccountButton(page).click()

  await expect(
    page.getByText(
      "Can't reach the server. Check your connection and try again.",
    ),
  ).toBeVisible()
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    validRegistration.email,
  )
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    validRegistration.password,
  )
  await expect(createAccountButton(page)).toBeEnabled()
  expect(await storedTokens(page)).toEqual([null, null])
  await expect(page).toHaveURL(/\/register$/)

  await createAccountButton(page).click()
  expect(registrationRequests).toBe(2)
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})

test("registration submits with Enter once and blocks repeated in-flight submits", async ({
  page,
}) => {
  await mockApi(page, "USER")
  let registrationRequests = 0
  let releaseRegistration!: () => void
  const registrationGate = new Promise<void>((resolve) => {
    releaseRegistration = resolve
  })
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1
    await registrationGate
    await route.fallback()
  })
  await page.goto("/register")
  await fillRegistration(page)

  const submitted = page.waitForRequest("**/api/auth/register")
  await page.getByLabel("Confirm Password", { exact: true }).press("Enter")
  await submitted
  const pendingSubmit = page.getByRole("button", { name: /Creating Account/ })
  await expect(pendingSubmit).toBeDisabled()
  try {
    await page.locator("form").evaluate((form) => {
      const registrationForm = form as HTMLFormElement
      registrationForm.requestSubmit()
      registrationForm.requestSubmit()
    })
    expect(registrationRequests).toBe(1)
  } finally {
    releaseRegistration()
  }

  await expect(page).toHaveURL(/\/dashboard$/)
  expect(registrationRequests).toBe(1)
  expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
})

test("a malformed successful registration response cannot establish a session", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }))
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 201,
      json: {
        token: null,
        refreshToken: null,
        expiresIn: 900,
        user: {
          id: "registration-user",
          email: validRegistration.email,
          fullName: validRegistration.fullName,
          contactNumber: validRegistration.contactNumber,
          role: "USER",
          isActive: true,
          permissions: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    }),
  )
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  )
  await page.goto("/register")
  await fillRegistration(page)
  const response = page.waitForResponse(
    (item) =>
      new URL(item.url()).pathname === "/api/auth/register" &&
      item.request().method() === "POST",
  )
  await createAccountButton(page).click()
  expect((await response).status()).toBe(201)

  await expect.poll(() => storedTokens(page)).toEqual([null, null])
})
