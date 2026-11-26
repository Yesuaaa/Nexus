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
  defaultRange,
} from "../src/features/attendance/model/attendance.ts"
import {
  canAccessPersonalAttendance,
  canConfigureAttendance,
  Permissions,
} from "../src/features/auth/model/permissions.ts"
import { formatDateTime } from "../src/lib/format.ts"

test("[PG-007-F001-A002-T003] default overview range uses UTC date serialization", (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-11-23T04:30:00.000Z"),
  })

  assert.deepEqual(defaultRange(), { from: "2026-10-24", to: "2026-11-24" })
})

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
    "/attendance/dashboard",
    "/attendance/records",
    "/attendance/audit",
    "/attendance/time-logs/audit",
  ]) {
    assert.equal(canAccessRoute(staff, path), false)
    assert.equal(canAccessRoute(head, path), true)
    assert.equal(canAccessRoute(admin, path), true)
  }
  // PG-005-F001-A001-T002: access also requires an active actor and grant.
  const privilegedWithoutRead = [
    { ...staff, role: "ADMIN" },
    { ...staff, role: "SUPERADMIN" },
  ]
  const inactiveHead = { ...head, isActive: false }
  const inactiveAdmin = { ...admin, isActive: false }
  for (const actor of [
    { ...staff, role: "USER" },
    inactiveHead,
    inactiveAdmin,
    ...privilegedWithoutRead,
  ]) {
    for (const path of ["/attendance/audit", "/attendance/time-logs/audit"])
      assert.equal(canAccessRoute(actor, path), false, path)
  }
  const superadmin = { ...admin, role: "SUPERADMIN" }
  for (const path of ["/attendance/audit", "/attendance/time-logs/audit"])
    assert.equal(canAccessRoute(superadmin, path), true, path)
  assert.equal(canAccessRoute(head, "/attendance/settings"), false)
  assert.equal(canAccessRoute(admin, "/attendance/settings"), true)
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

  // PG-006-F001-A003-T006 adds boundary coverage without replacing the
  // existing overnight, unpaid-break, split-session, or long-duration checks.
  const bounded = {
    sessions: [
      {
        ...session,
        startedAt: "2026-11-13T09:00:00+08:00",
        endedAt: "2026-11-13T10:00:00+08:00",
      },
    ],
  }
  assert.equal(elapsedWork(bounded, Date.parse("2026-11-13T08:59:59+08:00")), 0)
  assert.equal(
    elapsedWork(bounded, Date.parse("2026-11-13T12:00:00+08:00")),
    60 * 60000,
  )
  assert.equal(
    elapsedWork(
      {
        sessions: [
          {
            ...bounded.sessions[0],
            endedAt: null,
            suspendedAt: "2026-11-13T10:00:00+08:00",
          },
        ],
      },
      Date.parse("2026-11-13T12:00:00+08:00"),
    ),
    60 * 60000,
  )
  assert.equal(
    elapsedWork(
      {
        sessions: [
          {
            ...bounded.sessions[0],
            breaks: [
              {
                startedAt: "2026-11-13T09:30:00+08:00",
                endedAt: "2026-11-13T09:45:00+08:00",
                isPaid: true,
              },
            ],
          },
        ],
      },
      Date.parse("2026-11-13T12:00:00+08:00"),
    ),
    60 * 60000,
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

  // PG-014-F001-A001-T002
  const timeLogs = "/attendance/time-logs/overview"
  const head = { ...staff, headOf: { id: "dept", name: "Design" } }
  // PG-015-F001-A001-T001
  for (const records of [
    "/attendance/time-logs/records",
    "/attendance/records",
  ]) {
    assert.equal(canAccessRoute(head, records), true)
    assert.equal(
      getActiveWorkspaceModuleId(head, records),
      "attendance-monitoring",
    )
    assert.equal(canAccessRoute({ ...head, isActive: false }, records), false)
    assert.equal(canAccessRoute(staff, records), false)
    assert.equal(canAccessRoute({ ...staff, role: "USER" }, records), false)
    for (const role of ["ADMIN", "SUPERADMIN"]) {
      const permitted = {
        ...staff,
        role,
        permissions: [Permissions.EMPLOYEES_READ],
      }
      assert.equal(canAccessRoute(permitted, records), true)
      assert.equal(
        getActiveWorkspaceModuleId(permitted, records),
        "attendance-monitoring",
      )
      assert.equal(
        canAccessRoute({ ...permitted, permissions: [] }, records),
        false,
      )
      assert.equal(
        canAccessRoute({ ...permitted, isActive: false }, records),
        false,
      )
    }
  }
  assert.equal(canAccessRoute(head, timeLogs), true)
  assert.equal(canAccessRoute({ ...head, isActive: false }, timeLogs), false)
  assert.equal(canAccessRoute({ ...staff, role: "USER" }, timeLogs), false)
  for (const role of ["ADMIN", "SUPERADMIN"]) {
    const privileged = {
      ...staff,
      role,
      permissions: [Permissions.EMPLOYEES_READ],
    }
    assert.equal(canAccessRoute(privileged, timeLogs), true, role)
    assert.equal(
      canAccessRoute({ ...privileged, isActive: false }, timeLogs),
      false,
      role,
    )
    assert.equal(
      canAccessRoute({ ...privileged, permissions: [] }, timeLogs),
      false,
      role,
    )
  }

  // PG-011-F001-A001-T001: the canonical Leave route follows the attendance
  // role and permission policy for both self-service and administrative users.
  const leaveRoute = "/attendance/requests/leave"
  const activeAdmin = { ...staff, id: "admin", role: "ADMIN" }
  const permittedSuperadmin = {
    ...staff,
    id: "superadmin",
    role: "SUPERADMIN",
    permissions: [Permissions.EMPLOYEES_READ],
  }
  assert.equal(canAccessRoute(staff, leaveRoute), true)
  assert.equal(canAccessRoute(activeAdmin, leaveRoute), true)
  assert.equal(canAccessRoute(permittedSuperadmin, leaveRoute), true)
  assert.equal(canAccessRoute({ ...staff, role: "USER" }, leaveRoute), false)
  assert.equal(canAccessRoute({ ...staff, isActive: false }, leaveRoute), false)
  assert.equal(
    canAccessRoute({ ...staff, role: "ADMIN", isActive: false }, leaveRoute),
    false,
  )
  assert.equal(
    canAccessRoute({ ...staff, role: "SUPERADMIN" }, leaveRoute),
    false,
  )

  // PG-013-F001-A001-T001: the request overview route follows Attendance
  // access policy for staff, administrators, and permitted Superadmins.
  const requestsOverviewRoute = "/attendance/requests/overview"
  assert.equal(canAccessRoute(staff, requestsOverviewRoute), true)
  assert.equal(canAccessRoute(activeAdmin, requestsOverviewRoute), true)
  assert.equal(canAccessRoute(permittedSuperadmin, requestsOverviewRoute), true)
  assert.equal(
    canAccessRoute(
      { ...staff, headOf: { id: "dept", name: "Design" } },
      requestsOverviewRoute,
    ),
    true,
  )
  assert.equal(
    canAccessRoute({ ...staff, role: "USER" }, requestsOverviewRoute),
    false,
  )
  assert.equal(
    canAccessRoute({ ...staff, isActive: false }, requestsOverviewRoute),
    false,
  )
  assert.equal(
    canAccessRoute(
      { ...staff, role: "ADMIN", isActive: false },
      requestsOverviewRoute,
    ),
    false,
  )
  assert.equal(
    canAccessRoute({ ...staff, role: "SUPERADMIN" }, requestsOverviewRoute),
    false,
  )

  // PG-008-F001-A001-T001: direct permission and route-policy boundaries for
  // Attendance policy management.
  const manager = (role, isActive = true, permissions = []) => ({
    id: `pg008-${role.toLowerCase()}`,
    role,
    isActive,
    permissions,
  })
  const manageAttendance = [Permissions.EMPLOYEES_MANAGE]
  for (const role of ["ADMIN", "SUPERADMIN"]) {
    const allowed = manager(role, true, manageAttendance)
    assert.equal(canConfigureAttendance(allowed), true, role)
    assert.equal(
      canAccessRoute(allowed, "/attendance/policies/management"),
      true,
      role,
    )
    const missingPermission = manager(role)
    assert.equal(canConfigureAttendance(missingPermission), false, role)
    assert.equal(
      canAccessRoute(missingPermission, "/attendance/policies/management"),
      false,
      role,
    )
    const inactive = manager(role, false, manageAttendance)
    assert.equal(canConfigureAttendance(inactive), false, role)
    assert.equal(
      canAccessRoute(inactive, "/attendance/policies/management"),
      false,
      role,
    )
  }
  for (const role of ["STAFF", "USER"]) {
    const unsupported = manager(role, true, manageAttendance)
    assert.equal(canConfigureAttendance(unsupported), false, role)
    assert.equal(
      canAccessRoute(unsupported, "/attendance/policies/management"),
      false,
      role,
    )
  }

  // PG-009-F001-A001-T001: the overview has the same exact configure gate
  // as policy management; preserve the PG-008 assertions above unchanged.
  const overviewPath = "/attendance/policies/overview"
  for (const role of ["ADMIN", "SUPERADMIN"]) {
    const allowed = manager(role, true, manageAttendance)
    assert.equal(canAccessRoute(allowed, overviewPath), true, role)
    assert.equal(
      canAccessRoute(manager(role), overviewPath),
      false,
      `${role} without employees:manage`,
    )
    assert.equal(
      canAccessRoute(manager(role, false, manageAttendance), overviewPath),
      false,
      `${role} inactive`,
    )
  }
  for (const role of ["STAFF", "USER"]) {
    assert.equal(
      canAccessRoute(manager(role, true, manageAttendance), overviewPath),
      false,
      role,
    )
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

  // PG-010-F001-A001-T001: preserve the mixed PG-004 route assertions above
  // and verify the canonical correction-only route with the same policy.
  const correctionsPath = "/attendance/requests/corrections"
  assert.equal(canAccessRoute(account("STAFF"), correctionsPath), true)
  assert.equal(canAccessRoute(account("ADMIN"), correctionsPath), true)
  assert.equal(
    canAccessRoute(
      account("SUPERADMIN", true, [Permissions.EMPLOYEES_READ]),
      correctionsPath,
    ),
    true,
  )
  assert.equal(canAccessRoute(account("SUPERADMIN"), correctionsPath), false)
  assert.equal(canAccessRoute(account("USER"), correctionsPath), false)
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN"])
    assert.equal(
      canAccessRoute(
        account(role, false, [Permissions.EMPLOYEES_READ]),
        correctionsPath,
      ),
      false,
      `${role} must be active on Corrections`,
    )

  // PG-012-F001-A001-T001: add the canonical Overtime path to the existing
  // route-policy matrix while retaining the mixed and Corrections assertions.
  const overtimePath = "/attendance/requests/overtime"
  assert.equal(canAccessRoute(account("STAFF"), overtimePath), true)
  assert.equal(canAccessRoute(account("ADMIN"), overtimePath), true)
  assert.equal(
    canAccessRoute(
      account("SUPERADMIN", true, [Permissions.EMPLOYEES_READ]),
      overtimePath,
    ),
    true,
  )
  assert.equal(canAccessRoute(account("SUPERADMIN"), overtimePath), false)
  assert.equal(canAccessRoute(account("USER"), overtimePath), false)
  for (const role of ["STAFF", "ADMIN", "SUPERADMIN"])
    assert.equal(
      canAccessRoute(
        account(role, false, [Permissions.EMPLOYEES_READ]),
        overtimePath,
      ),
      false,
      `${role} must be active on Overtime`,
    )
})
