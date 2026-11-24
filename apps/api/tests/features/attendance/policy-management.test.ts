import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { applyMigrations, startPgliteApp } from "../../support/pglite-app.js"

test(
  "policy edits, assignment directory, and archive/delete lifecycle preserve recorded attendance",
  { timeout: 120000 },
  async (t) => {
    let now = new Date("2026-11-13T12:00:00+08:00")
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
      migrate: async (db) => {
        await applyMigrations(db)
        await db.exec("SET TIME ZONE 'Asia/Manila'")
      },
    })
    const admin = await prisma.user.create({
      data: {
        email: "policy-admin@test.example",
        passwordHash: "test-only",
        role: "ADMIN",
      },
    })
    const staff = await prisma.user.create({
      data: {
        email: "policy-staff@test.example",
        passwordHash: "test-only",
        role: "STAFF",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "POLICY-001",
        fullName: "Assigned employee",
        userId: staff.id,
      },
    })
    const adminToken = (await issueSession(admin)).token
    const staffToken = (await issueSession(staff)).token
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      token = adminToken,
    ) {
      return fetch(`${base}/attendance${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    const input = {
      name: "Original policy",
      timeZone: "Asia/Manila",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: false,
      days: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        isWorkingDay: true,
        requiredMinutes: 480,
      })),
    }
    const created = await request("/policies", "POST", input)
    assert.equal(created.status, 201)
    const { policy } = (await created.json()) as { policy: { id: string } }
    const path = `/policies/${policy.id}`
    const assignment = await request("/assignments", "POST", {
      employeeId: employee.id,
      policyId: policy.id,
      effectiveFrom: "2026-11-13",
    })
    assert.equal(assignment.status, 201, await assignment.clone().text())
    const session = await prisma.attendanceWorkSession.create({
      data: {
        employeeId: employee.id,
        startedAt: new Date("2026-11-13T09:00:00+08:00"),
      },
    })
    const edited = {
      ...input,
      name: "Updated policy",
      unpaidBreaksEnabled: false,
      overnightRequiresReview: true,
      days: input.days.map((day) => ({ ...day, requiredMinutes: 360 })),
    }

    await t.test(
      "edits require management access and update the same policy ID",
      async () => {
        assert.equal(
          (await request(path, "PATCH", edited, staffToken)).status,
          403,
        )
        assert.equal(
          (await request(path, "PATCH", { ...edited, days: [] })).status,
          400,
        )
        assert.equal(
          (await request(path, "PATCH", { ...edited, timeZone: "UTC" })).status,
          409,
        )
        const response = await request(path, "PATCH", edited)
        assert.equal(response.status, 200, await response.clone().text())
        const result = (await response.json()) as {
          policy: {
            id: string
            name: string
            days: { requiredMinutes: number }[]
          }
        }
        assert.equal(result.policy.id, policy.id)
        assert.equal(result.policy.name, edited.name)
        assert.equal(result.policy.days[0].requiredMinutes, 360)
        assert.equal(await prisma.attendancePolicy.count(), 1)
      },
    )
    await t.test(
      "historical rules and open-session break permissions are preserved",
      async () => {
        const current = await request(
          "/me/current",
          "GET",
          undefined,
          staffToken,
        )
        const state = (await current.json()) as {
          workday: {
            requiredMinutes: number
            policy: {
              name: string
              unpaidBreaksEnabled: boolean
              overnightRequiresReview: boolean
            }
          }
        }
        assert.equal(state.workday.requiredMinutes, 480)
        assert.deepEqual(state.workday.policy, {
          id: policy.id,
          name: input.name,
          unpaidBreaksEnabled: true,
          overnightRequiresReview: false,
        })
        assert.equal(
          (
            await request(
              "/me/breaks/start",
              "POST",
              { sessionId: session.id },
              staffToken,
            )
          ).status,
          200,
        )
        // Close the open session and its break before recording the next workday.
        const pause = await prisma.attendanceBreak.findFirstOrThrow({
          where: { sessionId: session.id },
        })
        await prisma.attendanceBreak.update({
          where: { id: pause.id },
          data: { endedAt: new Date("2026-11-13T12:30:00+08:00") },
        })
        await prisma.attendanceWorkSession.update({
          where: { id: session.id },
          data: { endedAt: new Date("2026-11-13T13:00:00+08:00") },
        })
        const future = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: employee.id,
            startedAt: new Date("2026-11-14T09:00:00+08:00"),
            endedAt: new Date("2026-11-14T10:00:00+08:00"),
          },
        })
        const day = await prisma.attendanceWorkday.findUniqueOrThrow({
          where: { id: future.workdayId },
        })
        assert.equal(day.requiredMinutes, 360)
        assert.equal(day.policyName, edited.name)
        assert.equal(day.unpaidBreaksEnabled, false)
        assert.equal(day.overnightRequiresReview, true)
      },
    )
    await t.test(
      "policy overview totals cover the inventory and remain configuration-only",
      async () => {
        assert.equal(
          (await request("/policies", "GET", undefined, staffToken)).status,
          403,
        )
        const response = await request("/policies")
        assert.equal(response.status, 200)
        const result = (await response.json()) as {
          summary: {
            totalPolicies: number
            activePolicies: number
            archivedPolicies: number
            assignmentPeriods: number
          }
        }
        assert.deepEqual(result.summary, {
          totalPolicies: await prisma.attendancePolicy.count(),
          activePolicies: await prisma.attendancePolicy.count({
            where: { archivedAt: null },
          }),
          archivedPolicies: await prisma.attendancePolicy.count({
            where: { archivedAt: { not: null } },
          }),
          assignmentPeriods: await prisma.attendancePolicyAssignment.count(),
        })
      },
    )
    await t.test(
      "assignment details are paginated and restricted to managers",
      async () => {
        assert.equal(
          (await request(`${path}/assignments`, "GET", undefined, staffToken))
            .status,
          403,
        )
        assert.equal(
          (await request(`${path}/assignments?page=invalid`)).status,
          400,
        )
        const response = await request(`${path}/assignments`)
        assert.equal(response.status, 200)
        const result = (await response.json()) as {
          total: number
          assignments: {
            status: string
            employee: { fullName: string; employeeId: string }
          }[]
        }
        assert.equal(result.total, 1)
        assert.equal(result.assignments[0].employee.fullName, employee.fullName)
        assert.equal(
          result.assignments[0].employee.employeeId,
          employee.employeeId,
        )
        assert.equal(result.assignments[0].status, "CURRENT")

        const statusFixtures: {
          key: string
          from: string
          status: string
          until?: string
          cancelledAt?: string
        }[] = [
          { key: "scheduled-1", from: "2026-11-22", status: "SCHEDULED" },
          { key: "scheduled-2", from: "2026-11-21", status: "SCHEDULED" },
          { key: "scheduled-3", from: "2026-11-20", status: "SCHEDULED" },
          {
            key: "cancelled-1",
            from: "2026-11-19",
            cancelledAt: "2026-11-12T00:00:00.000Z",
            status: "CANCELLED",
          },
          {
            key: "cancelled-2",
            from: "2026-11-18",
            cancelledAt: "2026-11-12T00:00:00.000Z",
            status: "CANCELLED",
          },
          { key: "current-1", from: "2026-11-12", status: "CURRENT" },
          { key: "current-2", from: "2026-11-11", status: "CURRENT" },
          { key: "current-3", from: "2026-11-10", status: "CURRENT" },
          {
            key: "ended-1",
            from: "2026-11-09",
            until: "2026-11-12",
            status: "ENDED",
          },
          {
            key: "ended-2",
            from: "2026-11-08",
            until: "2026-11-11",
            status: "ENDED",
          },
        ]
        const seeded: {
          id: string
          status: string
          employeeId: string
        }[] = []
        for (const fixture of statusFixtures) {
          const fixtureEmployee = await prisma.employee.create({
            data: {
              employeeId: `POLICY-${fixture.key}`,
              fullName: `Assignment ${fixture.key}`,
            },
          })
          const createdAssignment =
            await prisma.attendancePolicyAssignment.create({
              data: {
                employeeId: fixtureEmployee.id,
                policyId: policy.id,
                effectiveFrom: new Date(`${fixture.from}T00:00:00.000Z`),
                ...(fixture.until && {
                  effectiveUntil: new Date(`${fixture.until}T00:00:00.000Z`),
                }),
              },
            })
          if (fixture.cancelledAt)
            await prisma.attendancePolicyAssignment.update({
              where: { id: createdAssignment.id },
              data: { cancelledAt: new Date(fixture.cancelledAt) },
            })
          seeded.push({
            id: createdAssignment.id,
            status: fixture.status,
            employeeId: fixtureEmployee.employeeId,
          })
        }

        const pageOneResponse = await request(`${path}/assignments?page=1`)
        assert.equal(pageOneResponse.status, 200)
        const pageOne = (await pageOneResponse.json()) as {
          total: number
          page: number
          pageSize: number
          assignments: {
            id: string
            effectiveFrom: string
            status: string
            employee: { fullName: string; employeeId: string }
          }[]
        }
        const pageTwoResponse = await request(`${path}/assignments?page=2`)
        assert.equal(pageTwoResponse.status, 200)
        const pageTwo = (await pageTwoResponse.json()) as {
          total: number
          page: number
          pageSize: number
          assignments: {
            id: string
            effectiveFrom: string
            status: string
            employee: { fullName: string; employeeId: string }
          }[]
        }
        const allRows = [...pageOne.assignments, ...pageTwo.assignments]
        assert.deepEqual(
          [pageOne.total, pageOne.page, pageOne.pageSize],
          [11, 1, 10],
        )
        assert.deepEqual(
          [pageTwo.total, pageTwo.page, pageTwo.pageSize],
          [11, 2, 10],
        )
        assert.equal(pageOne.assignments.length, 10)
        assert.equal(pageTwo.assignments.length, 1)
        assert.equal(new Set(allRows.map(({ id }) => id)).size, 11)
        assert.deepEqual(
          allRows.map(({ id }) => id),
          allRows
            .slice()
            .sort(
              (left, right) =>
                right.effectiveFrom.localeCompare(left.effectiveFrom) ||
                left.id.localeCompare(right.id),
            )
            .map(({ id }) => id),
        )
        assert.deepEqual(
          [...new Set(allRows.map(({ status }) => status))].sort(),
          ["CANCELLED", "CURRENT", "ENDED", "SCHEDULED"],
        )
        for (const fixture of seeded) {
          const actual = allRows.find(({ id }) => id === fixture.id)
          assert.ok(actual, fixture.id)
          assert.equal(actual.status, fixture.status, fixture.id)
          assert.equal(
            actual.employee.employeeId,
            fixture.employeeId,
            fixture.id,
          )
        }
        assert.equal(
          allRows.find(({ id }) => id === seeded[0].id)?.employee.fullName,
          "Assignment scheduled-1",
        )
      },
    )
    await t.test(
      "archiving prevents new assignments and preserves existing history",
      async () => {
        assert.equal((await request(path, "DELETE")).status, 409)
        assert.equal(
          (await request(`${path}/archive`, "POST", undefined, staffToken))
            .status,
          403,
        )
        assert.equal((await request(`${path}/archive`, "POST")).status, 200)
        assert.equal((await request(path, "PATCH", edited)).status, 409)
        assert.equal(
          (
            await request("/assignments", "POST", {
              employeeId: employee.id,
              policyId: policy.id,
              effectiveFrom: "2026-12-01",
            })
          ).status,
          409,
        )
        assert.equal((await request(path, "DELETE")).status, 409)
        const current = await request(
          "/me/current",
          "GET",
          undefined,
          staffToken,
        )
        assert.equal(current.status, 200)
        assert.equal(
          ((await current.json()) as { needsPolicy: boolean }).needsPolicy,
          false,
        )
        assert.equal((await request(`${path}/restore`, "POST")).status, 200)
        assert.equal(
          (
            await prisma.attendancePolicy.findUniqueOrThrow({
              where: { id: policy.id },
            })
          ).archivedAt,
          null,
        )
      },
    )
    await t.test(
      "unassigned policies can be permanently deleted only after archiving",
      async () => {
        const response = await request("/policies", "POST", input)
        const { policy: disposable } = (await response.json()) as {
          policy: { id: string }
        }
        const disposablePath = `/policies/${disposable.id}`
        assert.equal((await request(disposablePath, "DELETE")).status, 409)
        assert.equal(
          (await request(`${disposablePath}/archive`, "POST")).status,
          200,
        )
        assert.equal(
          (await request(disposablePath, "DELETE", undefined, staffToken))
            .status,
          403,
        )
        assert.equal((await request(disposablePath, "DELETE")).status, 200)
        assert.equal(
          await prisma.attendancePolicy.findUnique({
            where: { id: disposable.id },
          }),
          null,
        )
        assert.equal(
          await prisma.attendancePolicyDay.count({
            where: { policyId: disposable.id },
          }),
          0,
        )
        assert.equal((await request(disposablePath, "DELETE")).status, 404)
        assert.ok(
          await prisma.attendanceAudit.count({
            where: {
              entityId: disposable.id,
              action: "DELETE",
              actorId: admin.id,
            },
          }),
        )
      },
    )
    await t.test(
      "[PG-008-F001-A003-T001] policy directory search matches names and timezones case-insensitively",
      async () => {
        const fixtures = [
          {
            name: "PG008 Search Alpha flex",
            timeZone: "Asia/Manila",
          },
          {
            name: "PG008 Search Beta fixed",
            timeZone: "America/New_York",
          },
          {
            name: "PG008 Search Gamma",
            timeZone: "UTC",
          },
        ]
        for (const fixture of fixtures) {
          const response = await request("/policies", "POST", {
            ...input,
            ...fixture,
          })
          assert.equal(response.status, 201, await response.clone().text())
        }

        async function searchPolicies(value: string) {
          const response = await request(
            `/policies?page=1&size=10&status=active&search=${encodeURIComponent(value)}`,
          )
          return {
            response,
            body: (await response.json()) as {
              total: number
              policies: { name: string; timeZone: string }[]
            },
          }
        }
        const byName = await searchPolicies("alpha")
        assert.equal(byName.response.status, 200)
        assert.equal(byName.body.total, 1)
        assert.deepEqual(
          byName.body.policies.map(({ name }) => name),
          ["PG008 Search Alpha flex"],
        )
        const byZone = await searchPolicies("AMERICA/NEW_YORK")
        assert.equal(byZone.response.status, 200)
        assert.equal(byZone.body.total, 1)
        assert.deepEqual(
          byZone.body.policies.map(({ timeZone }) => timeZone),
          ["America/New_York"],
        )
        const trimmed = await searchPolicies("  PG008 Search Gamma  ")
        assert.equal(trimmed.response.status, 200)
        assert.equal(trimmed.body.total, 1)
        assert.equal(trimmed.body.policies[0].name, "PG008 Search Gamma")
        const overLimit = await request(`/policies?search=${"x".repeat(101)}`)
        assert.equal(overLimit.status, 400)
      },
    )

    await t.test(
      "[PG-008-F001-A005-T001] policy directory pages ten rows in stable created-date order",
      async () => {
        const pageFixtures: { id: string; name: string }[] = []
        for (let index = 0; index < 11; index += 1) {
          const name = `PG008 pagination ${String(index).padStart(2, "0")}`
          const createdAt = new Date(Date.UTC(2026, 10, 1, 0, index, 0))
          const createdPolicy = await prisma.attendancePolicy.create({
            data: {
              name,
              timeZone: "UTC",
              createdAt,
              days: { create: input.days },
            },
          })
          pageFixtures.push({ id: createdPolicy.id, name })
        }
        async function loadPage(page: number) {
          const response = await request(
            `/policies?page=${page}&size=10&status=active&search=PG008%20pagination`,
          )
          assert.equal(response.status, 200)
          return (await response.json()) as {
            total: number
            page: number
            pageSize: number
            policies: { id: string; name: string }[]
          }
        }
        const first = await loadPage(1)
        const second = await loadPage(2)
        const expected = pageFixtures.slice().reverse()
        assert.deepEqual([first.total, first.page, first.pageSize], [11, 1, 10])
        assert.deepEqual(
          [second.total, second.page, second.pageSize],
          [11, 2, 10],
        )
        assert.deepEqual(
          first.policies.map(({ id, name }) => ({ id, name })),
          expected.slice(0, 10),
        )
        assert.deepEqual(
          second.policies.map(({ id, name }) => ({ id, name })),
          expected.slice(10),
        )
        assert.equal(
          new Set([...first.policies, ...second.policies].map(({ id }) => id))
            .size,
          11,
        )
      },
    )

    await t.test(
      "[PG-008-F001-A012-T002] policy API enforces name and minute boundaries without partial writes",
      async () => {
        const validPayload = (name: string, firstDayMinutes: number) => ({
          ...input,
          name,
          days: input.days.map((day, index) => ({
            ...day,
            requiredMinutes: index === 0 ? firstDayMinutes : 480,
          })),
        })
        const maxName = "P".repeat(100)
        const maxNameResponse = await request(
          "/policies",
          "POST",
          validPayload(maxName, 0),
        )
        assert.equal(
          maxNameResponse.status,
          201,
          await maxNameResponse.clone().text(),
        )
        const maxMinutesResponse = await request(
          "/policies",
          "POST",
          validPayload("PG008 1440-minute boundary", 1440),
        )
        assert.equal(
          maxMinutesResponse.status,
          201,
          await maxMinutesResponse.clone().text(),
        )

        const policyCount = await prisma.attendancePolicy.count()
        const dayCount = await prisma.attendancePolicyDay.count()
        const invalidPayloads = [
          { ...validPayload("P".repeat(101), 480) },
          { ...validPayload("   ", 480) },
          { ...validPayload("PG008 minute above maximum", 1441) },
          { ...validPayload("PG008 fractional minute", 10.5) },
        ]
        for (const payload of invalidPayloads) {
          const response = await request("/policies", "POST", payload)
          assert.equal(response.status, 400, await response.text())
          assert.equal(await prisma.attendancePolicy.count(), policyCount)
          assert.equal(await prisma.attendancePolicyDay.count(), dayCount)
        }
      },
    )

    await t.test(
      "[PG-008-F001-A015-T002] assignment API rejects invalid identifiers, bodies, and past dates without writes",
      async () => {
        const fixtureEmployee = await prisma.employee.create({
          data: {
            employeeId: "POLICY-INVALID-001",
            fullName: "Assignment validation employee",
          },
        })
        const future = {
          employeeId: fixtureEmployee.id,
          policyId: policy.id,
          effectiveFrom: "2026-11-16",
        }
        const assignmentsBefore =
          await prisma.attendancePolicyAssignment.count()
        const auditBefore = await prisma.attendanceAudit.count()
        const rejected = [
          { status: 400, body: { ...future, employeeId: "!" } },
          { status: 400, body: { ...future, effectiveFrom: "2026-99-99" } },
          {
            status: 404,
            body: { ...future, employeeId: "missing-employee" },
          },
          { status: 404, body: { ...future, policyId: "missing-policy" } },
          { status: 400, body: { ...future, unsupported: true } },
          {
            status: 400,
            body: { ...future, effectiveFrom: "2026-11-12" },
          },
        ]
        for (const item of rejected) {
          const response = await request("/assignments", "POST", item.body)
          assert.equal(response.status, item.status, await response.text())
          assert.equal(
            await prisma.attendancePolicyAssignment.count(),
            assignmentsBefore,
          )
          assert.equal(await prisma.attendanceAudit.count(), auditBefore)
        }
      },
    )

    for (const transition of [
      {
        outgoingZone: "Asia/Manila",
        incomingZone: "UTC",
        before: "2026-11-24T07:59:59.999+08:00",
        cutoff: "2026-11-24T08:00:00.000+08:00",
      },
      {
        outgoingZone: "UTC",
        incomingZone: "Asia/Manila",
        before: "2026-11-23T23:59:59.999+08:00",
        cutoff: "2026-11-24T00:00:00.000+08:00",
      },
    ]) {
      await t.test(
        `clock-in follows a single cutoff from ${transition.outgoingZone} to ${transition.incomingZone}`,
        async () => {
          now = new Date("2026-11-22T12:00:00+08:00")
          const worker = await prisma.user.create({
            data: {
              email: `${transition.outgoingZone === "UTC" ? "utc" : "manila"}-worker@test.example`,
              passwordHash: "test-only",
              role: "STAFF",
            },
          })
          const profile = await prisma.employee.create({
            data: {
              employeeId: `HANDOFF-${worker.id}`,
              fullName: "Handoff employee",
              userId: worker.id,
            },
          })
          const token = (await issueSession(worker)).token

          async function assign(
            name: string,
            timeZone: string,
            effectiveFrom: string,
            requiredMinutes = 480,
          ) {
            const created = await request("/policies", "POST", {
              ...input,
              name,
              timeZone,
              days: input.days.map((day) => ({ ...day, requiredMinutes })),
            })
            assert.equal(created.status, 201, await created.clone().text())
            const { policy } = (await created.json()) as {
              policy: { id: string }
            }
            const assigned = await request("/assignments", "POST", {
              employeeId: profile.id,
              policyId: policy.id,
              effectiveFrom,
            })
            assert.equal(assigned.status, 201, await assigned.text())
            return policy.id
          }

          const outgoing = await assign(
            "Outgoing policy",
            transition.outgoingZone,
            "2026-11-22",
          )
          const incoming = await assign(
            "Incoming policy",
            transition.incomingZone,
            "2026-11-24",
            360,
          )

          async function expectAssignmentStatus(
            policyId: string,
            status: string,
          ) {
            const response = await request(`/policies/${policyId}/assignments`)
            assert.equal(response.status, 200, await response.clone().text())
            const { assignments } = (await response.json()) as {
              assignments: { status: string }[]
            }
            assert.equal(assignments[0].status, status)
          }

          async function expectWorkday(
            response: Response,
            status: number,
            policyId: string,
            date: string,
          ) {
            assert.equal(response.status, status, await response.clone().text())
            const { workday } = (await response.json()) as {
              workday: {
                workDate: string
                policy: { id: string }
                activeSessionId: string
              }
            }
            assert.equal(
              workday.policy.id,
              policyId,
              `Policy at ${now.toISOString()}`,
            )
            assert.equal(workday.workDate, date)
            return workday.activeSessionId
          }

          const justBefore = new Date(transition.before).getTime()
          now = new Date(justBefore - 2)
          const firstSession = await expectWorkday(
            await request("/me/clock-in", "POST", {}, token),
            201,
            outgoing,
            "2026-11-23",
          )
          const { workdayId } =
            await prisma.attendanceWorkSession.findUniqueOrThrow({
              where: { id: firstSession },
            })
          now = new Date(justBefore - 1)
          await expectWorkday(
            await request(
              "/me/clock-out",
              "POST",
              { sessionId: firstSession },
              token,
            ),
            200,
            outgoing,
            "2026-11-23",
          )
          now = new Date(justBefore)
          await expectAssignmentStatus(outgoing, "CURRENT")
          await expectAssignmentStatus(incoming, "SCHEDULED")
          await expectWorkday(
            await request("/me/current", "GET", undefined, token),
            200,
            outgoing,
            "2026-11-23",
          )
          const sessionId = await expectWorkday(
            await request("/me/clock-in", "POST", { workdayId }, token),
            201,
            outgoing,
            "2026-11-23",
          )

          now = new Date(transition.cutoff)
          await expectAssignmentStatus(outgoing, "ENDED")
          await expectAssignmentStatus(incoming, "CURRENT")
          await expectWorkday(
            await request("/me/clock-out", "POST", { sessionId }, token),
            200,
            outgoing,
            "2026-11-23",
          )
          const current = await request("/me/current", "GET", undefined, token)
          await expectWorkday(current.clone(), 200, incoming, "2026-11-24")
          const readWrites = async () => ({
            sessions: await prisma.attendanceWorkSession.findMany({
              where: { employeeId: profile.id },
              orderBy: { id: "asc" },
            }),
            audit: await prisma.attendanceAudit.findMany({
              where: { employeeId: profile.id },
              orderBy: { id: "asc" },
            }),
          })
          const before = await readWrites()
          const stale = await request(
            "/me/clock-in",
            "POST",
            { workdayId },
            token,
          )
          assert.equal(stale.status, 409, await stale.clone().text())
          assert.deepEqual(await readWrites(), before)
          const { continuation } = (await current.json()) as {
            continuation: unknown
          }
          assert.equal(continuation, null)

          const incomingSession = await expectWorkday(
            await request("/me/clock-in", "POST", {}, token),
            201,
            incoming,
            "2026-11-24",
          )
          now = new Date(new Date(transition.cutoff).getTime() + 7 * 3600000)
          await expectWorkday(
            await request(
              "/me/clock-out",
              "POST",
              { sessionId: incomingSession },
              token,
            ),
            200,
            incoming,
            "2026-11-24",
          )
          const history = await request(
            "/me/history?from=2026-11-23&to=2026-11-24",
            "GET",
            undefined,
            token,
          )
          assert.equal(history.status, 200)
          const { workdays } = (await history.json()) as {
            workdays: {
              workDate: string
              policy: { id: string }
              requiredMinutes: number
              sessions: { id: string }[]
            }[]
          }
          assert.deepEqual(
            workdays.map((day) => [
              day.workDate,
              day.policy.id,
              day.requiredMinutes,
              day.sessions.map(({ id }) => id),
            ]),
            [
              ["2026-11-24", incoming, 360, [incomingSession]],
              ["2026-11-23", outgoing, 480, [firstSession, sessionId]],
            ],
          )
          const overtime = await prisma.attendanceAdjustment.findMany({
            where: { employeeId: profile.id },
            select: { sessionId: true, type: true, overtimeMinutes: true },
          })
          assert.deepEqual(overtime, [
            {
              sessionId: incomingSession,
              type: "OVERTIME",
              overtimeMinutes: 60,
            },
          ])
        },
      )
    }
  },
)
