import { expect, test, type Page } from "@playwright/test"
import { restoreSession } from "../regression-support"

const scopes = ["request", "project", "internal"] as const
type Scope = (typeof scopes)[number]
const account = [
  { id: "viewer", fullName: "Fixture viewer" },
  {
    id: "partner",
    fullName: "Fixture partner",
    email: "partner@example.test",
    role: "STAFF",
    position: "Designer",
    isActive: true,
    accountDeletedAt: null,
    department: null,
  },
]
const createdAt = "2026-10-31T10:00:00Z"
const idA = "fixture-alpha"
const idB = "fixture-bravo"
const message = (id: string, body: string) => ({
  id,
  body,
  clientMessageId: id,
  sender: account[1],
  createdAt,
  editedAt: null,
  deletedAt: null,
  purgeAt: null,
})
const threadUrl = (scope: Scope, id: string) => "/messages?" + scope + "=" + id
const messageLog = (page: Page) =>
  page.getByRole("log", { name: /conversation messages/i })
const compose = (page: Page) =>
  page
    .getByRole("form", { name: "Send a message" })
    .getByRole("textbox", { name: /^Message\b/ })

async function mock(
  page: Page,
  scope: Scope,
  options: {
    body?: string
    extraId?: string
    hold?: Promise<void>
    profile?: boolean
  } = {},
) {
  await restoreSession(page, scope === "internal" ? "ADMIN" : "USER", {
    account: { id: "viewer" },
  })
  const specialist = {
    id: "profile-fixture",
    fullName: "Fixture specialist",
    position: "Designer",
    department: { id: "design", name: "Design" },
  }
  const booking = {
    id: "booking-fixture",
    title: "Fixture booking",
    status: "UNDER_REVIEW",
    workflowState: "CONSULTATION",
    previousWorkflowState: null,
    referenceNumber: null,
    packageName: null,
    createdAt,
    updatedAt: createdAt,
    serviceName: "Design",
  }
  if (options.profile) {
    await page.route("**/api/service-requests/booking-fixture", (route) =>
      route.fulfill({
        json: {
          serviceRequest: {
            ...booking,
            service: { id: "service-fixture", name: "Design" },
          },
        },
      }),
    )
    await page.route("**/api/services/service-fixture/specialists", (route) =>
      route.fulfill({ json: { specialists: [specialist] } }),
    )
    await page.route(
      "**/api/services/service-fixture/specialists/profile-fixture",
      (route) =>
        route.fulfill({
          json: {
            specialist: {
              ...specialist,
              specialties: [],
              projects: [],
              socialLinks: [],
            },
          },
        }),
    )
  }
  const gets: string[] = []
  const posts: string[] = []
  for (const family of scopes) {
    const path = "/api/" + family + "-conversations"
    const ids = [idA, idB, ...(options.extraId ? [options.extraId] : [])]
    const row = (id: string) => ({
      id,
      title: id,
      name: id,
      status: "ACTIVE",
      referenceNumber: null,
      updatedAt: createdAt,
      service: { name: id },
      client: account[0],
      acceptedDepartment: {
        id: "design",
        name: id,
        head: { ...account[1], fullName: id },
      },
      participant: { ...account[1], fullName: id },
      participants: account,
      isGroup: false,
      archived: false,
      lastMessage: null,
      unreadCount: 0,
    })
    await page.route("**" + path + "**", async (route) => {
      const req = route.request()
      const suffix = new URL(req.url()).pathname.slice(path.length)
      if (suffix === "/contacts") return route.fulfill({ json: [] })
      if (!suffix)
        return route.fulfill({
          json: {
            conversations: family === scope ? ids.map(row) : [],
            nextCursor: null,
            unreadCount: 0,
          },
        })
      const [, id, action] = suffix.split("/")
      if (action === "events")
        return route.fulfill({ contentType: "text/event-stream", body: "" })
      if (action === "read")
        return route.fulfill({
          json: { ok: true, unreadCount: 0, conversationUnreadCount: 0 },
        })
      if (action === "messages" && req.method() === "POST") {
        posts.push(id)
        const body = req.postDataJSON() as { body: string }
        return route.fulfill({
          status: 201,
          json: { message: message("sent-fixture", body.body) },
        })
      }
      gets.push(family + ":" + id)
      if (id === idA && options.hold) await options.hold
      const generic = { ...account[1], fullName: id }
      const service = {
        id,
        bookings: options.profile ? [booking] : [],
        bookingCount: options.profile ? 1 : 0,
        department: { id: "design", name: "Design" },
        head: { ...generic, specialistId: specialist.id },
      }
      await route
        .fulfill({
          json: {
            conversation: family === "request" ? service : generic,
            project:
              family === "project"
                ? { id, name: id, status: "IN_PROGRESS", description: null }
                : undefined,
            participants: account,
            canSend: true,
            archived: false,
            selectedBookingId: options.profile ? booking.id : null,
            deliverables: [],
            nextCursor: null,
            messages: [message(id, options.body ?? "Message from " + id)],
          },
        })
        .catch((error: unknown) => {
          if (id !== idA || !options.hold) throw error
        })
    })
  }
  return { gets, posts }
}

async function each<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  const failures: unknown[] = []
  for (const item of items) {
    try {
      await test.step(String(item), () => run(item))
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "One or more required variants failed")
}

test("PG-028-F001-A001-T001 portal admission", async ({ browser, baseURL }) => {
  await each(
    ["anonymous", "USER", "STAFF", "ADMIN", "SUPERADMIN"] as const,
    async (role) => {
      const page = await browser.newPage({ baseURL })
      try {
        const detail: string[] = []
        await page.route(
          /\/api\/(request|project|internal)-conversations(?:\/|\?|$)/,
          (route) => {
            const path = new URL(route.request().url()).pathname
            if (
              /conversations\/[^/]+$/.test(path) &&
              !path.endsWith("/contacts")
            )
              detail.push(path)
            return route.fulfill({
              json: path.endsWith("/contacts")
                ? []
                : { conversations: [], unreadCount: 0, nextCursor: null },
            })
          },
        )
        if (role !== "anonymous") await restoreSession(page, role)
        await page.goto("/messages")
        if (role === "anonymous") {
          await expect(page).toHaveURL(/\/login(?:\?|$)/)
          expect(detail).toEqual([])
        } else
          await expect(
            page.getByRole("navigation", {
              name: "Conversations",
              exact: true,
            }),
          ).toBeVisible()
      } finally {
        await page.close()
      }
    },
  )
})

test("PG-028-F004-A001-T004 project and internal query validation", async ({
  browser,
  baseURL,
}) => {
  const allowed = "a".repeat(80)
  await each(["project", "internal"] as const, async (scope) => {
    await each(
      ["repeated", "too long", "punctuation", "valid"] as const,
      async (variant) => {
        const page = await browser.newPage({ baseURL })
        try {
          const state = await mock(page, scope, { extraId: allowed })
          const values = {
            repeated: idA + "&" + scope + "=" + idB,
            "too long": "x".repeat(81),
            punctuation: "bad.id",
            valid: allowed,
          }
          const loaded = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
              "/api/" + scope + "-conversations",
          )
          const prefix =
            scope === "internal" ? "mode=internal&" : "scope=project&"
          await page.goto("/messages?" + prefix + scope + "=" + values[variant])
          await loaded
          if (variant === "valid") {
            await expect(
              messageLog(page).getByText("Message from " + allowed, {
                exact: true,
              }),
            ).toBeVisible()
            expect(new Set(state.gets)).toEqual(
              new Set([scope + ":" + allowed]),
            )
          } else {
            await expect(
              page.getByRole("link", { name: new RegExp(idA) }),
            ).toBeVisible()
            expect(state.gets).toEqual([])
          }
        } finally {
          await page.close()
        }
      },
    )
  })
})

test("PG-028-F021-A001-T021 thread switch isolation", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000)
  await each(scopes, async (scope) => {
    const page = await browser.newPage({
      baseURL,
      viewport: { width: 1440, height: 900 },
    })
    let release!: () => void
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    try {
      const state = await mock(page, scope, { hold })
      const aPath = "/api/" + scope + "-conversations/" + idA
      const aStarted = page.waitForRequest(
        (req) => new URL(req.url()).pathname === aPath,
      )
      const aSettled = Promise.race([
        page.waitForResponse(
          (response) => new URL(response.url()).pathname === aPath,
        ),
        page.waitForEvent("requestfailed", {
          predicate: (req) => new URL(req.url()).pathname === aPath,
        }),
      ])
      void aSettled.catch(() => {})
      await page.goto(threadUrl(scope, idA))
      await aStarted
      await page.getByRole("link", { name: new RegExp(idB) }).click()
      await expect(
        messageLog(page).getByText("Message from " + idB, { exact: true }),
      ).toBeVisible()
      release()
      await aSettled
      await expect(
        messageLog(page).getByText("Message from " + idA, { exact: true }),
      ).toHaveCount(0)
      await expect(
        messageLog(page).getByText("Message from " + idB, { exact: true }),
      ).toBeVisible()
      await compose(page).fill("Send in the settled thread")
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click()
      await expect(
        messageLog(page).getByText("Send in the settled thread", {
          exact: true,
        }),
      ).toBeVisible()
      expect(state.posts).toEqual([idB])
    } finally {
      release()
      await page.close()
    }
  })
})

test("PG-028-F022-A001-T022 literal message rendering", async ({
  browser,
  baseURL,
}) => {
  await each(scopes, async (scope) => {
    const page = await browser.newPage({
      baseURL,
      viewport: { width: 390, height: 844 },
    })
    try {
      const literal =
        "<pg028-marker>synthetic</pg028-marker> " + "z".repeat(180)
      await mock(page, scope, { body: literal })
      await page.goto(threadUrl(scope, idA))
      await expect(
        messageLog(page).getByText(literal, { exact: true }),
      ).toBeVisible()
      await expect(page.locator("pg028-marker")).toHaveCount(0)
      const composer = compose(page)
      await expect(composer).toBeEditable()
      const box = await composer.boundingBox()
      expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true)
    } finally {
      await page.close()
    }
  })
})

test("PG-028-F023-A001-T023 keyboard and rail breakpoint", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000)
  async function tabTo(page: Page, selector: ReturnType<Page["getByRole"]>) {
    for (let index = 0; index < 70; index++) {
      if (
        await selector.evaluate((element) => element === document.activeElement)
      )
        break
      await page.keyboard.press("Tab")
    }
    await expect(selector).toBeFocused()
  }
  await each(["request", "internal"] as const, async (scope) => {
    await each([390, 767, 768, 769, 1440] as const, async (width) => {
      const page = await browser.newPage({
        baseURL,
        viewport: { width, height: 900 },
      })
      try {
        await mock(page, scope, { profile: scope === "request" })
        await page.goto(
          "/messages" + (scope === "internal" ? "?mode=internal" : ""),
        )
        const link = page.getByRole("link", { name: new RegExp(idA) })
        await expect(link).toBeVisible()
        await tabTo(page, link)
        await page.keyboard.press("Enter")
        const composer = compose(page)
        await expect(composer).toBeVisible()
        const shell = page.getByRole("main", { name: "Messages", exact: true })
        const geometry = await shell.evaluate((element) => ({
          tracks:
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          visiblePanes: Array.from(element.children).filter(
            (child) => child.getBoundingClientRect().width > 0,
          ).length,
        }))
        await test
          .info()
          .attach(scope + "-" + width + "-geometry", {
            body: JSON.stringify(geometry),
            contentType: "application/json",
          })
        // The compiled max-[767px] utility uses "not all and (min-width:767px)".
        expect
          .soft(geometry)
          .toEqual({
            tracks: width < 767 ? 1 : 2,
            overflow: false,
            visiblePanes: width < 767 ? 1 : 2,
          })
        await tabTo(page, composer)
        const dialogTrigger = page.getByRole("button", {
          name: /^View .*profile/i,
        })
        if (scope === "request") {
          await expect(dialogTrigger).toBeEnabled()
          await tabTo(page, dialogTrigger)
          await page.keyboard.press("Enter")
          await expect(page.getByRole("dialog")).toBeVisible()
          await page.keyboard.press("Escape")
          await expect(page.getByRole("dialog")).toHaveCount(0)
          await expect(dialogTrigger).toBeFocused()
        }
      } finally {
        await page.close()
      }
    })
  })
})
