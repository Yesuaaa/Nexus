import { attendanceNavigation } from "../src/features/attendance/model/navigation.ts"
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
  deviceDateTime,
  deviceDateTimeOccurrences,
} from "../src/features/attendance/model/attendance.ts"
import {
  canAccessPersonalAttendance,
  Permissions,
} from "../src/features/auth/model/permissions.ts"
import { formatDateTime } from "../src/lib/format.ts"

test("correction times resolve device-zone gaps, folds, and ordinary intervals", (t) => {
  const originalZone = process.env.TZ
  t.after(() => {
    if (originalZone === undefined) delete process.env.TZ
    else process.env.TZ = originalZone
  })
  process.env.TZ = "America/Los_Angeles"
  const occurrences = (value) =>
    deviceDateTimeOccurrences(value).map((date) => date.toISOString())

  assert.deepEqual(occurrences("2026-03-08T02:30"), [])
  assert.deepEqual(occurrences("2026-02-30T09:00"), [])
  const starts = occurrences("2026-11-01T01:45")
  const ends = occurrences("2026-11-01T01:15")
  assert.deepEqual(starts, [
    "2026-11-01T08:45:00.000Z",
    "2026-11-01T09:45:00.000Z",
  ])
  assert.deepEqual(ends, [
    "2026-11-01T08:15:00.000Z",
    "2026-11-01T09:15:00.000Z",
  ])
  assert.equal(Date.parse(ends[1]) - Date.parse(starts[0]), 30 * 60000)
  assert.equal(Date.parse(ends[0]) - Date.parse(starts[1]), -90 * 60000)
  assert.equal(deviceDateTime(starts[0]), "2026-11-01T01:45")
  assert.equal(deviceDateTime(starts[1]), "2026-11-01T01:45")
  assert.deepEqual(occurrences("2026-11-05T23:30"), [
    "2026-11-06T07:30:00.000Z",
  ])

  process.env.TZ = "Australia/Lord_Howe"
  assert.deepEqual(occurrences("2026-04-05T01:45"), [
    "2026-04-04T14:45:00.000Z",
    "2026-04-04T15:15:00.000Z",
  ])
  assert.deepEqual(occurrences("2026-10-04T02:15"), [])

  process.env.TZ = "Asia/Manila"
  assert.deepEqual(occurrences("2026-11-01T01:45"), [
    "2026-10-31T17:45:00.000Z",
  ])
})

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
      "attendance-monitoring",
    )
  }
  assert.equal(canAccessRoute(staff, "/employees"), false)
  for (const path of [
    "/attendance/time-logs/overview",
    "/attendance/records",
    "/attendance/audit",
    "/attendance/time-logs/audit",
  ]) {
    assert.equal(canAccessRoute(staff, path), false)
    assert.equal(canAccessRoute(head, path), true)
    assert.equal(canAccessRoute(admin, path), true)
  }
  assert.equal(canAccessRoute(head, "/attendance/settings"), false)
  assert.equal(canAccessRoute(admin, "/attendance/settings"), true)
  const superadmin = { ...admin, role: "SUPERADMIN" }
  for (const group of attendanceNavigation)
    for (const link of group.links)
      assert.equal(
        canAccessRoute(superadmin, link.href),
        group.id !== "attendance",
        link.href,
      )
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

test("all attendance navigation pages preserve module ownership and role boundaries", () => {
  const staff = { id: "staff", role: "STAFF", isActive: true, permissions: [] }
  for (const group of attendanceNavigation)
    for (const link of group.links) {
      assert.equal(
        canAccessRoute(staff, link.href),
        link.access === "self",
        link.href,
      )
      assert.equal(
        canAccessRoute(
          { ...staff, headOf: { id: "dept", name: "Design" } },
          link.href,
        ),
        link.access !== "configure",
        link.href,
      )
      for (const role of ["USER", "SUPERADMIN"])
        assert.equal(canAccessRoute({ ...staff, role }, link.href), false)
    }
})

test("[PG-003-F001-A001-T001] personal attendance selection requires active STAFF or ADMIN", () => {
  const account = (role, isActive = true, permissions = []) => ({
    role,
    isActive,
    permissions,
    headOf: null,
  })

  assert.equal(canAccessPersonalAttendance(account("STAFF")), true)
  assert.equal(canAccessPersonalAttendance(account("ADMIN", true, [])), true)
  assert.equal(canAccessPersonalAttendance(account("USER")), false)
  assert.equal(canAccessPersonalAttendance(account("SUPERADMIN")), false)
  assert.equal(
    canAccessPersonalAttendance(
      account("SUPERADMIN", true, [Permissions.EMPLOYEES_READ]),
    ),
    false,
  )
  assert.equal(canAccessPersonalAttendance(account("STAFF", false)), false)
  assert.equal(canAccessPersonalAttendance(account("ADMIN", false)), false)
})

test("[PG-003-F001-A003-T002] attendance entry route enforces active role and read grant", () => {
  const account = (role, isActive = true, permissions = []) => ({
    role,
    isActive,
    permissions,
  })

  assert.equal(canAccessRoute(account("STAFF"), "/attendance"), true)
  assert.equal(canAccessRoute(account("ADMIN"), "/attendance"), true)
  assert.equal(
    canAccessRoute(
      account("SUPERADMIN", true, [Permissions.EMPLOYEES_READ]),
      "/attendance",
    ),
    true,
  )
  assert.equal(canAccessRoute(account("SUPERADMIN"), "/attendance"), false)
  assert.equal(canAccessRoute(account("USER"), "/attendance"), false)
  assert.equal(canAccessRoute(account("STAFF", false), "/attendance"), false)
  assert.equal(canAccessRoute(account("ADMIN", false), "/attendance"), false)
})

test("[PG-004-F001-A001-T001] adjustment route enforces active roles and employee read grant", () => {
  const account = (role, isActive = true, permissions = []) => ({
    role,
    isActive,
    permissions,
  })

  assert.equal(
    canAccessRoute(account("STAFF"), "/attendance/adjustments"),
    true,
  )
  assert.equal(
    canAccessRoute(account("ADMIN"), "/attendance/adjustments"),
    true,
  )
  assert.equal(
    canAccessRoute(
      account("SUPERADMIN", true, [Permissions.EMPLOYEES_READ]),
      "/attendance/adjustments",
    ),
    true,
  )
  assert.equal(
    canAccessRoute(account("SUPERADMIN"), "/attendance/adjustments"),
    false,
  )
  assert.equal(
    canAccessRoute(account("USER"), "/attendance/adjustments"),
    false,
  )
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN"])
    assert.equal(
      canAccessRoute(
        account(role, false, [Permissions.EMPLOYEES_READ]),
        "/attendance/adjustments",
      ),
      false,
      `${role} must be active`,
    )
})
