import { createServer, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { expect, test, type Page } from "@playwright/test"
import type { RequestMessage } from "../src/features/request-conversations/api/request-conversations-api"

let server: Server
let streamOrigin: string
const connections = new Set<ServerResponse>()
const emit = (event = "messages-changed") => {
  for (const response of connections)
    response.write(`event: ${event}\ndata: {}\n\n`)
}
test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*")
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Accept")
    if (request.method === "OPTIONS") {
      response.writeHead(204).end()
      return
    }
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
    })
    response.write(
      "event: connected\ndata: {}\n\nevent: messages-changed\ndata: {}\n\n",
    )
    connections.add(response)
    response.on("close", () => connections.delete(response))
  }).listen(0, "127.0.0.1")
  await new Promise<void>((resolve) => server.once("listening", resolve))
  streamOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
test.afterAll(async () => {
  for (const response of connections) response.end()
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function stateFixture(accepted = true) {
  return {
    accepted,
    messages: [] as RequestMessage[],
    failAfterSave: false,
    ids: [] as string[],
    offline: false,
    listError: false,
    listReads: 0,
  }
}

async function mock(
  page: Page,
  state: ReturnType<typeof stateFixture>,
  role: "USER" | "STAFF" | "ADMIN" | "SUPERADMIN",
  isHead = true,
) {
  const actorId = role === "USER" ? "client-1" : "head-1"
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "conversation-session"),
  )
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.headers().authorization).toBe("Bearer conversation-session")
    const booking = {
      id: "booking-1",
      title: "Website request",
      status: state.accepted ? "UNDER_REVIEW" : "SUBMITTED",
      acceptedDepartmentId: state.accepted ? "design" : null,
      packageName: "Business Website",
      expectedTimeline: "Six weeks",
      preferredSpecialistName: null,
      createdAt: "2026-10-30T08:00:00Z",
      updatedAt: "2026-10-30T08:00:00Z",
      service: { id: "web", name: "Website Development" },
      projectGoals: "Reach customers",
      projectRequirements: "Five accessible pages",
      additionalDetails: null,
      client: {
        fullName: "Mara Client",
        email: "client@example.com",
        contactNumber: "09123456789",
      },
    }
    if (url.pathname === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: actorId,
            fullName: role === "USER" ? "Mara Client" : "Dani Head",
            email: `${actorId}@example.com`,
            contactNumber: null,
            role,
            isActive: true,
            permissions: ["dashboard:read", "profile:read"],
            headOf:
              role === "STAFF" && isHead
                ? { id: "design", name: "Design" }
                : null,
            createdAt: "2026-01-01T00:00:00Z",
          },
        },
      })
    if (url.pathname === "/api/request-conversations") {
      state.listReads++
      if (state.listError)
        return route.fulfill({
          status: 503,
          json: { error: "Couldn't load conversations." },
        })
      return route.fulfill({
        json: {
          conversations: state.accepted
            ? [
                {
                  id: booking.id,
                  title: booking.title,
                  referenceNumber: null,
                  updatedAt: booking.updatedAt,
                  service: booking.service,
                  client: { id: "client-1", fullName: "Mara Client" },
                  acceptedDepartment: { id: "design", name: "Design" },
                  lastMessage: state.messages.at(-1) ?? null,
                },
              ]
            : [],
          nextCursor: null,
        },
      })
    }
    if (["/api/request-inbox", "/api/service-requests"].includes(url.pathname))
      return route.fulfill({
        json: {
          department: { id: "design", name: "Design" },
          serviceRequests: [booking],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      })
    if (
      [
        "/api/request-inbox/booking-1",
        "/api/service-requests/booking-1",
      ].includes(url.pathname)
    )
      return route.fulfill({ json: { serviceRequest: booking } })
    if (url.pathname.endsWith("/accept")) {
      state.accepted = true
      emit()
      return route.fulfill({
        json: {
          serviceRequest: {
            ...booking,
            status: "UNDER_REVIEW",
            acceptedDepartmentId: "design",
          },
        },
      })
    }
    if (url.pathname === "/api/request-conversations/booking-1/events") {
      if (state.offline)
        return route.fulfill({
          status: 503,
          json: { error: "Realtime unavailable" },
        })
      return route.continue({ url: `${streamOrigin}/events` })
    }
    if (url.pathname === "/api/request-conversations/booking-1/messages") {
      const input = request.postDataJSON() as {
        body: string
        clientMessageId: string
      }
      state.ids.push(input.clientMessageId)
      let message = state.messages.find(
        (message) => message.clientMessageId === input.clientMessageId,
      )
      if (!message) {
        message = {
          id: `message-${state.messages.length}`,
          body: input.body,
          editedAt: null,
          deletedAt: null,
          purgeAt: null,
          clientMessageId: input.clientMessageId,
          sender: {
            id: actorId,
            fullName: role === "USER" ? "Mara Client" : "Dani Head",
          },
          createdAt: new Date().toISOString(),
        }
        state.messages.push(message)
        emit()
      }
      if (state.failAfterSave) {
        state.failAfterSave = false
        return route.fulfill({
          status: 503,
          json: { error: "Connection interrupted. Try again." },
        })
      }
      return route.fulfill({ status: 201, json: { message } })
    }
    if (url.pathname === "/api/request-conversations/booking-1") {
      const before = url.searchParams.get("before")
      const end = before
        ? state.messages.findIndex((row) => row.id === before)
        : state.messages.length
      const start = Math.max(0, end - 50)
      return route.fulfill({
        json: {
          conversation: state.accepted
            ? {
                department: { id: "design", name: "Design" },
                head: { id: "head-1", fullName: "Dani Head" },
              }
            : null,
          canSend: state.accepted,
          messages: state.messages.slice(start, end),
          nextCursor: start ? state.messages[start]!.id : null,
        },
      })
    }
    return route.fulfill({ status: 404, json: { error: "Unexpected request" } })
  })
}

async function openBooking(page: Page, role: "USER" | "STAFF") {
  await page.goto(
    role === "USER" ? "/booked-services?booking=booking-1" : "/request-inbox",
  )
  if (role === "STAFF")
    await page
      .getByRole("button", { name: "Review request booking-1", exact: true })
      .click()
  await expect(
    page.getByRole("dialog", { name: "Booking details" }),
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Request conversation" }),
  ).toHaveCount(0)
}

async function openMessages(page: Page, role: "USER" | "STAFF") {
  await openBooking(page, role)
  await page
    .getByRole("link", { name: "Open request workspace", exact: true })
    .click()
  await expect(page).toHaveURL(/\/messages\?request=booking-1$/)
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

test.use({ reducedMotion: "reduce" })

for (const width of [1440, 390]) {
  test(`top bar opens the conversation list on a separate page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = stateFixture()
    await mock(page, state, "USER")
    await page.goto("/dashboard")
    await page.getByRole("link", { name: "Messages", exact: true }).click()
    await expect(page).toHaveURL(/\/messages$/)
    const conversations = page.getByRole("navigation", {
      name: "Conversations",
      exact: true,
    })
    await conversations.getByRole("link", { name: /Website request/ }).click()
    await expect(page).toHaveURL(/\/messages\?request=booking-1$/)
    await expect(page.getByLabel("Message", { exact: true })).toBeEnabled()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    if (width === 390) {
      await expect(conversations).not.toBeVisible()
      await page.getByRole("link", { name: "All conversations" }).click()
      await expect(conversations).toBeVisible()
      await expect(page).toHaveURL(/\/messages$/)
    }
  })
}

test("messages page handles an empty inbox and a failed conversation list", async ({
  page,
}) => {
  const state = stateFixture(false)
  state.listError = true
  await mock(page, state, "USER")
  await page.goto("/messages")
  await expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("alert"),
  ).toHaveText("Couldn't load conversations.")
  state.listError = false
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "No conversations yet" }),
  ).toBeVisible()
  state.accepted = true
  await page.reload()
  await expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("link"),
  ).toHaveCount(1)
})

for (const role of ["STAFF", "ADMIN", "SUPERADMIN"] as const) {
  test(`${role} without participant access cannot open Messages`, async ({
    page,
  }) => {
    const state = stateFixture()
    await mock(page, state, role, false)
    await page.goto("/messages")
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole("link", { name: "Messages", exact: true }),
    ).toHaveCount(0)
    expect(state.listReads).toBe(0)
  })
}

for (const width of [1440, 390]) {
  test(`acceptance opens a two-way conversation at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = stateFixture(false)
    await mock(page, state, "STAFF")
    const client = await context.newPage()
    await client.setViewportSize({ width, height: 920 })
    await mock(client, state, "USER")
    await openMessages(client, "USER")
    await expect(
      client.getByText(/Messaging opens when a department head/),
    ).toBeVisible()
    await openBooking(page, "STAFF")
    await page
      .getByRole("button", { name: "Accept request", exact: true })
      .click()
    await page
      .getByRole("link", { name: "Open request workspace", exact: true })
      .click()
    await expect(page).toHaveURL(/\/messages\?request=booking-1$/)
    const headChat = page.getByRole("region", { name: "Request conversation" })
    const clientChat = client.getByRole("region", {
      name: "Request conversation",
    })
    await expect(headChat.getByLabel("Message", { exact: true })).toBeEnabled()
    await expect(
      clientChat.getByLabel("Message", { exact: true }),
    ).toBeEnabled()
    const text =
      "Hello Mara!\nPlease send your brand guide. <script>alert('test')</script>"
    await headChat.getByLabel("Message", { exact: true }).fill(text)
    await headChat
      .getByRole("button", { name: "Send message", exact: true })
      .click()
    await expect(clientChat.getByText(text, { exact: true })).toBeVisible()
    await clientChat
      .getByLabel("Message", { exact: true })
      .fill("Thanks, Dani. I’ll share the details here.")
    await clientChat
      .getByRole("button", { name: "Send message", exact: true })
      .click()
    await expect(
      headChat.getByText("Thanks, Dani. I’ll share the details here."),
    ).toBeVisible()
    expect(state.messages).toHaveLength(2)
    if (width === 1440)
      await expect(
        page.getByRole("navigation", { name: "Conversations" }),
      ).toContainText("Thanks, Dani. I’ll share the details here.")
    await headChat.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: `test-results/request-messaging-${width}.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await client.close()
  })
}

test("failed sends retain the draft and retry the same message without duplication", async ({
  page,
}) => {
  const state = stateFixture()
  state.failAfterSave = true
  await mock(page, state, "USER")
  await openMessages(page, "USER")
  const chat = page.getByRole("region", { name: "Request conversation" })
  await chat
    .getByLabel("Message", { exact: true })
    .fill("Keep this draft if the connection fails.")
  await chat.getByRole("button", { name: "Send message", exact: true }).click()
  await expect(chat.getByRole("alert")).toContainText("Connection interrupted")
  await expect(chat.getByLabel("Message", { exact: true })).toHaveValue(
    "Keep this draft if the connection fails.",
  )
  await chat.getByRole("button", { name: "Send message", exact: true }).click()
  await expect(chat.getByLabel("Message", { exact: true })).toHaveValue("")
  expect(state.ids).toHaveLength(2)
  expect(state.ids[0]).toBe(state.ids[1])
  expect(state.messages).toHaveLength(1)
  await expect(chat.getByRole("article")).toHaveCount(1)
})

test("reconnection recovers history, loads earlier messages and clears revoked conversations", async ({
  page,
}) => {
  const state = stateFixture()
  state.messages = Array.from({ length: 52 }, (_, index) => ({
    id: `old-${index}`,
    clientMessageId: `old-${index}`,
    body: `Earlier message ${index}`,
    editedAt: null,
    deletedAt: null,
    purgeAt: null,
    createdAt: new Date(Date.UTC(2026, 9, 30, 8, index)).toISOString(),
    sender: { id: "head-1", fullName: "Dani Head" },
  }))
  await mock(page, state, "USER")
  await openMessages(page, "USER")
  const chat = page.getByRole("region", { name: "Request conversation" })
  await expect(chat.getByRole("article")).toHaveCount(50)
  await chat.getByRole("button", { name: "Load earlier messages" }).click()
  await expect(chat.getByRole("article")).toHaveCount(52)
  state.offline = true
  for (const response of connections) response.end()
  state.messages.push({
    id: "missed",
    clientMessageId: "missed",
    body: "Reply sent while you were disconnected",
    editedAt: null,
    deletedAt: null,
    purgeAt: null,
    createdAt: new Date().toISOString(),
    sender: { id: "head-1", fullName: "Dani Head" },
  })
  state.offline = false
  await expect(
    chat.getByText("Reply sent while you were disconnected"),
  ).toBeAttached()
  await expect(chat.getByRole("article")).toHaveCount(53)
  emit("access-revoked")
  await expect(chat.getByRole("alert")).toHaveText(
    "You no longer have access to this conversation.",
  )
  await expect(chat.getByRole("article")).toHaveCount(0)
  await expect(chat.getByLabel("Message", { exact: true })).toHaveCount(0)
})
