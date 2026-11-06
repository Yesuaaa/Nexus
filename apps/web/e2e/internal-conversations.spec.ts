import { expect, test, type Page } from "@playwright/test"
import type { InternalParticipant } from "../src/features/request-conversations/api/internal-conversations-api"
import type { RequestMessage } from "../src/features/request-conversations/api/request-conversations-api"
import { configureRegressionTest, restoreSession } from "./regression-support"
import { defaultPreferences } from "../src/features/settings/api/settings-api"

configureRegressionTest()

async function internalChat(
  page: Page,
  role: "STAFF" | "ADMIN" | "SUPERADMIN",
) {
  await restoreSession(page, role, { account: { id: "sender-1" } })
  await page.route("**/api/auth/settings", (route) =>
    route.fulfill({ json: { preferences: defaultPreferences, sessions: [] } }),
  )
  const participant: InternalParticipant = {
    id: "recipient-1",
    fullName: "Dani Colleague",
    email: "dani@example.com",
    role: "STAFF",
    position: "Designer",
    isActive: true,
    accountDeletedAt: null,
    department: { id: "design", name: "Design" },
  }
  const state = {
    created: false,
    canSend: true,
    failAfterSave: false,
    failCreate: false,
    creates: [] as string[],
    sends: [] as { body: string; clientMessageId: string }[],
    messages: [] as RequestMessage[],
    unread: 0,
    reads: 0,
  }
  const history = () => ({
    conversation: participant,
    canSend: state.canSend,
    messages: state.messages,
    nextCursor: null,
  })
  await page.route("**/api/internal-conversations**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    expect(request.headers().authorization).toBe("Bearer test-session")
    if (path === "/api/internal-conversations/contacts") {
      expect(request.method()).toBe("GET")
      return route.fulfill({ json: [participant] })
    }
    if (path === "/api/internal-conversations" && request.method() === "GET")
      return route.fulfill({
        json: {
          conversations: state.created
            ? [
                {
                  id: "chat-1",
                  participant,
                  updatedAt: "2026-11-02T08:00:00Z",
                  lastMessage: state.messages.at(-1) ?? null,
                  unreadCount: state.unread,
                },
              ]
            : [],
          nextCursor: null,
          unreadCount: state.unread,
        },
      })
    if (path === "/api/internal-conversations" && request.method() === "POST") {
      const body = request.postDataJSON() as { recipientId: string }
      expect(body).toEqual({ recipientId: participant.id })
      state.creates.push(body.recipientId)
      if (state.failCreate)
        return route.fulfill({
          status: 503,
          json: { error: "Chat unavailable. Try again." },
        })
      state.created = true
      return route.fulfill({
        status: 201,
        json: { id: "chat-1", ...history() },
      })
    }
    if (
      path === "/api/internal-conversations/chat-1" &&
      request.method() === "GET"
    )
      return route.fulfill({ json: history() })
    if (path === "/api/internal-conversations/chat-1/read") {
      expect(request.method()).toBe("PATCH")
      state.reads++
      state.unread = 0
      return route.fulfill({
        json: { ok: true, unreadCount: 0, conversationUnreadCount: 0 },
      })
    }
    if (path === "/api/internal-conversations/chat-1/messages") {
      expect(request.method()).toBe("POST")
      const body = request.postDataJSON() as {
        body: string
        clientMessageId: string
      }
      expect(Object.keys(body).sort()).toEqual(["body", "clientMessageId"])
      state.sends.push(body)
      let message = state.messages.find(
        (item) => item.clientMessageId === body.clientMessageId,
      )
      if (!message) {
        message = {
          id: `message-${state.messages.length + 1}`,
          ...body,
          sender: { id: "sender-1", fullName: "Sender" },
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
          purgeAt: null,
        }
        state.messages.push(message)
      }
      if (state.failAfterSave) {
        state.failAfterSave = false
        return route.fulfill({
          status: 503,
          json: { error: "Connection interrupted. Retry your message." },
        })
      }
      return route.fulfill({ status: 201, json: { message } })
    }
    throw new Error(
      `Unexpected internal chat request: ${request.method()} ${path}`,
    )
  })
  await page.route("**/api/request-conversations", (route) =>
    route.fulfill({
      json: { conversations: [], nextCursor: null, unreadCount: 0 },
    }),
  )
  return state
}

for (const role of ["STAFF", "ADMIN", "SUPERADMIN"] as const) {
  for (const width of [1440, 390]) {
    test(`${role} starts an internal chat and retries a saved message at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      const state = await internalChat(page, role)
      await page.goto("/messages?mode=internal")
      await page
        .getByRole("button", { name: "Dani Colleague Designer", exact: true })
        .click()
      await expect(page).toHaveURL(/\/messages\?mode=internal&internal=chat-1$/)
      const chat = page.getByRole("region", { name: "Internal conversation" })
      const input = chat.getByRole("textbox", {
        name: "Message Dani Colleague",
        exact: true,
      })
      const send = chat.getByRole("button", {
        name: "Send message",
        exact: true,
      })
      await expect(send).toBeDisabled()
      await input.fill("   ")
      await expect(send).toBeDisabled()
      await expect(input).toHaveAttribute("maxlength", "4000")
      const body = "Hello Dani\n<script>alert('plain text')</script>"
      await input.fill(body)
      state.failAfterSave = true
      await send.click()
      await expect(
        page.getByText("Connection interrupted. Retry your message.", {
          exact: true,
        }),
      ).toBeVisible()
      await expect(chat.getByRole("alert")).toHaveCount(0)
      await expect(input).toHaveValue(body)
      await send.click()
      await expect(input).toHaveValue("")
      await expect(chat.getByRole("article")).toHaveCount(1)
      await expect(chat.getByRole("article")).toContainText(body)
      await expect(chat.getByRole("article").locator("script")).toHaveCount(0)
      expect(state.sends).toHaveLength(2)
      expect(state.sends[1]).toEqual(state.sends[0])
      expect(state.sends[0].clientMessageId).toMatch(/^[0-9a-f-]{36}$/)
      expect(state.messages).toHaveLength(1)
      await page.reload()
      await expect(chat.getByRole("article")).toHaveCount(1)
      if (width === 390)
        await chat
          .getByRole("link", {
            name: "All internal conversations",
            exact: true,
          })
          .click()
      else await page.goto("/messages?mode=internal")
      const navigation = page.getByRole("navigation", {
        name: "Conversations",
        exact: true,
      })
      await expect(
        navigation.getByRole("link", { name: "Dani Colleague", exact: true }),
      ).toHaveCount(1)
      await expect(
        navigation.getByRole("button", {
          name: "Dani Colleague Designer",
          exact: true,
        }),
      ).toHaveCount(0)
      expect(state.creates).toEqual(["recipient-1"])
      if (role === "STAFF" && width === 1440) {
        await navigation
          .getByRole("button", { name: "Collapse conversations", exact: true })
          .click()
        await expect(
          navigation.getByRole("button", {
            name: "Expand conversations",
            exact: true,
          }),
        ).toBeVisible()
      }
      const clientChats = navigation.getByRole("link", {
        name: "Back to client chats",
        exact: true,
      })
      await expect(clientChats).toBeVisible()
      await expect(
        navigation.getByRole("button", {
          name: "Open internal conversations",
          exact: true,
        }),
      ).toHaveCount(0)
      await clientChats.click()
      await expect(page).toHaveURL(/\/messages$/)
      await expect(
        navigation.getByText("Internal chats", { exact: true }),
      ).toHaveCount(0)
      await navigation
        .getByRole("button", {
          name: "Open internal conversations",
          exact: true,
        })
        .click()
      await expect(page).toHaveURL(/\/messages\?mode=internal$/)
      await expect(clientChats).toBeVisible()
      await expect(
        navigation.getByRole("link", { name: "Dani Colleague", exact: true }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    })
  }
}

test("internal chat creation failure can be retried without navigating to an absent thread", async ({
  page,
}) => {
  const state = await internalChat(page, "STAFF")
  state.failCreate = true
  await page.goto("/messages?mode=internal")
  const contact = page.getByRole("button", {
    name: "Dani Colleague Designer",
    exact: true,
  })
  await contact.click()
  await expect(
    page.getByText("Chat unavailable. Try again.", { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Conversations", exact: true })
      .getByRole("alert"),
  ).toHaveCount(0)
  await expect(page).toHaveURL(/\/messages\?mode=internal$/)
  expect(state.created).toBe(false)
  state.failCreate = false
  await page.reload()
  await page
    .getByRole("button", { name: "Dani Colleague Designer", exact: true })
    .click()
  await expect(page).toHaveURL(/internal=chat-1$/)
  expect(state.creates).toEqual(["recipient-1", "recipient-1"])
})

test("internal chat polling receives replies, clears unread state and disables unavailable recipients", async ({
  page,
}) => {
  await page.clock.install()
  const state = await internalChat(page, "ADMIN")
  state.created = true
  await page.goto("/messages?mode=internal&internal=chat-1")
  const chat = page.getByRole("region", { name: "Internal conversation" })
  await expect(chat.getByRole("textbox")).toBeVisible()
  state.messages.push({
    id: "reply-1",
    clientMessageId: "reply-id",
    body: "Incoming colleague reply",
    sender: { id: "recipient-1", fullName: "Dani Colleague" },
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    purgeAt: null,
  })
  state.unread = 1
  await page.clock.fastForward(15_000)
  await expect(chat.getByRole("article")).toContainText(
    "Incoming colleague reply",
  )
  await expect.poll(() => state.reads).toBe(1)
  expect(state.unread).toBe(0)
  await expect(
    page
      .getByRole("navigation", { name: "Conversations", exact: true })
      .getByRole("link", { name: "Dani Colleague", exact: true }),
  ).toBeVisible()
  state.canSend = false
  await page.clock.fastForward(15_000)
  await expect(
    chat.getByText("Messaging is unavailable for this account.", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(chat.getByRole("textbox")).toHaveCount(0)
  await expect(chat.getByRole("article")).toContainText(
    "Incoming colleague reply",
  )
  expect(state.sends).toEqual([])
})

test("collapsed internal rail keeps chats and contacts within its width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await internalChat(page, "STAFF")
  state.created = true
  state.unread = 3
  await page.route("**/api/internal-conversations/contacts", (route) =>
    route.fulfill({
      json: [
        {
          id: "recipient-2",
          fullName: "Alex Department Colleague With A Long Name",
          email: "alex@example.com",
          role: "STAFF",
          position: "Senior Designer",
          isActive: true,
          accountDeletedAt: null,
          department: { id: "design", name: "Design" },
        },
        ...Array.from({ length: 20 }, (_, index) => ({
          id: `extra-contact-${index}`,
          fullName: `Department colleague ${index}`,
          email: `colleague${index}@example.com`,
          role: "STAFF",
          position: "Staff",
          isActive: true,
          accountDeletedAt: null,
          department: { id: "design", name: "Design" },
        })),
      ],
    }),
  )
  await page.goto("/messages?mode=internal")
  const nav = page.getByRole("navigation", {
    name: "Conversations",
    exact: true,
  })
  await nav
    .getByRole("button", { name: "Collapse conversations", exact: true })
    .click()
  const chat = nav.getByRole("link", {
    name: "Dani Colleague, 3 unread messages",
    exact: true,
  })
  const contact = nav.getByRole("button", {
    name: "Alex Department Colleague With A Long Name Senior Designer",
    exact: true,
  })
  await expect(chat).toBeVisible()
  await expect(contact).toBeVisible()
  await expect(nav.getByText("Internal chats", { exact: true })).toBeHidden()
  await expect(nav.getByText("Start a chat", { exact: true })).toBeHidden()
  await expect(nav.getByText("Senior Designer", { exact: true })).toBeHidden()
  const list = nav.locator("#conversation-list")
  await expect
    .poll(() =>
      list.evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true)
  await expect
    .poll(() =>
      list.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true)
  const railBox = await nav.boundingBox()
  for (const row of [chat, contact]) {
    const box = await row.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(railBox!.x)
    expect(box!.x + box!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width)
  }
  await page.screenshot({ path: "test-results/internal-rail-collapsed.png" })
  await nav
    .getByRole("button", { name: "Expand conversations", exact: true })
    .click()
  await expect(nav.getByText("Internal chats", { exact: true })).toBeVisible()
  await expect(nav.getByText("Start a chat", { exact: true })).toBeVisible()
  await expect(nav.getByText("Senior Designer", { exact: true })).toBeVisible()
})
