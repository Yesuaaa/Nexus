import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { ManagementContext } from "./context.js"

/** Audit search, monitoring scope and stale corrections. */
export async function auditAndMonitoring(
  t: TestContext,
  {
    prisma,
    staff,
    admin,
    other,
    request,
    head,
    department,
    outside,
    superadmin,
    submit,
    session,
  }: ManagementContext,
) {
  await t.test(
    "attendance audit search covers scoped event and identity fields before pagination",
    async () => {
      await prisma.attendanceAudit.createMany({
        data: [
          ...Array.from({ length: 12 }, (_, index) => ({
            entityType: "AttendanceWorkSession",
            entityId: `searchable-${index}`,
            employeeId: staff.employee.id,
            actorId: admin.user.id,
            action: "SEARCHABLE_ACTION",
            reason: `SeriesNeedle ${index}`,
            actionId: randomUUID(),
            createdAt: new Date(
              `2026-11-13T12:${String(index).padStart(2, "0")}:00Z`,
            ),
          })),
          {
            entityType: "AttendanceWorkSession",
            entityId: "searchable-outside",
            employeeId: other.employee.id,
            actorId: admin.user.id,
            action: "SEARCHABLE_ACTION",
            reason: "SeriesNeedle outside department",
            actionId: randomUUID(),
            createdAt: new Date("2026-11-13T12:30:00Z"),
          },
          {
            entityType: "AttendanceWorkSession",
            entityId: "searchable-next-day",
            employeeId: staff.employee.id,
            actorId: admin.user.id,
            action: "SEARCHABLE_ACTION",
            reason: "SeriesNeedle next day",
            actionId: randomUUID(),
            createdAt: new Date("2026-11-14T12:00:00Z"),
          },
        ],
      })
      const dateQuery = "from=2026-11-13&to=2026-11-13"
      for (const term of [
        "staff",
        "MGMT-staff",
        "admin",
        "admin@management.test",
        admin.user.id,
        "SEARCHABLE_ACTION",
        "AttendanceWorkSession",
        "Needle",
      ]) {
        const response = await request(
          head,
          `/audit?${dateQuery}&search=${encodeURIComponent(term)}`,
        )
        assert.equal(response.status, 200, await response.clone().text())
        const result = (await response.json()) as {
          total: number
          events: {
            actor: Record<string, unknown> | null
            employee: Record<string, unknown> | null
          }[]
        }
        assert.equal(result.total, 12, `search term: ${term}`)
        assert.equal(result.events.length, 10, `search term: ${term}`)
        assert.deepEqual(Object.keys(result.events[0]!.actor ?? {}), [
          "fullName",
        ])
        assert.deepEqual(Object.keys(result.events[0]!.employee ?? {}), [
          "fullName",
        ])
      }

      const firstPage = (await (
        await request(head, `/audit?${dateQuery}&search=SeriesNeedle`)
      ).json()) as {
        total: number
        page: number
        pageSize: number
        events: unknown[]
        actionCounts: { count: number }[]
      }
      const secondPageResponse = await request(
        head,
        `/audit?${dateQuery}&search=SeriesNeedle&page=2`,
      )
      assert.equal(secondPageResponse.status, 200)
      const secondPage = (await secondPageResponse.json()) as {
        total: number
        page: number
        events: unknown[]
        actionCounts: { count: number }[]
      }
      assert.equal(firstPage.total, 12)
      assert.equal(firstPage.page, 1)
      assert.equal(firstPage.pageSize, 10)
      assert.equal(firstPage.events.length, 10)
      assert.equal(secondPage.total, 12)
      assert.equal(secondPage.page, 2)
      assert.equal(secondPage.events.length, 2)
      assert.equal(
        firstPage.actionCounts.reduce((sum, row) => sum + row.count, 0),
        12,
      )
      const scopedAdmin = await request(
        admin,
        `/audit?${dateQuery}&departmentId=${department.id}&search=SeriesNeedle`,
      )
      assert.equal(scopedAdmin.status, 200)
      assert.equal(((await scopedAdmin.json()) as { total: number }).total, 12)
      const unrestrictedAdmin = await request(
        admin,
        `/audit?${dateQuery}&search=SeriesNeedle`,
      )
      assert.equal(unrestrictedAdmin.status, 200)
      assert.equal(
        ((await unrestrictedAdmin.json()) as { total: number }).total,
        13,
      )
      assert.equal(
        (
          await request(
            head,
            `/audit?${dateQuery}&departmentId=${outside.id}&search=SeriesNeedle`,
          )
        ).status,
        403,
      )
      const missing = await request(
        head,
        `/audit?${dateQuery}&search=does-not-exist`,
      )
      assert.equal(missing.status, 200)
      assert.equal(((await missing.json()) as { total: number }).total, 0)

      // PG-005-F001-A010-T017: UTC interval, stable tie order, and projection.
      const boundaryEvent = (id: string, createdAt: string) => ({
        id,
        entityType: "AttendanceWorkSession",
        entityId: id,
        employeeId: staff.employee.id,
        actorId: admin.user.id,
        action: "BOUNDARY_CHECK",
        reason: "BoundaryMarker",
        actionId: randomUUID(),
        createdAt: new Date(createdAt),
        operationId: randomUUID(),
        correlationId: randomUUID(),
        actorRoleAtTime: "ADMIN" as const,
      })
      await prisma.attendanceAudit.createMany({
        data: [
          boundaryEvent("boundary-start", "2026-11-13T00:00:00.000Z"),
          boundaryEvent("boundary-tie-a", "2026-11-13T12:00:00.000Z"),
          boundaryEvent("boundary-tie-z", "2026-11-13T12:00:00.000Z"),
          boundaryEvent("boundary-end", "2026-11-13T23:59:59.999Z"),
          boundaryEvent("boundary-outside", "2026-11-14T00:00:00.000Z"),
        ],
      })
      const boundaryResponse = await request(
        head,
        "/audit?from=2026-11-13&to=2026-11-13&search=BoundaryMarker",
      )
      assert.equal(boundaryResponse.status, 200)
      const boundaryResult = (await boundaryResponse.json()) as {
        total: number
        events: {
          id: string
          operationId?: unknown
          correlationId?: unknown
          actorRoleAtTime?: unknown
          actor: Record<string, unknown> | null
          employee: Record<string, unknown> | null
        }[]
      }
      assert.equal(boundaryResult.total, 4)
      assert.deepEqual(
        boundaryResult.events.map((event) => event.id),
        ["boundary-end", "boundary-tie-z", "boundary-tie-a", "boundary-start"],
      )
      const projected = boundaryResult.events.find(
        (event) => event.id === "boundary-tie-z",
      )
      assert.ok(projected)
      assert.equal("operationId" in projected, false)
      assert.equal("correlationId" in projected, false)
      assert.equal("actorRoleAtTime" in projected, false)
      assert.deepEqual(Object.keys(projected.actor ?? {}), ["fullName"])
      assert.deepEqual(Object.keys(projected.employee ?? {}), ["fullName"])
    },
  )

  await t.test(
    "monitoring filters and audit trails enforce company and department scope",
    async () => {
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId: other.employee.id,
          startedAt: new Date("2026-11-13T09:00:00+08:00"),
          endedAt: new Date("2026-11-13T17:00:00+08:00"),
        },
      })
      assert.equal((await request(staff, "/records")).status, 403)
      assert.equal((await request(staff, "/audit")).status, 403)
      assert.equal((await request(staff, "/departments")).status, 403)
      assert.equal(
        (await request(head, `/records?departmentId=${outside.id}`)).status,
        403,
      )
      assert.equal(
        (await request(head, `/employees?departmentId=${outside.id}`)).status,
        403,
      )
      assert.equal(
        (await request(head, `/audit?departmentId=${outside.id}`)).status,
        403,
      )
      assert.equal(
        (await request(head, `/records?employeeId=${other.employee.id}`))
          .status,
        404,
      )
      const response = await request(
        admin,
        `/records?departmentId=${outside.id}&from=2026-11-13&to=2026-11-13`,
      )
      assert.equal(response.status, 200)
      const result = (await response.json()) as {
        total: number
        workdays: { employee: { id: string }; workedHours: number }[]
      }
      assert.equal(result.total, 1)
      assert.equal(result.workdays[0].employee.id, other.employee.id)
      assert.equal(result.workdays[0].workedHours, 8)
      assert.equal(
        (
          await request(
            admin,
            `/records?employeeId=${other.employee.id}&departmentId=${department.id}`,
          )
        ).status,
        404,
      )
      const choices = (await (await request(head, "/departments")).json()) as {
        departments: { id: string }[]
      }
      assert.deepEqual(
        choices.departments.map((item) => item.id),
        [department.id],
      )
      const trail = (await (await request(head, "/audit")).json()) as {
        total: number
        pageSize: number
        events: {
          employeeId: string
          entityType: string
          action: string
          before: unknown
          after: unknown
        }[]
      }
      const auditEvents = [...trail.events]
      for (
        let page = 2;
        page <= Math.ceil(trail.total / trail.pageSize);
        page += 1
      ) {
        const pageResponse = await request(head, `/audit?page=${page}`)
        assert.equal(pageResponse.status, 200)
        auditEvents.push(
          ...((await pageResponse.json()) as typeof trail).events,
        )
      }
      assert.ok(auditEvents.length)
      assert.ok(
        auditEvents.every((entry) => entry.employeeId !== other.employee.id),
      )
      assert.equal(
        (await request(admin, "/records?departmentId[]=invalid")).status,
        400,
      )
    },
  )

  await t.test(
    "stale corrections cannot overwrite intervening punches or head handoffs",
    async () => {
      // Resolve the OT automatically submitted by the earlier approved corrections.
      const overtime = await prisma.attendanceAdjustment.findMany({
        where: {
          employeeId: staff.employee.id,
          type: "OVERTIME",
          status: "PENDING",
        },
      })
      for (const item of overtime) {
        assert.equal(
          (
            await request(superadmin, `/adjustments/${item.id}/review`, {
              decision: "REJECTED",
              note: "Resolve overtime before correcting attendance",
            })
          ).status,
          200,
        )
      }
      const correction = await submit(
        staff,
        session.id,
        "2026-11-13T19:00:00+08:00",
      )
      const monitoring = await request(
        head,
        "/records?from=2026-11-13&to=2026-11-13",
      )
      assert.equal(
        (
          (await monitoring.json()) as {
            workdays: { pendingCorrections: number }[]
          }
        ).workdays[0].pendingCorrections,
        1,
      )
      await prisma.attendanceWorkSession.update({
        where: { id: session.id },
        data: { endedAt: new Date("2026-11-13T18:30:00+08:00") },
      })
      assert.equal(
        (
          await request(
            head,
            `/adjustments/${correction.adjustment.id}/review`,
            { decision: "APPROVED", note: "Stale proposal review" },
          )
        ).status,
        409,
      )
      await prisma.department.update({
        where: { id: department.id },
        data: { headId: null },
      })
      assert.equal(
        (await request(head, `/employees/${staff.employee.id}/history`)).status,
        403,
      )
      assert.equal((await request(head, "/adjustments?scope=team")).status, 403)
      assert.equal((await request(head, "/records")).status, 403)
      assert.equal((await request(head, "/audit")).status, 403)
      assert.equal(
        (
          await request(
            head,
            `/adjustments/${correction.adjustment.id}/review`,
            { decision: "REJECTED", note: "Former head decision" },
          )
        ).status,
        403,
      )
    },
  )
}
