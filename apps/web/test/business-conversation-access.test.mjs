import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canInspectBusinessConversations,
  canAccessProjectWorkspace,
  canAccessRequestInbox,
  Permissions,
} from "../src/features/auth/model/permissions.ts"
import {
  canAccessRoute,
  findRoutePolicy,
} from "../src/features/workspaces/model/route-policy.ts"
import { getMessagesView } from "../src/features/request-conversations/model/messages-view.ts"

test("business metadata route requires both existing inspection and organization-read grants", () => {
  const actor = {
    role: "SUPERADMIN",
    permissions: [
      Permissions.ORGANIZATION_READ_ALL,
      Permissions.BUSINESS_CONVERSATIONS_INSPECT,
    ],
  }
  assert.equal(canInspectBusinessConversations(actor), true)
  assert.equal(canAccessRoute(actor, "/messages/oversight"), true)
  assert.equal(findRoutePolicy("/messages/oversight").moduleId, null)
  for (const permissions of [
    [],
    [Permissions.ORGANIZATION_READ_ALL],
    [Permissions.BUSINESS_CONVERSATIONS_INSPECT],
  ]) {
    assert.equal(
      canInspectBusinessConversations({ ...actor, permissions }),
      false,
    )
    assert.equal(
      canAccessRoute({ ...actor, permissions }, "/messages/oversight"),
      false,
    )
  }
  for (const role of ["ADMIN", "STAFF", "USER"]) {
    const ordinary = { role, permissions: [] }
    assert.equal(canAccessRoute(ordinary, "/messages"), true)
    assert.equal(canAccessRoute(ordinary, "/messages/oversight"), false)
  }
  assert.equal(canAccessRoute(actor, "/messages/oversight/private"), false)
})

test("business oversight grants no operational inbox or project identity", () => {
  const actor = {
    role: "SUPERADMIN",
    permissions: [
      Permissions.ORGANIZATION_READ_ALL,
      Permissions.BUSINESS_CONVERSATIONS_INSPECT,
    ],
    headOf: null,
  }
  assert.equal(canInspectBusinessConversations(actor), true)
  assert.equal(canAccessRequestInbox(actor), false)
  assert.equal(canAccessProjectWorkspace(actor), false)
  for (const moduleId of ["service-operations", "project-management"])
    assert.equal(getMessagesView(actor, moduleId), "internal")
})

test("department leadership preserves ordinary messaging without metadata inspection", () => {
  const actor = {
    role: "STAFF",
    permissions: [Permissions.DEPARTMENTS_READ],
    headOf: { id: "design", name: "Design" },
  }
  assert.equal(canAccessRoute(actor, "/messages"), true)
  assert.equal(canAccessRequestInbox(actor), true)
  assert.equal(canInspectBusinessConversations(actor), false)
  assert.equal(canAccessRoute(actor, "/messages/oversight"), false)
})
