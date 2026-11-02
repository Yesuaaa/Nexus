import { createServer, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { expect, test, type Page } from "@playwright/test"
import type {
  ConversationSummary,
  RequestMessage,
} from "../src/features/request-conversations/api/request-conversations-api"
import type { Workflow } from "../src/features/request-workflow/model/workflow"

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
    conversations: null as ConversationSummary[] | null,
    moreConversations: [] as ConversationSummary[],
    threadMessages: new Map<string, RequestMessage[]>(),
    deletedConversations: new Set<string>(),
    failDelete: false,
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
      status: state.accepted
        ? ("UNDER_REVIEW" as const)
        : ("SUBMITTED" as const),
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
      const isVisible = (row: ConversationSummary) => {
        const archived = ["CLOSED", "CANCELLED"].includes(row.status)
        return (
          archived === (url.searchParams.get("view") === "archived") &&
          (!archived || !state.deletedConversations.has(row.id))
        )
      }
      const more = state.moreConversations.filter(isVisible)
      return route.fulfill({
        json: {
          conversations: url.searchParams.has("before")
            ? more
            : (
                state.conversations ??
                (state.accepted
                  ? [
                      {
                        id: booking.id,
                        status: booking.status,
                        title: booking.title,
                        referenceNumber: null,
                        updatedAt: booking.updatedAt,
                        service: booking.service,
                        client: { id: "client-1", fullName: "Mara Client" },
                        acceptedDepartment: {
                          id: "design",
                          name: "Design",
                          head: {
                            id: "head-1",
                            fullName: "Dani Head",
                            imageUrl:
                              "https://profile-test.supabase.co/storage/v1/object/public/service-images/profile.png",
                          },
                        },
                        lastMessage: state.messages.at(-1) ?? null,
                      },
                    ]
                  : [])
              ).filter(isVisible),
          nextCursor:
            !url.searchParams.has("before") && more.length
              ? "older-services"
              : null,
          unreadCount: state.conversations
            ?.filter((row) => !["CLOSED", "CANCELLED"].includes(row.status))
            .reduce((total, row) => total + (row.unreadCount ?? 0), 0),
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
    if (url.pathname === "/api/services/web/specialists")
      return route.fulfill({
        json: {
          specialists: [
            {
              id: "specialist-1",
              fullName: "Dani Head",
              position: "Designer",
              department: { id: "design", name: "Design" },
            },
            {
              id: "specialist-2",
              fullName: "Dani Head",
              position: "Designer",
              department: { id: "design", name: "Design" },
            },
          ],
        },
      })
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
          archived: false,
          conversation: state.accepted
            ? {
                department: { id: "design", name: "Design" },
                head: {
                  id: "head-1",
                  fullName: "Dani Head",
                  specialistId: "specialist-1",
                  imageUrl:
                    "https://profile-test.supabase.co/storage/v1/object/public/service-images/profile.png",
                },
              }
            : null,
          canSend: state.accepted,
          messages: state.messages.slice(start, end),
          nextCursor: start ? state.messages[start]!.id : null,
        },
      })
    }
    const serviceThreads = state.conversations?.concat(state.moreConversations)
    const workflowThread = serviceThreads?.find(
      (row) => url.pathname === `/api/request-workflows/${row.id}`,
    )
    if (workflowThread) {
      const workflow: Workflow = {
        request: {
          id: workflowThread.id,
          referenceNumber: workflowThread.referenceNumber,
          title: workflowThread.title,
          serviceName: workflowThread.service.name,
          packageName: null,
          pricingModel: "CUSTOM_QUOTE",
          goals: "Reach customers",
          requirements: `Requirements for ${workflowThread.referenceNumber}`,
          expectedTimeline: "Six weeks",
          client: workflowThread.client,
          department: workflowThread.acceptedDepartment,
        },
        state:
          workflowThread.status === "CANCELLED"
            ? "CANCELLED"
            : workflowThread.status === "CLOSED"
              ? "ON_HOLD"
              : "CONSULTATION",
        previousState: null,
        version: 1,
        nextAction:
          "Discuss the service requirements with your department head.",
        consultationRequired: false,
        quotationApprovalRequired: false,
        permissions: {
          manage:
            role === "STAFF" &&
            !["CLOSED", "CANCELLED"].includes(workflowThread.status),
          isClient: role === "USER",
          approveQuotation: false,
          verifyPayment: false,
        },
        requirements: [],
        files: [],
        consultations: [],
        quotations: [],
        approval: null,
        agreement: null,
        payment: null,
        project: null,
        events: [],
      }
      return route.fulfill({ json: workflow })
    }
    const thread = serviceThreads?.find(
      (row) =>
        url.pathname === `/api/request-conversations/${row.id}` ||
        url.pathname.startsWith(`/api/request-conversations/${row.id}/`),
    )
    if (thread) {
      const archived = ["CLOSED", "CANCELLED"].includes(thread.status)
      if (
        request.method() === "DELETE" &&
        url.pathname === `/api/request-conversations/${thread.id}`
      ) {
        if (state.failDelete)
          return route.fulfill({
            status: 503,
            json: { error: "Couldn't delete this conversation. Try again." },
          })
        if (!archived)
          return route.fulfill({
            status: 409,
            json: {
              error: "Only closed or cancelled conversations can be deleted.",
            },
          })
        state.deletedConversations.add(thread.id)
        return route.fulfill({ json: { ok: true } })
      }
      if (archived && state.deletedConversations.has(thread.id))
        return route.fulfill({
          status: 404,
          json: { error: "Conversation not found" },
        })
      if (url.pathname.endsWith("/events"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: "event: connected\ndata: {}\n\n",
        })
      if (url.pathname.endsWith("/read")) {
        thread.unreadCount = 0
        return route.fulfill({
          json: {
            ok: true,
            unreadCount: state.conversations!.reduce(
              (total, row) => total + (row.unreadCount ?? 0),
              0,
            ),
            conversationUnreadCount: 0,
          },
        })
      }
      if (url.pathname === `/api/request-conversations/${thread.id}`)
        return route.fulfill({
          json: {
            archived,
            conversation: {
              department: thread.acceptedDepartment,
              head: thread.acceptedDepartment?.head,
            },
            canSend: !archived,
            messages: state.threadMessages.get(thread.id) ?? [],
            nextCursor: null,
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
  test(`client sees the latest uploaded specialist profile at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await mock(page, stateFixture(), "USER")
    let profileBio = "My latest published biography."
    const imageSizingWarnings: string[] = []
    page.on("console", (message) => {
      if (
        message.type() === "warning" &&
        message.text().includes("has either width or height modified")
      )
        imageSizingWarnings.push(message.text())
    })
    const portraitImage = await page.screenshot({
      clip: { x: 0, y: 0, width: 20, height: 60 },
    })
    const imageUrl =
      "https://profile-test.supabase.co/storage/v1/object/public/service-images/profile.png"
    await page.route("https://profile-test.supabase.co/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: portraitImage,
      }),
    )
    await page.route(
      "**/api/services/web/specialists/specialist-1",
      (route) => {
        return route.fulfill({
          json: {
            specialist: {
              id: "specialist-1",
              fullName: "Dani Updated",
              position: "Senior designer",
              department: { id: "design", name: "Design" },
              imageUrl,
              bannerUrl: imageUrl,
              bio: profileBio,
              specialties: ["Accessible design"],
              socialLinks: [
                { platform: "LinkedIn", url: "https://linkedin.com/in/dani" },
              ],
              projects: [
                {
                  id: "portfolio-1",
                  title: "Published website",
                  summary: "A responsive client website.",
                  contribution: "Design and development",
                  thumbnailUrl: imageUrl,
                  projectUrl: "https://example.com/work",
                },
              ],
            },
          },
        })
      },
    )
    await page.goto("/messages?request=booking-1", {
      waitUntil: "domcontentloaded",
    })
    const openProfile = page.getByRole("button", {
      name: /View Dani Head.s profile/,
    })
    await expect(openProfile).toBeEnabled({ timeout: 30000 })
    await expect(
      page
        .getByRole("region", { name: "Request conversation" })
        .locator("header img"),
    ).toHaveAttribute("src", imageUrl)
    await expect
      .poll(() =>
        page
          .getByRole("region", { name: "Request conversation" })
          .locator("header img")
          .evaluate((image) => {
            const bounds = image.getBoundingClientRect()
            return Math.abs(bounds.width - bounds.height)
          }),
      )
      .toBeLessThan(1)
    if (width > 767)
      await expect(
        page
          .getByRole("navigation", { name: "Conversations", exact: true })
          .locator("img")
          .first(),
      ).toHaveAttribute("src", imageUrl)
    await openProfile.click()
    const dialog = page.getByRole("dialog", {
      name: "Specialist profile",
      exact: true,
    })
    await expect(
      dialog.getByRole("heading", { name: "Dani Updated", exact: true }),
    ).toBeVisible()
    await expect(
      dialog.getByText("My latest published biography."),
    ).toBeVisible()
    await expect(
      dialog.getByText("Accessible design", { exact: true }),
    ).toBeVisible()
    await expect(
      dialog.getByRole("link", { name: /Open LinkedIn/ }),
    ).toHaveAttribute("href", "https://linkedin.com/in/dani")
    await expect(dialog.locator(`img[src="${imageUrl}"]`).first()).toBeVisible()
    await expect
      .poll(() =>
        dialog
          .locator(`img[src="${imageUrl}"]`)
          .first()
          .evaluate((image) => (image as HTMLImageElement).complete),
      )
      .toBe(true)
    expect(imageSizingWarnings).toEqual([])
    await dialog
      .getByRole("button", {
        name: "View project: Published website",
        exact: true,
      })
      .click()
    await expect(
      dialog.getByRole("heading", { name: "Published website", exact: true }),
    ).toBeVisible()
    await expect(
      dialog.getByText("Design and development", { exact: true }),
    ).toBeVisible()
    await expect(
      dialog.getByRole("img", { name: "Published website", exact: true }),
    ).toBeVisible()
    expect(imageSizingWarnings).toEqual([])
    await dialog
      .getByRole("button", { name: "Close specialist profile" })
      .click()
    await expect(dialog).not.toBeVisible()
    profileBio = "An updated biography after reopening."
    await openProfile.click()
    await expect(
      dialog.getByText("An updated biography after reopening."),
    ).toBeVisible()
    await expect
      .poll(() =>
        dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
      )
      .toBeLessThanOrEqual(0)
  })
}

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
    page.getByText("Couldn't load conversations.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Conversations" }).getByRole("alert"),
  ).toHaveCount(0)
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
  test(`${role} without client requests can open internal Messages`, async ({
    page,
  }) => {
    const state = stateFixture()
    state.conversations = []
    await mock(page, state, role, false)
    let internalReads = 0
    await page.route("**/api/internal-conversations**", (route) => {
      expect(route.request().headers().authorization).toBe(
        "Bearer conversation-session",
      )
      expect(route.request().method()).toBe("GET")
      if (new URL(route.request().url()).pathname.endsWith("/contacts"))
        return route.fulfill({ json: [] })
      internalReads++
      return route.fulfill({
        json: { conversations: [], nextCursor: null, unreadCount: 0 },
      })
    })
    await page.goto("/messages")
    await expect(page).toHaveURL(/\/messages$/)
    await expect(
      page.getByRole("link", { name: "Messages", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "No conversations yet", exact: true }),
    ).toBeVisible()
    expect(state.listReads).toBeGreaterThan(0)
    await page
      .getByRole("button", { name: "Open internal conversations", exact: true })
      .click()
    await expect(page).toHaveURL(/\/messages\?mode=internal$/)
    await expect.poll(() => internalReads).toBeGreaterThan(0)
    await expect(
      page
        .getByRole("navigation", { name: "Conversations", exact: true })
        .getByRole("link"),
    ).toHaveCount(0)
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
  await expect(
    page.getByText("Connection interrupted. Try again.", { exact: true }),
  ).toBeVisible()
  await expect(chat.getByRole("alert")).toHaveCount(0)
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

for (const width of [1440, 390]) {
  test(`staff edit and delete their message with client synchronization at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = stateFixture()
    const message: RequestMessage = {
      id: "editable-1",
      body: "Original message",
      clientMessageId: "original-id",
      editedAt: null,
      deletedAt: null,
      purgeAt: null,
      sender: { id: "head-1", fullName: "Dani Head" },
      createdAt: new Date().toISOString(),
    }
    state.messages = [message]
    await mock(page, state, "STAFF")
    let fail = true
    const mutations: string[] = []
    await page.route(
      "**/api/request-conversations/booking-1/messages/editable-1",
      (route) => {
        const method = route.request().method()
        expect(route.request().headers().authorization).toBe(
          "Bearer conversation-session",
        )
        expect(["PATCH", "DELETE"]).toContain(method)
        mutations.push(method)
        if (fail)
          return route.fulfill({
            status: 503,
            json: { error: "Message update unavailable. Try again." },
          })
        if (method === "PATCH") {
          message.body = (
            route.request().postDataJSON() as { body: string }
          ).body
          message.editedAt = new Date().toISOString()
        } else {
          message.body = null
          message.deletedAt = new Date().toISOString()
          message.purgeAt = new Date(Date.now() + 30 * 86400000).toISOString()
        }
        emit()
        return route.fulfill({ json: { message } })
      },
    )
    const client = await context.newPage()
    await client.setViewportSize({ width, height: 920 })
    await mock(client, state, "USER")
    await openMessages(client, "USER")
    await openMessages(page, "STAFF")
    const chat = page.getByRole("region", { name: "Request conversation" })
    const clientChat = client.getByRole("region", {
      name: "Request conversation",
    })
    await expect(
      clientChat.getByRole("button", { name: /Actions for your message/ }),
    ).toHaveCount(0)
    const menu = chat.getByRole("button", { name: /Actions for your message/ })
    await menu.click()
    await page
      .getByRole("menuitem", { name: "Edit message", exact: true })
      .click()
    await chat
      .getByLabel("Edit message", { exact: true })
      .fill("Corrected message")
    await chat.getByRole("button", { name: "Save", exact: true }).click()
    await expect(
      page.getByText("Message update unavailable. Try again.", { exact: true }),
    ).toBeVisible()
    await expect(chat.getByRole("alert")).toHaveCount(0)
    await expect(chat.getByLabel("Edit message", { exact: true })).toHaveValue(
      "Corrected message",
    )
    fail = false
    await chat.getByRole("button", { name: "Save", exact: true }).click()
    await expect(
      clientChat.getByText("Corrected message", { exact: true }),
    ).toBeVisible()
    await expect(chat.getByLabel("Edit message", { exact: true })).toHaveCount(
      0,
    )
    await menu.click()
    await page
      .getByRole("menuitem", { name: "Delete message", exact: true })
      .click()
    const confirmation = page.getByRole("dialog")
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click()
    expect(mutations).toEqual(["PATCH", "PATCH"])
    await menu.click()
    await page
      .getByRole("menuitem", { name: "Delete message", exact: true })
      .click()
    await confirmation
      .getByRole("button", { name: "Delete message", exact: true })
      .click()
    await expect(
      clientChat.getByText("This message was deleted", { exact: true }),
    ).toBeVisible()
    await expect(
      chat.getByText("This message was deleted", { exact: true }),
    ).toBeVisible()
    await expect(menu).toHaveCount(0)
    expect(mutations).toEqual(["PATCH", "PATCH", "DELETE"])
    expect(state.messages).toHaveLength(1)
    await client.close()
  })
}

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
  await expect(
    page.getByText("You no longer have access to this conversation.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(chat.getByRole("alert")).toHaveCount(0)
  await expect(chat.getByRole("article")).toHaveCount(0)
  await expect(chat.getByLabel("Message", { exact: true })).toHaveCount(0)
})

function groupedFixture() {
  const state = stateFixture()
  const conversation = (
    id: string,
    service: string,
    reference: string,
    unreadCount: number,
    updatedAt: string,
  ): ConversationSummary => {
    const message: RequestMessage = {
      id: `message-${id}`,
      clientMessageId: `message-${id}`,
      body: `${service} discussion for ${reference}`,
      createdAt: updatedAt,
      editedAt: null,
      deletedAt: null,
      purgeAt: null,
      sender: { id: "head-1", fullName: "Dani Head" },
    }
    state.threadMessages.set(id, [message])
    return {
      id,
      status: "UNDER_REVIEW",
      title: `${service} request`,
      referenceNumber: reference,
      updatedAt,
      service: { name: service },
      client: { id: "client-1", fullName: "Mara Client" },
      acceptedDepartment: {
        id: "design",
        name: "Design",
        head: { id: "head-1", fullName: "Dani Head" },
      },
      lastMessage: message,
      unreadCount,
    }
  }
  state.conversations = [
    conversation("website", "Website", "SR-101", 2, "2026-10-30T10:00:00Z"),
    conversation("seo", "SEO", "SR-102", 3, "2026-10-30T09:00:00Z"),
    conversation("repeat", "Website", "SR-103", 0, "2026-10-30T08:00:00Z"),
  ]
  return state
}

for (const role of ["USER", "STAFF"] as const) {
  for (const width of [1440, 390]) {
    test(`${role} groups service threads by person and keeps booking histories separate at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 920 })
      const state = groupedFixture()
      await mock(page, state, role)
      await page.goto("/messages")
      const nav = page.getByRole("navigation", {
        name: "Conversations",
        exact: true,
      })
      const name = role === "USER" ? "Dani Head" : "Mara Client"
      const group = nav.getByRole("button", {
        name: `${name}: 3 services, 5 unread messages`,
        exact: true,
      })
      await expect(group).toBeVisible()
      await expect(group).toHaveAttribute("aria-expanded", "true")
      await expect(nav.getByRole("link")).toHaveCount(3)
      await group.click()
      await expect(nav.getByRole("link")).toHaveCount(0)
      await group.click()
      await nav.getByRole("link", { name: /SEO request, SR-102:/ }).click()
      await expect(page).toHaveURL(/\/messages\?request=seo$/)
      const chat = page.getByRole("region", { name: "Request conversation" })
      await expect(chat.getByRole("article")).toHaveCount(1)
      await expect(
        chat.getByText("SEO discussion for SR-102", { exact: true }),
      ).toBeVisible()
      await expect(
        chat.getByText("Website discussion for SR-101", { exact: true }),
      ).toHaveCount(0)
      if (width === 390)
        await page.getByRole("link", { name: "All conversations" }).click()
      await expect(
        nav.getByRole("button", {
          name: `${name}: 3 services, 2 unread messages`,
          exact: true,
        }),
      ).toBeVisible()
      await nav.getByRole("link", { name: /Website request, SR-103:/ }).click()
      await expect(page).toHaveURL(/\/messages\?request=repeat$/)
      await expect(chat.getByRole("article")).toHaveCount(1)
      await expect(
        chat.getByText("Website discussion for SR-103", { exact: true }),
      ).toBeVisible()
      await expect(
        chat.getByText("SEO discussion for SR-102", { exact: true }),
      ).toHaveCount(0)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      if (width === 390)
        await page.getByRole("link", { name: "All conversations" }).click()
      await expect(nav).toBeVisible()
      await expect(page).toHaveURL(
        width === 390 ? /\/messages$/ : /\/messages\?request=repeat$/,
      )
      await page.screenshot({
        path: `test-results/grouped-conversations-${role.toLowerCase()}-${width}.png`,
        fullPage: true,
      })
    })
  }
}

test("older service threads join the existing head group and a replacement head inherits its name", async ({
  page,
}) => {
  const state = groupedFixture()
  state.moreConversations = [state.conversations!.pop()!]
  await page.clock.install()
  await mock(page, state, "USER")
  await page.goto("/messages")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await expect(
    nav.getByRole("button", { name: /^Dani Head: 2 services/ }),
  ).toBeVisible()
  await nav
    .getByRole("button", { name: "Load more conversations", exact: true })
    .click()
  await expect(
    nav.getByRole("button", { name: /^Dani Head: 3 services/ }),
  ).toHaveCount(1)
  await expect(nav.getByRole("link")).toHaveCount(3)
  await expect(
    nav.getByRole("button", { name: "Load more conversations", exact: true }),
  ).toHaveCount(0)
  for (const row of [...state.conversations!, ...state.moreConversations])
    row.acceptedDepartment!.head = { id: "replacement", fullName: "Rae Head" }
  await page.clock.fastForward(30_000)
  await expect(
    nav.getByRole("button", { name: /^Rae Head: 3 services/ }),
  ).toHaveCount(1)
  await expect(nav.getByRole("link")).toHaveCount(3)
})

test("clients keep different department heads separate and can open groups from the collapsed rail", async ({
  page,
}) => {
  const state = groupedFixture()
  state.conversations![2]!.acceptedDepartment = {
    id: "marketing",
    name: "Marketing",
    head: { id: "head-2", fullName: "Alex Head" },
  }
  await mock(page, state, "USER")
  await page.goto("/messages?request=repeat")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await expect(
    nav.getByRole("button", { name: /^Dani Head: 2 services/ }),
  ).toHaveAttribute("aria-expanded", "false")
  await expect(
    nav.getByRole("button", { name: "Alex Head: 1 service", exact: true }),
  ).toHaveAttribute("aria-expanded", "true")
  await expect(
    nav.getByRole("link", { name: /Website request, SR-103:/ }),
  ).toHaveAttribute("aria-current", "page")
  await nav
    .getByRole("button", { name: "Collapse conversations", exact: true })
    .click()
  await expect(nav.getByRole("link")).toHaveCount(0)
  await nav.getByRole("button", { name: /^Dani Head: 2 services/ }).click()
  await expect(
    nav.getByRole("button", { name: "Collapse conversations", exact: true }),
  ).toBeVisible()
  await expect(
    nav.getByRole("link", { name: /Website request, SR-101:/ }),
  ).toBeVisible()
  await expect(
    nav.getByRole("link", { name: /SEO request, SR-102:/ }),
  ).toBeVisible()
})

test("department heads keep clients with identical names in separate groups", async ({
  page,
}) => {
  const state = groupedFixture()
  state.conversations![2]!.client = { id: "client-2", fullName: "Mara Client" }
  await mock(page, state, "STAFF")
  await page.goto("/messages")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await expect(
    nav.getByRole("button", { name: /^Mara Client: 2 services/ }),
  ).toBeVisible()
  const second = nav.getByRole("button", {
    name: "Mara Client: 1 service",
    exact: true,
  })
  await expect(second).toHaveAttribute("aria-expanded", "false")
  await second.click()
  await expect(
    nav.getByRole("group", {
      name: "Service threads with Mara Client",
      exact: true,
    }),
  ).toHaveCount(2)
  await expect(
    nav.getByRole("link", { name: /Website request, SR-103:/ }),
  ).toBeVisible()
})

for (const role of ["USER", "STAFF"] as const) {
  for (const width of [1440, 390]) {
    test(`${role} can read and delete archived service threads at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 920 })
      const state = groupedFixture()
      state.conversations![1]!.status = "CLOSED"
      state.conversations![2]!.status = "CANCELLED"
      await mock(page, state, role)
      await page.goto("/messages")
      const nav = page.getByRole("navigation", {
        name: "Conversations",
        exact: true,
      })
      await expect(nav.getByRole("link")).toHaveCount(1)
      await expect(
        nav.getByRole("button", { name: /Delete .* for me/ }),
      ).toHaveCount(0)
      await nav
        .getByRole("button", { name: "Archived conversations", exact: true })
        .click()
      await expect(page).toHaveURL(/\/messages\?view=archived$/)
      await expect(nav.getByRole("link")).toHaveCount(2)
      await expect(nav.getByText("Closed", { exact: true })).toBeVisible()
      await expect(nav.getByText("Cancelled", { exact: true })).toBeVisible()
      await nav.getByRole("link", { name: /SEO request, SR-102:/ }).click()
      await expect(page).toHaveURL(/request=seo&view=archived$/)
      const chat = page.getByRole("region", { name: "Request conversation" })
      await expect(
        chat.getByText("SEO discussion for SR-102", { exact: true }),
      ).toBeVisible()
      await expect(chat.getByLabel("Message", { exact: true })).toHaveCount(0)
      if (width === 390) {
        await chat.getByRole("link", { name: "All conversations" }).click()
        await expect(page).toHaveURL(/\/messages\?view=archived$/)
        await nav.getByRole("link", { name: /SEO request, SR-102:/ }).click()
      }
      await chat
        .getByRole("button", {
          name: "Delete conversation for me",
          exact: true,
        })
        .click()
      let dialog = page.getByRole("dialog", {
        name: "Delete conversation for you?",
      })
      await expect(dialog).toContainText(
        "The booking and the other participant's history are kept.",
      )
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      expect(state.deletedConversations.size).toBe(0)
      await chat
        .getByRole("button", {
          name: "Delete conversation for me",
          exact: true,
        })
        .click()
      state.failDelete = true
      await dialog
        .getByRole("button", { name: "Delete for me", exact: true })
        .click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Couldn't delete this conversation. Try again.",
      )
      expect(state.deletedConversations.size).toBe(0)
      state.failDelete = false
      await dialog
        .getByRole("button", { name: "Delete for me", exact: true })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(page).toHaveURL(/\/messages\?view=archived$/)
      await page.reload()
      await expect(nav.getByRole("link")).toHaveCount(1)
      await expect(nav.getByRole("link", { name: /SR-102:/ })).toHaveCount(0)
      await nav
        .getByRole("button", {
          name: "Delete Website request, SR-103 for me",
          exact: true,
        })
        .click()
      dialog = page.getByRole("dialog", {
        name: "Delete conversation for you?",
      })
      await dialog
        .getByRole("button", { name: "Delete for me", exact: true })
        .click()
      await expect(
        nav.getByRole("heading", {
          name: "No archived conversations",
          exact: true,
        }),
      ).toBeVisible()
      expect(state.conversations!.length).toBe(3)
      expect(state.threadMessages.get("seo")).toHaveLength(1)
      await nav
        .getByRole("button", { name: "Active conversations", exact: true })
        .click()
      await expect(nav.getByRole("link")).toHaveCount(1)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    })
  }
}

test("a closed service deep link opens its archived conversation", async ({
  page,
}) => {
  const state = groupedFixture()
  state.conversations![1]!.status = "CLOSED"
  await mock(page, state, "USER")
  await page.goto("/messages?request=seo")
  await expect(page).toHaveURL(/request=seo&view=archived$/)
  await expect(
    page.getByRole("button", { name: "Archived conversations", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", {
      name: "Delete conversation for me",
      exact: true,
    }),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/archived-conversation.png",
    fullPage: true,
  })
})

test("refresh removes newly archived threads from all loaded inbox pages", async ({
  page,
}) => {
  const state = groupedFixture()
  state.moreConversations = [state.conversations!.pop()!]
  await page.clock.install()
  await mock(page, state, "USER")
  await page.goto("/messages")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await nav
    .getByRole("button", { name: "Load more conversations", exact: true })
    .click()
  await expect(nav.getByRole("link")).toHaveCount(3)
  state.conversations![1]!.status = "CLOSED"
  state.moreConversations[0]!.status = "CANCELLED"
  await page.clock.fastForward(30_000)
  await expect(nav.getByRole("link")).toHaveCount(1)
  await nav
    .getByRole("button", { name: "Archived conversations", exact: true })
    .click()
  await expect(nav.getByRole("link")).toHaveCount(1)
  await nav
    .getByRole("button", { name: "Load more conversations", exact: true })
    .click()
  await expect(nav.getByRole("link")).toHaveCount(2)
  await nav
    .getByRole("button", {
      name: "Delete Website request, SR-103 for me",
      exact: true,
    })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete for me", exact: true })
    .click()
  await page.clock.fastForward(30_000)
  await expect(nav.getByRole("link")).toHaveCount(1)
  await expect(nav.getByRole("link", { name: /SR-103:/ })).toHaveCount(0)
})
