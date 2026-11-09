import { createServer, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { expect, test, type Page } from "@playwright/test"
import type {
  ConversationSummary,
  RequestMessage,
  ConversationMeeting,
} from "../../src/features/request-conversations/api/request-conversations-api"
import type { Workflow } from "../../src/features/request-workflow/model/workflow"
import { defaultPreferences } from "../../src/features/settings/api/settings-api"

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
    meetings: new Map<string, ConversationMeeting[]>(),
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
    if (url.pathname === "/api/auth/settings")
      return route.fulfill({
        json: { preferences: defaultPreferences, sessions: [] },
      })
    if (url.pathname === "/api/request-conversations") {
      state.listReads++
      if (state.listError)
        return route.fulfill({
          status: 503,
          json: { error: "Couldn't load conversations." },
        })
      const isVisible = () => true
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
          unreadCount: state.conversations?.reduce(
            (total, row) => total + (row.unreadCount ?? 0),
            0,
          ),
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
                id: booking.id,
                bookings: [
                  {
                    id: booking.id,
                    title: booking.title,
                    referenceNumber: null,
                    status: booking.status,
                    packageName: booking.packageName,
                    serviceName: booking.service.name,
                    workflowState: "CONSULTATION",
                    previousWorkflowState: null,
                    createdAt: booking.createdAt,
                    updatedAt: booking.updatedAt,
                  },
                ],
                bookingCount: 1,
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
    const workflowBooking = serviceThreads
      ?.flatMap((row) => row.bookings ?? [])
      .find(
        (booking) => url.pathname === `/api/request-workflows/${booking.id}`,
      )
    const workflowThread =
      serviceThreads
        ?.flatMap(
          (row) =>
            row.bookings?.map((booking) => ({
              ...row,
              ...booking,
              service: { name: booking.serviceName },
            })) ?? [row],
        )
        .find((row) => url.pathname === `/api/request-workflows/${row.id}`) ??
      (url.pathname === "/api/request-workflows/booking-1"
        ? {
            ...booking,
            referenceNumber: null,
            client: { id: "client-1", fullName: "Mara Client" },
            acceptedDepartment: { id: "design", name: "Design" },
          }
        : null)
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
          workflowBooking?.workflowState ??
          (workflowThread.status === "CANCELLED"
            ? "CANCELLED"
            : workflowThread.status === "CLOSED"
              ? "ON_HOLD"
              : "CONSULTATION"),
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
        events: workflowBooking
          ? [
              {
                id: `event-${workflowThread.id}`,
                type: "BOOKING_ACCEPTED",
                summary: `${workflowThread.service.name} was added to this conversation.`,
                entityId: null,
                createdAt: workflowThread.updatedAt,
                actor: null,
              },
            ]
          : [],
      }
      return route.fulfill({ json: workflow })
    }
    const thread = serviceThreads?.find(
      (row) =>
        url.pathname === `/api/request-conversations/${row.id}` ||
        url.pathname.startsWith(`/api/request-conversations/${row.id}/`),
    )
    if (thread) {
      const archived = false
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
            archived: false,
            selectedBookingId: thread.bookings?.[0]?.id ?? null,
            conversation: {
              id: thread.id,
              status: "ACTIVE",
              department: thread.acceptedDepartment,
              head: thread.acceptedDepartment?.head,
              client: {
                ...thread.client,
                email: "client@example.com",
                contactNumber: null,
              },
              bookings: thread.bookings,
              bookingCount: thread.bookings?.length ?? 1,
            },
            canSend: true,
            messages: state.threadMessages.get(thread.id) ?? [],
            meetings: state.meetings.get(thread.id) ?? [],
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

test("department-head chat loads and polls each booking workflow once", async ({
  page,
}) => {
  const state = sharedFixture()
  await page.clock.install()
  await mock(page, state, "STAFF")
  const reads = new Map<string, number>()
  await page.route("**/api/request-workflows/*", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!
    if (state.conversations![0]!.bookings!.some((booking) => booking.id === id))
      reads.set(id, (reads.get(id) ?? 0) + 1)
    await route.fallback()
  })
  await page.goto("/messages?request=shared-design")
  const bookingIds = state.conversations![0]!.bookings!.map(
    (booking) => booking.id,
  )
  await expect
    .poll(() => bookingIds.map((id) => reads.get(id)))
    .toEqual([1, 1, 1])
  await expect(
    page.getByRole("complementary", { name: "Request context" }),
  ).toContainText("SR-101")
  await page.clock.fastForward(16_000)
  await expect
    .poll(() => bookingIds.map((id) => reads.get(id)))
    .toEqual([2, 2, 2])
  await expect(
    page.getByText("Couldn't load workflow", { exact: true }),
  ).toHaveCount(0)
})

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
    await page.route("**/api/request-conversations/booking-1", (route) =>
      route.fulfill({
        json: {
          archived: false,
          selectedBookingId: "booking-1",
          conversation: {
            id: "booking-1",
            status: "ACTIVE",
            department: { id: "design", name: "Design" },
            head: {
              id: "head-1",
              fullName: "Dani Head",
              specialistId: "specialist-1",
              imageUrl,
            },
            bookings: [
              {
                id: "booking-1",
                title: "Website request",
                referenceNumber: "SR-20261030-001",
                status: "UNDER_REVIEW",
                packageName: "Business Website",
                serviceName: "Website Development",
                workflowState: "CONSULTATION",
                previousWorkflowState: null,
                createdAt: "2026-10-30T08:00:00Z",
                updatedAt: "2026-10-30T08:00:00Z",
              },
            ],
            bookingCount: 1,
          },
          canSend: true,
          messages: [],
          nextCursor: null,
        },
      }),
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
    await conversations
      .getByRole("link", { name: /Dani Head, Design:/ })
      .click()
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
        .getByRole("link", { name: "Back to client chats", exact: true }),
    ).toBeVisible()
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

function sharedFixture() {
  const state = groupedFixture()
  const rows = state.conversations!
  const first = rows[0]!
  const bookings = rows.map((row, index) => ({
    id: row.id,
    title: row.title,
    referenceNumber: row.referenceNumber,
    status: "UNDER_REVIEW" as const,
    packageName: null,
    serviceName: row.service.name,
    workflowState:
      index === 1 ? ("QUOTATION_PENDING" as const) : ("CONSULTATION" as const),
    previousWorkflowState: null,
    createdAt: row.updatedAt,
    updatedAt: row.updatedAt,
  }))
  const general: RequestMessage = {
    ...first.lastMessage!,
    id: "general-message",
    clientMessageId: "general-message",
    body: "Let us discuss all our services here.",
    booking: null,
  }
  state.conversations = [
    {
      ...first,
      id: "shared-design",
      status: "ACTIVE",
      title: "3 booked services",
      referenceNumber: null,
      bookings,
      lastMessage: general,
      unreadCount: 5,
    },
  ]
  state.threadMessages.set("shared-design", [
    general,
    ...rows.map((row) => ({
      ...row.lastMessage!,
      booking: {
        id: row.id,
        title: row.title,
        referenceNumber: row.referenceNumber,
        serviceName: row.service.name,
      },
    })),
  ])
  return state
}

for (const width of [1440, 390]) {
  test(`head schedules general and multiple-service meetings independently of booking stage at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = sharedFixture()
    for (const booking of state.conversations![0]!.bookings!)
      booking.workflowState = "AGREEMENT_PAYMENT_PENDING"
    await mock(page, state, "STAFF")
    const posts: { bookingIds: string[]; clientActionId: string }[] = []
    let failAfterSave = true
    await page.route(
      "**/api/request-conversations/shared-design/meetings",
      async (route) => {
        const input = route.request().postDataJSON() as {
          startsAt: string
          endsAt: string
          location: string
          notes: string
          bookingIds: string[]
          clientActionId: string
        }
        posts.push(input)
        let meetings = state.meetings.get("shared-design") ?? []
        let meeting = meetings.find((item) => item.id === input.clientActionId)
        if (!meeting) {
          meeting = {
            ...input,
            id: input.clientActionId,
            conversationId: "shared-design",
            status: "SCHEDULED",
            version: 0,
            proposedStartsAt: null,
            rescheduleNote: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            bookings: input.bookingIds.map((id) => {
              const booking = state.conversations![0]!.bookings!.find(
                (item) => item.id === id,
              )!
              return {
                booking: {
                  id,
                  referenceNumber: booking.referenceNumber,
                  service: { name: booking.serviceName },
                },
              }
            }),
          }
          meetings = [...meetings, meeting]
          state.meetings.set("shared-design", meetings)
        }
        if (failAfterSave) {
          failAfterSave = false
          return route.fulfill({
            status: 503,
            json: { error: "Connection interrupted. Try again." },
          })
        }
        return route.fulfill({ status: 201, json: { meeting } })
      },
    )
    await page.goto("/messages?request=shared-design")
    const chat = page.getByRole("region", { name: "Request conversation" })
    await chat
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Keep this general message draft")
    const tomorrow = new Date(Date.now() + 86_400_000)
    const startsAt = new Date(
      tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16)
    for (const scope of ["general", "multiple"]) {
      await chat
        .getByRole("button", { name: "Open request actions", exact: true })
        .click()
      await page
        .getByRole("menuitem", {
          name: "Schedule consultation/meeting",
          exact: true,
        })
        .click()
      const sheet = chat.getByRole("region", {
        name: "Schedule consultation/meeting",
        exact: true,
      })
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(sheet).toBeVisible()
      const sheetBox = await sheet.boundingBox()
      const composerBox = await chat
        .getByRole("form", { name: "Send a message" })
        .boundingBox()
      expect(sheetBox).not.toBeNull()
      expect(composerBox).not.toBeNull()
      expect(sheetBox!.height).toBeLessThanOrEqual(400)
      expect(composerBox!.y - sheetBox!.y - sheetBox!.height).toBeCloseTo(8, 0)
      await chat
        .getByRole("textbox", { name: "Message", exact: true })
        .fill("Keep this general message draft")
      await expect(sheet).toContainText("Selecting services is optional.")
      await expect(sheet.getByRole("radio")).toHaveCount(0)
      await expect(sheet.locator("input:checked")).toHaveCount(0)
      await expect(sheet).toContainText("General meeting · No specific service")
      await sheet
        .getByLabel("Meeting topic", { exact: true })
        .fill(
          scope === "general" ? "General catch-up" : "Website and SEO review",
        )
      await sheet.getByLabel("Date and time", { exact: true }).fill(startsAt)
      await sheet
        .getByLabel("Meeting link or location", { exact: true })
        .fill("https://meet.example.com/shared")
      if (scope === "multiple") {
        await sheet
          .getByRole("checkbox", { name: "Website SR-101", exact: true })
          .check()
        await sheet
          .getByRole("checkbox", { name: "SEO SR-102", exact: true })
          .check()
        await expect(sheet).toContainText("2 related services")
      }
      if (scope === "general") {
        await sheet
          .getByRole("button", { name: "Send invitation", exact: true })
          .click()
        await expect(sheet.getByRole("alert")).toHaveText(
          "Connection interrupted. Try again.",
        )
      } else {
        await page.screenshot({
          path: `test-results/meeting-schedule-${width}.png`,
          fullPage: true,
        })
      }
      await sheet
        .getByRole("button", { name: "Send invitation", exact: true })
        .click()
      await expect(sheet).toHaveCount(0)
      await expect(
        chat.getByRole("textbox", { name: "Message", exact: true }),
      ).toHaveValue("Keep this general message draft")
    }
    expect(posts.map((input) => input.bookingIds)).toEqual([
      [],
      [],
      ["seo", "website"],
    ])
    expect(posts[0]!.clientActionId).toBe(posts[1]!.clientActionId)
    expect(state.meetings.get("shared-design")).toHaveLength(2)
    await page.reload()
    const log = chat.getByRole("log", { name: "Conversation messages" })
    await expect(
      log.getByRole("heading", { name: "Consultation/meeting", exact: true }),
    ).toHaveCount(2)
    await expect(
      log.getByText("General catch-up", { exact: true }),
    ).toBeVisible()
    await expect(
      log.getByText("Website and SEO review", { exact: true }),
    ).toBeVisible()
    await expect(
      log.getByRole("link", { name: "Join meeting", exact: true }),
    ).toHaveCount(2)
    await expect(log.getByLabel("Related services")).toContainText(
      "Website · SR-101",
    )
    await expect(log.getByLabel("Related services")).toContainText(
      "SEO · SR-102",
    )
    await expect(page).toHaveURL(/request=shared-design$/)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })

  test(`client requests a reschedule for a general conversation meeting at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = sharedFixture()
    const startsAt = new Date(Date.now() + 86_400_000).toISOString()
    const meeting: ConversationMeeting = {
      id: "general-meeting",
      conversationId: "shared-design",
      startsAt,
      endsAt: new Date(Date.now() + 88_200_000).toISOString(),
      location: "Office",
      notes: "General catch-up",
      status: "SCHEDULED",
      version: 0,
      proposedStartsAt: null,
      rescheduleNote: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bookings: [],
    }
    state.meetings.set("shared-design", [meeting])
    await mock(page, state, "USER")
    await page.route(
      "**/api/request-conversations/shared-design/meetings/general-meeting",
      async (route) => {
        const action = route.request().postDataJSON() as {
          type: string
          startsAt: string
          note: string
          expectedVersion: number
        }
        expect(action.type).toBe("REQUEST_RESCHEDULE")
        expect(action.expectedVersion).toBe(0)
        meeting.proposedStartsAt = action.startsAt
        meeting.rescheduleNote = action.note
        meeting.version++
        return route.fulfill({ json: { meeting } })
      },
    )
    await page.goto("/messages?request=shared-design")
    const log = page.getByRole("log", { name: "Conversation messages" })
    await log
      .getByRole("button", { name: "Request reschedule", exact: true })
      .click()
    const later = new Date(Date.now() + 2 * 86_400_000)
    await log
      .getByLabel("Requested date and time", { exact: true })
      .fill(
        new Date(later.getTime() - later.getTimezoneOffset() * 60_000)
          .toISOString()
          .slice(0, 16),
      )
    await log
      .getByLabel("Reason for rescheduling", { exact: true })
      .fill("Please move our general catch-up")
    await log
      .getByRole("button", { name: "Send reschedule request", exact: true })
      .click()
    await expect(log).toContainText(
      "The existing schedule remains until the department head confirms a change.",
    )
    await expect(
      log.getByRole("button", { name: "Request reschedule", exact: true }),
    ).toBeDisabled()
    await expect(
      log.getByRole("button", { name: "Cancel meeting", exact: true }),
    ).toHaveCount(0)
    expect(meeting.startsAt).toBe(startsAt)
  })
}

for (const role of ["USER", "STAFF"] as const) {
  for (const width of [1440, 390]) {
    test(`${role} keeps one shared conversation while viewing booking details at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 920 })
      const state = sharedFixture()
      const imageUrl =
        "https://profile-test.supabase.co/storage/v1/object/public/service-images/profile.png"
      state.conversations![0]!.acceptedDepartment!.head!.imageUrl = imageUrl
      state.conversations![0]!.client.imageUrl = imageUrl
      await page.route("https://profile-test.supabase.co/**", (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" />',
        }),
      )
      await mock(page, state, role)
      await page.goto("/messages")
      const nav = page.getByRole("navigation", {
        name: "Conversations",
        exact: true,
      })
      await expect(nav.getByRole("link")).toHaveCount(1)
      await nav.getByRole("link").click()
      const chat = page.getByRole("region", { name: "Request conversation" })
      const log = chat.getByRole("log", { name: "Conversation messages" })
      await expect(log.getByRole("article")).toHaveCount(4)
      await chat
        .getByLabel("Message", { exact: true })
        .fill("A shared draft for the department")
      const panel = page.getByRole("complementary", { name: "Request context" })
      await expect(panel.locator("img").first()).toHaveAttribute(
        "src",
        imageUrl,
      )
      if (width === 390)
        await panel
          .getByText("Request details and actions", { exact: true })
          .click()
      const reads: string[] = []
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname ===
          "/api/request-conversations/shared-design"
        )
          reads.push(request.url())
      })
      let releaseWorkflow = () => {}
      const workflowGate = new Promise<void>((resolve) => {
        releaseWorkflow = resolve
      })
      await page.route("**/api/request-workflows/seo", async (route) => {
        await workflowGate
        await route.fallback()
      })
      const panelElement = await panel.elementHandle()
      const detailsElement = await panel
        .locator("details")
        .first()
        .elementHandle()
      const serviceDetailsElement = await panel
        .getByText("Service details", { exact: true })
        .locator("..")
        .elementHandle()
      await panel.getByRole("button", { name: /SEO SR-102/ }).click()
      await expect(panel.getByRole("status")).toHaveText(
        "Loading service details…",
      )
      expect(
        await panelElement!.evaluate((element) => element.isConnected),
      ).toBe(true)
      expect(
        await detailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
      expect(
        await serviceDetailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
      await expect(
        panel.getByRole("button", { name: /SEO SR-102/ }),
      ).toHaveAttribute("aria-pressed", "true")
      releaseWorkflow()
      await expect(
        panel.getByText("Requirements for SR-102", { exact: true }),
      ).toBeVisible()
      expect(
        await panelElement!.evaluate((element) => element.isConnected),
      ).toBe(true)
      expect(
        await detailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
      expect(
        await serviceDetailsElement!.evaluate(
          (element) => element instanceof HTMLDetailsElement && element.open,
        ),
      ).toBe(true)
      await expect(log.getByRole("article")).toHaveCount(4)
      for (const text of [
        "Let us discuss all our services here.",
        "Website discussion for SR-101",
        "SEO discussion for SR-102",
        "Website discussion for SR-103",
      ])
        await expect(log.getByText(text, { exact: true })).toBeVisible()
      await expect(chat.getByLabel("Message", { exact: true })).toHaveValue(
        "A shared draft for the department",
      )
      await expect(
        chat.getByLabel("Message context", { exact: true }),
      ).toHaveCount(0)
      expect(reads).toEqual([])
      const sends: Record<string, unknown>[] = []
      await page.route(
        "**/api/request-conversations/shared-design/messages",
        (route) => {
          const input = route.request().postDataJSON() as {
            body: string
            clientMessageId: string
          }
          sends.push(input)
          return route.fulfill({
            status: 201,
            json: {
              message: {
                ...state.threadMessages.get("shared-design")![0]!,
                id: "new-general-message",
                body: input.body,
                clientMessageId: input.clientMessageId,
                createdAt: new Date().toISOString(),
                booking: null,
              },
            },
          })
        },
      )
      await chat
        .getByRole("button", { name: "Send message", exact: true })
        .click()
      await expect(
        log.getByText("A shared draft for the department", { exact: true }),
      ).toBeVisible()
      expect(sends).toHaveLength(1)
      expect(sends[0]).not.toHaveProperty("bookingId")
      await expect(page).toHaveURL(/request=shared-design$/)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    })
  }
}

for (const width of [1440, 390]) {
  test(`department head chooses a tool before its booking at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = sharedFixture()
    state.conversations![0]!.bookings![2]!.status = "CANCELLED"
    state.conversations![0]!.bookings![2]!.workflowState = "CANCELLED"
    state.conversations![0]!.bookings!.push({
      ...state.conversations![0]!.bookings![0]!,
      id: "agreement-booking",
      referenceNumber: "SR-104",
      workflowState: "AGREEMENT_PAYMENT_PENDING",
    })
    await mock(page, state, "STAFF")
    let failWorkflow = true
    await page.route("**/api/request-workflows/website", (route) =>
      failWorkflow
        ? route.fulfill({
            status: 503,
            json: { error: "Booking tools temporarily unavailable" },
          })
        : route.fallback(),
    )
    await page.goto("/messages?request=shared-design")
    const chat = page.getByRole("region", { name: "Request conversation" })
    const tools = chat.getByRole("button", {
      name: "Open request actions",
      exact: true,
    })
    await tools.click()
    const menu = page.getByRole("menu")
    await expect(menu.getByRole("radio")).toHaveCount(0)
    for (const name of [
      "Attach file",
      "Request information",
      "Schedule consultation/meeting",
      "Create quotation",
    ])
      await expect(
        menu.getByRole("menuitem", { name, exact: true }),
      ).toBeEnabled()
    await expect(menu.getByRole("menuitem")).toHaveCount(4)
    for (const name of [
      "Payment and commencement",
      "Approver assignments",
      "Internal notes",
      "Staffing and workload",
      "Workflow controls",
      "Project activation",
    ])
      await expect(
        menu.getByRole("menuitem", { name, exact: true }),
      ).toHaveCount(0)
    await menu
      .getByRole("menuitem", { name: "Create quotation", exact: true })
      .click()
    let context = page.getByRole("dialog", {
      name: "Create quotation: choose a booking",
    })
    const proceed = context.getByRole("button", {
      name: "Continue",
      exact: true,
    })
    await expect(proceed).toBeDisabled()
    await expect(context.locator("input:checked")).toHaveCount(0)
    await expect(context.getByRole("radio")).toHaveCount(1)
    await expect(context).toContainText("Some services could not be checked.")
    failWorkflow = false
    await context
      .getByRole("button", { name: "Retry booking options", exact: true })
      .click()
    await expect(context.getByRole("radio")).toHaveCount(2)
    await context
      .getByRole("radio", { name: "Website SR-101", exact: true })
      .check()
    await expect(context).toContainText("Couldn't load tools for this booking.")
    await context
      .getByRole("button", { name: "Retry booking tools", exact: true })
      .click()
    await expect(proceed).toBeEnabled()
    await page.screenshot({
      path: `test-results/tool-booking-picker-${width}.png`,
      fullPage: true,
    })
    await proceed.click()
    const consultation = chat.getByRole("region", {
      name: "Prepare quotation",
      exact: true,
    })
    await expect(consultation).toContainText("Website · SR-101")
    await consultation
      .getByRole("button", {
        name: "Close prepare quotation draft",
        exact: true,
      })
      .click()
    await tools.click()
    await menu
      .getByRole("menuitem", { name: "Create quotation", exact: true })
      .click()
    context = page.getByRole("dialog", {
      name: "Create quotation: choose a booking",
    })
    await expect(context.locator("input:checked")).toHaveCount(0)
    await expect(
      context.getByRole("radio", { name: "Website SR-103", exact: true }),
    ).toHaveCount(0)
    await expect(
      context.getByRole("radio", { name: "Website SR-104", exact: true }),
    ).toHaveCount(0)
    await expect(context.getByRole("radio")).toHaveCount(2)
    await expect(
      context.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled()
    await context
      .getByRole("radio", { name: "SEO SR-102", exact: true })
      .check()
    await context.getByRole("button", { name: "Continue", exact: true }).click()
    await expect(
      chat.getByRole("region", { name: "Prepare quotation", exact: true }),
    ).toContainText("SEO · SR-102")
    await expect(chat.getByRole("log").getByRole("article")).toHaveCount(4)
    await expect(page).toHaveURL(/request=shared-design$/)
    await expect(
      chat.getByLabel("Message context", { exact: true }),
    ).toHaveCount(0)
  })
}
for (const width of [1440, 390]) {
  test(`quotation options refresh eligibility and show an empty state at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = sharedFixture()
    await mock(page, state, "STAFF")
    await page.goto("/messages?request=shared-design")
    const tools = page.getByRole("button", {
      name: "Open request actions",
      exact: true,
    })
    await tools.click()
    await page
      .getByRole("menuitem", { name: "Create quotation", exact: true })
      .click()
    const context = page.getByRole("dialog", {
      name: "Create quotation: choose a booking",
    })
    await expect(context.getByRole("radio")).toHaveCount(3)
    await context.getByRole("button", { name: "Cancel", exact: true }).click()
    for (const booking of state.conversations![0]!.bookings!)
      booking.workflowState = "AGREEMENT_PAYMENT_PENDING"
    await tools.click()
    await expect(
      page.getByRole("menuitem", { name: "Create quotation", exact: true }),
    ).toBeEnabled()
    await page
      .getByRole("menuitem", { name: "Create quotation", exact: true })
      .click()
    await expect(context).toContainText("No eligible services for this action.")
    await expect(context.getByRole("radio")).toHaveCount(0)
    await expect(
      context.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled()
    await context.getByRole("button", { name: "Cancel", exact: true }).click()
    await page.reload()
    await tools.click()
    await expect(
      page.getByRole("menuitem", { name: "Create quotation", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("menuitem", { name: "Project activation", exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole("menuitem")).toHaveCount(3)
    await expect(page).toHaveURL(/request=shared-design$/)
  })
}

for (const width of [1440, 390]) {
  test(`shared timeline keeps booking cards usable without selecting them at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 920 })
    const state = sharedFixture()
    await mock(page, state, "STAFF")
    const seo: Workflow = {
      request: {
        id: "seo",
        referenceNumber: "SR-102",
        title: "SEO request",
        serviceName: "SEO",
        packageName: null,
        pricingModel: "CUSTOM_QUOTE",
        goals: "Reach customers",
        requirements: "SEO requirements",
        expectedTimeline: "Six weeks",
        client: { id: "client-1", fullName: "Mara Client" },
        department: { id: "design", name: "Design" },
      },
      state: "AGREEMENT_PAYMENT_PENDING",
      previousState: null,
      version: 1,
      nextAction: "Verify payment",
      consultationRequired: false,
      quotationApprovalRequired: false,
      permissions: {
        manage: true,
        isClient: false,
        approveQuotation: false,
        verifyPayment: false,
      },
      requirements: [],
      consultations: [],
      quotations: [],
      approval: {
        quotationId: "seo-quote",
        amount: "1500.00",
        currency: "PHP",
        approvedById: "client-1",
        approvedAt: "2026-10-30T09:00:00Z",
      },
      internal: {
        staff: [],
        approvers: [],
        quotationApproverId: null,
        paymentVerifierId: null,
        events: [],
      },
      agreement: null,
      project: null,
      files: [
        {
          id: "seo-file",
          name: "seo-payment-receipt.pdf",
          mimeType: "application/pdf",
          size: 2048,
          uploaderId: "client-1",
          createdAt: "2026-10-30T10:10:00Z",
        },
      ],
      payment: {
        id: "seo-payment",
        mandatory: true,
        amount: "1500.00",
        currency: "PHP",
        status: "SUBMITTED",
        proofFileId: null,
        reference: "BANK-SEO",
      },
      events: [
        {
          id: "seo-file-event",
          type: "FILE_SUBMITTED",
          summary: "File submitted: seo-payment-receipt.pdf",
          entityId: "seo-file",
          createdAt: "2026-10-30T10:10:00Z",
          actor: null,
        },
        {
          id: "seo-payment-event",
          type: "PAYMENT_SUBMITTED",
          summary: "Payment evidence was submitted for manual verification.",
          entityId: "seo-payment",
          createdAt: "2026-10-30T10:15:00Z",
          actor: null,
        },
      ],
    }
    await page.route("**/api/request-workflows/seo", (route) =>
      route.fulfill({ json: seo }),
    )
    const actions: Record<string, unknown>[] = []
    await page.route("**/api/request-workflows/*/actions", (route) => {
      expect(new URL(route.request().url()).pathname).toBe(
        "/api/request-workflows/seo/actions",
      )
      actions.push(route.request().postDataJSON() as Record<string, unknown>)
      seo.version++
      seo.payment!.status = "VERIFIED"
      seo.state = "READY_FOR_ACTIVATION"
      return route.fulfill({ json: seo })
    })
    await page.goto("/messages?request=shared-design")
    const chat = page.getByRole("region", { name: "Request conversation" })
    const log = chat.getByRole("log", { name: "Conversation messages" })
    await expect(log.getByRole("article")).toHaveCount(4)
    await expect(
      log.getByRole("button", { name: "View booking", exact: true }),
    ).toHaveCount(0)
    await expect(
      log.getByRole("article").getByRole("button", { name: /SR-10/ }),
    ).toHaveCount(0)
    await expect(
      log.getByRole("button", {
        name: "Download seo-payment-receipt.pdf",
        exact: true,
      }),
    ).toBeVisible()
    await expect(log.getByText("10/30/2026", { exact: true })).toHaveCount(1)
    await chat
      .getByLabel("Message", { exact: true })
      .fill("A shared reply stays here")
    await log
      .getByRole("button", { name: "Confirm payment", exact: true })
      .click()
    await expect.poll(() => actions.length).toBe(1)
    expect(actions[0]).toMatchObject({ type: "VERIFY_PAYMENT", approve: true })
    await expect(
      log.getByRole("button", { name: "Confirm payment", exact: true }),
    ).toHaveCount(0)
    const panel = page.getByRole("complementary", { name: "Request context" })
    await expect(panel.locator('button[aria-pressed="true"]')).toContainText(
      "SR-101",
    )
    const before = await log
      .locator('[data-booking-event="seo"]')
      .allTextContents()
    await chat
      .getByRole("button", { name: "Open request actions", exact: true })
      .click()
    const activation = page.getByRole("menuitem", {
      name: "Project activation",
      exact: true,
    })
    await expect(page.getByRole("menuitem").last()).toHaveText(
      "Project activation",
    )
    await activation.click()
    const picker = page.getByRole("dialog", {
      name: "Project activation: choose a booking",
      exact: true,
    })
    await picker.getByRole("radio", { name: "SEO SR-102", exact: true }).check()
    await picker.getByRole("button", { name: "Continue", exact: true }).click()
    const setup = page.getByRole("dialog", {
      name: "Activate project",
      exact: true,
    })
    await expect(setup).toContainText("SR-102")
    await expect(setup).toContainText(
      "No employees are assigned to this department.",
    )
    await expect(
      setup.getByRole("button", { name: "Approve staffing", exact: true }),
    ).toBeDisabled()
    await setup.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(panel.locator('button[aria-pressed="true"]')).toContainText(
      "SR-102",
    )
    expect(
      await log.locator('[data-booking-event="seo"]').allTextContents(),
    ).toEqual(before)
    await expect(chat.getByLabel("Message", { exact: true })).toHaveValue(
      "A shared reply stays here",
    )
    await expect(page).toHaveURL(/request=shared-design$/)
    await page.screenshot({
      path: `test-results/shared-timeline-${width}.png`,
      fullPage: true,
    })
  })
}

test("pagination and head handoff retain direct conversation entries", async ({
  page,
}) => {
  const state = sharedFixture()
  const original = state.conversations![0]!
  state.moreConversations = [
    {
      ...original,
      id: "shared-marketing",
      acceptedDepartment: {
        id: "marketing",
        name: "Marketing",
        head: { id: "marketing-head", fullName: "Alex Head" },
      },
    },
  ]
  await page.clock.install()
  await mock(page, state, "USER")
  await page.goto("/messages")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await expect(nav.getByRole("link")).toHaveCount(1)
  await nav
    .getByRole("button", { name: "Load more conversations", exact: true })
    .click()
  await expect(nav.getByRole("link")).toHaveCount(2)
  original.acceptedDepartment!.head = {
    id: "replacement",
    fullName: "Rae Head",
  }
  await page.clock.fastForward(30_000)
  await expect(
    nav.getByRole("link", { name: /^Rae Head, Design: 3 bookings/ }),
  ).toHaveAttribute("href", "/messages?request=shared-design")
  await expect(nav.getByRole("link")).toHaveCount(2)
})

test("collapsed rail opens department conversations directly", async ({
  page,
}) => {
  const state = sharedFixture()
  state.conversations!.push({
    ...state.conversations![0]!,
    id: "marketing",
    acceptedDepartment: {
      id: "marketing",
      name: "Marketing",
      head: { id: "head-2", fullName: "Alex Head" },
    },
  })
  await mock(page, state, "USER")
  await page.goto("/messages?request=marketing")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await nav
    .getByRole("button", { name: "Collapse conversations", exact: true })
    .click()
  await expect(nav.getByRole("link")).toHaveCount(2)
  await nav.getByRole("link", { name: /^Dani Head, Design:/ }).click()
  await expect(page).toHaveURL(/request=shared-design$/)
  await expect(page.getByLabel("Message", { exact: true })).toBeEnabled()
})

test("department heads keep clients with identical names in separate conversations", async ({
  page,
}) => {
  const state = sharedFixture()
  state.conversations!.push({
    ...state.conversations![0]!,
    id: "other-client",
    client: { id: "client-2", fullName: "Mara Client" },
    bookings: [],
  })
  await mock(page, state, "STAFF")
  await page.goto("/messages")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  const clients = nav.getByRole("link", { name: /^Mara Client, Design:/ })
  await expect(clients).toHaveCount(2)
  await clients.filter({ hasText: "0 bookings" }).click()
  await expect(page).toHaveURL(/request=other-client$/)
  await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
    "href",
    "/messages?request=other-client",
  )
})
/* Legacy archive UI tests were removed because conversations remain available after booking completion or cancellation.
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
      await nav.locator('a[href*="request=seo"]').click()
      await expect(page).toHaveURL(/request=seo&view=archived$/)
      const chat = page.getByRole("region", { name: "Request conversation" })
      await expect(
        chat.getByText("SEO discussion for SR-102", { exact: true }),
      ).toBeVisible()
      await expect(chat.getByLabel("Message", { exact: true })).toHaveCount(0)
      if (width === 390) {
        await chat.getByRole("link", { name: "All conversations" }).click()
        await expect(page).toHaveURL(/\/messages\?view=archived$/)
        await nav.locator('a[href*="request=seo"]').click()
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
      await expect(nav.locator('a[href*="request=seo"]')).toHaveCount(0)
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
  await expect(nav.locator('a[href*="request=repeat"]')).toHaveCount(0)
})
*/

for (const role of ["USER", "STAFF"] as const) {
  for (const width of [1440, 390]) {
    for (const scenario of ["none", "ended"] as const) {
      test(`${role} retains chat details with ${scenario} current bookings at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.clock.install()
        const state = sharedFixture()
        const bookings = state.conversations![0]!.bookings!
        for (const [index, booking] of bookings.entries())
          booking.status = index % 2 ? "CANCELLED" : "CLOSED"
        if (scenario === "none") state.conversations![0]!.bookings = []
        await mock(page, state, role)
        const workflowReads: string[] = []
        await page.route("**/api/request-workflows/*", async (route) => {
          const id = new URL(route.request().url()).pathname.split("/").at(-1)!
          if (bookings.some((booking) => booking.id === id))
            workflowReads.push(id)
          await route.fallback()
        })
        await page.goto("/messages?request=shared-design")
        const chat = page.getByRole("region", { name: "Request conversation" })
        const panel = page.getByRole("complementary", {
          name: "Request context",
        })
        await expect(panel).toBeVisible()
        if (width === 390)
          await panel
            .getByText("Request details and actions", { exact: true })
            .click()
        await expect(
          panel.getByRole("heading", {
            name: "Conversation details",
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          panel.getByText("No current booked services.", { exact: true }),
        ).toBeVisible()
        await expect(
          panel.getByText("Service details", { exact: true }),
        ).toHaveCount(0)
        await expect(
          panel.getByText("Loading service details…", { exact: true }),
        ).toHaveCount(0)
        await expect(
          chat.getByText("Let us discuss all our services here.", {
            exact: true,
          }),
        ).toBeVisible()
        expect(workflowReads).toEqual([])
        await chat
          .getByRole("textbox", { name: "Message", exact: true })
          .fill("Our conversation stays available.")
        state.conversations![0]!.bookings = bookings
        bookings[0]!.status = "UNDER_REVIEW"
        await page.clock.fastForward(16_000)
        await expect(
          panel.getByRole("button", { name: /SR-101/ }),
        ).toBeVisible()
        await expect(
          panel.getByText("Service details", { exact: true }),
        ).toBeVisible()
        bookings[0]!.status = "CLOSED"
        await page.clock.fastForward(16_000)
        await expect(
          panel.getByText("No current booked services.", { exact: true }),
        ).toBeVisible()
        await expect(
          panel.getByRole("heading", {
            name: "Conversation details",
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          panel.getByText("Service details", { exact: true }),
        ).toHaveCount(0)
        await expect(
          chat.getByRole("textbox", { name: "Message", exact: true }),
        ).toHaveValue("Our conversation stays available.")
      })
    }
  }

  test(`${role} keeps ended bookings in the shared conversation but hides them from context`, async ({
    page,
  }) => {
    const state = sharedFixture()
    state.conversations![0]!.bookings![0]!.status = "CLOSED"
    state.conversations![0]!.bookings![1]!.status = "CANCELLED"
    await mock(page, state, role)
    await page.goto("/messages?request=shared-design")
    const chat = page.getByRole("region", { name: "Request conversation" })
    await expect(
      chat.getByText("Website discussion for SR-101", { exact: true }),
    ).toBeVisible()
    const panel = page.getByRole("complementary", { name: "Request context" })
    await expect(panel.getByRole("button", { name: /SR-101/ })).toHaveCount(0)
    await expect(panel.getByRole("button", { name: /SR-102/ })).toHaveCount(0)
    await expect(panel.getByRole("button", { name: /SR-103/ })).toBeVisible()
    await expect(
      chat.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Archived conversations", exact: true }),
    ).toHaveCount(0)
  })
}

for (const width of [1440, 390]) {
  for (const role of ["STAFF", "USER"] as const) {
    test(
      role + " only sees relevant tools for active projects at " + width + "px",
      async ({ page }) => {
        await page.setViewportSize({ width, height: 920 })
        const state = sharedFixture()
        for (const booking of state.conversations![0]!.bookings!)
          booking.workflowState = "ACTIVE_PROJECT"
        await mock(page, state, role)
        await page.goto("/messages?request=shared-design")
        await page
          .getByRole("button", {
            name:
              role === "STAFF"
                ? "Open request actions"
                : "Open attachment options",
            exact: true,
          })
          .click()
        const menu = page.getByRole("menu")
        await expect(
          menu.getByRole("menuitem", { name: "Attach file", exact: true }),
        ).toBeVisible()
        await expect(menu.getByRole("menuitem")).toHaveCount(
          role === "STAFF" ? 2 : 1,
        )
        if (role === "STAFF")
          await expect(
            menu.getByRole("menuitem", {
              name: "Schedule consultation/meeting",
              exact: true,
            }),
          ).toBeVisible()
        for (const name of [
          "Request information",
          "Create quotation",
          "Project activation",
          "Payment and commencement",
          "Approver assignments",
          "Internal notes",
          "Staffing and workload",
          "Workflow controls",
        ])
          await expect(
            menu.getByRole("menuitem", { name, exact: true }),
          ).toHaveCount(0)
      },
    )
  }
}
