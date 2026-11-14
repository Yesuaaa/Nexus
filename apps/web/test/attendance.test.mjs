import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canAccessRoute,
  getActiveWorkspaceModuleId,
} from "../src/features/workspaces/model/route-policy.ts"
import {
  elapsedWork,
  duration,
  attendanceDate,
} from "../src/features/attendance/model/attendance.ts"
import { Permissions } from "../src/features/auth/model/permissions.ts"
import { formatDateTime } from "../src/lib/format.ts"

test("shared timestamp formatting preserves UTC and overnight local calendar dates", () => {
  const timestamp = "2026-11-13T20:00:00Z"
  assert.equal(formatDateTime(timestamp, "UTC"), "Nov 13, 2026, 8:00 PM")
  assert.equal(
    attendanceDate(timestamp, "Asia/Manila"),
    "Nov 14, 2026, 4:00 AM",
  )
  assert.equal(
    formatDateTime(timestamp, "America/New_York"),
    "Nov 13, 2026, 3:00 PM",
  )
})

test("attendance navigation grants self-service independently of employee management", () => {
  const staff = { role: "STAFF", isActive: true, permissions: [], headOf: null }
  const head = { ...staff, headOf: { id: "department" } }
  const admin = {
    ...staff,
    role: "ADMIN",
    permissions: [Permissions.EMPLOYEES_READ, Permissions.EMPLOYEES_MANAGE],
  }
  for (const actor of [staff, head, admin]) {
    assert.equal(canAccessRoute(actor, "/attendance/my"), true)
    assert.equal(canAccessRoute(actor, "/attendance/adjustments"), true)
    assert.equal(
      getActiveWorkspaceModuleId(actor, "/attendance/my"),
      "people-hr",
    )
  }
  assert.equal(canAccessRoute(staff, "/employees"), false)
  for (const path of ["/attendance/overview", "/attendance/records"]) {
    assert.equal(canAccessRoute(staff, path), false)
    assert.equal(canAccessRoute(head, path), true)
    assert.equal(canAccessRoute(admin, path), true)
  }
  assert.equal(canAccessRoute(head, "/attendance/settings"), false)
  assert.equal(canAccessRoute(admin, "/attendance/settings"), true)
  for (const role of ["USER", "SUPERADMIN"])
    assert.equal(canAccessRoute({ ...staff, role }, "/attendance/my"), false)
  assert.equal(
    canAccessRoute({ ...staff, isActive: false }, "/attendance/my"),
    false,
  )
})

test("live elapsed time preserves overnight attribution and pauses during unpaid breaks", () => {
  const session = {
    id: "s",
    startedAt: "2026-11-13T20:00:00+08:00",
    endedAt: null,
    breaks: [],
  }
  const day = { sessions: [session] }
  assert.equal(
    elapsedWork(day, Date.parse("2026-11-14T04:00:00+08:00")),
    8 * 3600000,
  )
  const paused = {
    sessions: [
      {
        ...session,
        breaks: [
          {
            startedAt: "2026-11-13T23:30:00+08:00",
            endedAt: null,
            isPaid: false,
          },
        ],
      },
    ],
  }
  assert.equal(
    elapsedWork(paused, Date.parse("2026-11-14T00:30:00+08:00")),
    3.5 * 3600000,
  )
  assert.equal(
    elapsedWork(paused, Date.parse("2026-11-14T01:30:00+08:00")),
    3.5 * 3600000,
  )
  const split = {
    sessions: [
      { ...session, endedAt: "2026-11-14T04:00:00+08:00" },
      { ...session, startedAt: "2026-11-14T05:00:00+08:00" },
    ],
  }
  assert.equal(
    elapsedWork(split, Date.parse("2026-11-14T06:00:00+08:00")),
    9 * 3600000,
  )
  assert.equal(duration(27 * 3600000 + 61000), "27:01:01")
})
