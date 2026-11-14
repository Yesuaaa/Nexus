import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getMessagesView,
  messagesViewHref,
} from "../src/features/request-conversations/model/messages-view.ts"

test("only clients have a unified inbox, irrespective of module or deep link", () => {
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN", "USER"])
    for (const moduleId of [
      null,
      "service-operations",
      "project-management",
      "people-hr",
      "administration",
    ])
      assert.equal(
        getMessagesView({ role }, moduleId) === "unified",
        role === "USER",
      )
  assert.equal(
    getMessagesView({ role: "USER" }, "service-operations", { internal: true }),
    "unified",
  )
})

test("module and legacy thread entry points select one inbox", () => {
  const head = { role: "STAFF", headOf: { id: "design" } }
  assert.equal(getMessagesView(head, "service-operations"), "service")
  assert.equal(getMessagesView(head, "project-management"), "project")
  assert.equal(
    getMessagesView(head, "service-operations", { project: true }),
    "project",
  )
  assert.equal(
    getMessagesView(head, "project-management", { service: true }),
    "service",
  )
  assert.equal(
    getMessagesView(head, "project-management", { internal: true }),
    "internal",
  )
  assert.equal(messagesViewHref("service"), "/messages?scope=service")
  assert.equal(messagesViewHref("project"), "/messages?scope=project")
  assert.equal(messagesViewHref("internal"), "/messages?mode=internal")
})
