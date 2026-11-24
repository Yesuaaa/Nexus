import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "pending correction notifications follow current review authority",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base, db } = await startPgliteApp(t, {
      app: { attendanceClock: () => new Date("2026-11-14T12:00:00+08:00") },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Correction notice policy",
        timeZone: "Asia/Manila",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: true,
            requiredMinutes: 480,
          })),
        },
      },
    })

    async function account(name: string, role: Role, departmentId?: string) {
      const { user, employee } = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: `${name}@correction-notices.test`,
            passwordHash: "test-only",
            role,
            departmentId,
          },
        })
        const employee = await tx.employee.create({
          data: {
            userId: user.id,
            fullName: name,
            employeeId: `NOTICE-${name}`,
            departmentId,
          },
        })
        if (role === "STAFF")
          await tx.attendancePolicyAssignment.create({
            data: {
              employeeId: employee.id,
              policyId: policy.id,
              effectiveFrom: new Date("2026-01-01"),
            },
          })
        return { user, employee }
      })
      return { user, employee, token: (await issueSession(user)).token }
    }
    const hr = await account("hr", "ADMIN")
    const superadmin = await account("superadmin", "SUPERADMIN")
    const pendingType = "ATTENDANCE_CORRECTION_PENDING"
    type Actor = typeof hr
    type Notice = {
      id: string
      type: string
      entityId: string
      readAt: string | null
      createdAt: string
    }

    function call(actor: Actor, path: string, method = "GET", body?: object) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${actor.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
    }
    async function expectStatus(response: Response, status: number) {
      assert.equal(response.status, status, await response.clone().text())
    }
    async function head(
      departmentId: string,
      actor: Actor | null,
      status = 200,
    ) {
      await expectStatus(
        await call(hr, `/departments/${departmentId}`, "PUT", {
          headId: actor?.user.id ?? null,
        }),
        status,
      )
    }
    async function team(name: string) {
      const department = await prisma.department.create({ data: { name } })
      const subject = await account(`${name}-subject`, "STAFF", department.id)
      const original = await account(`${name}-original`, "STAFF", department.id)
      const replacement = await account(
        `${name}-replacement`,
        "STAFF",
        department.id,
      )
      await head(department.id, original)
      return { department, subject, original, replacement }
    }
    async function submit(actor: Actor, hour = "09") {
      const response = await call(actor, "/attendance/adjustments", "POST", {
        requestKey: randomUUID(),
        startedAt: `2026-11-13T${hour}:00:00+08:00`,
        endedAt: `2026-11-13T${hour}:30:00+08:00`,
        reason: "Record a missing shift for notification routing",
      })
      await expectStatus(response, 201)
      const { adjustment } = (await response.json()) as {
        adjustment: { id: string }
      }
      return adjustment.id
    }
    const detailPath = (id: string) => `/attendance/adjustments/${id}`
    const inboxPath = "/request-workflows/notifications"
    function markRead(actor: Actor, id: string) {
      return call(actor, `${inboxPath}/${id}/read`, "PATCH")
    }
    async function review(actor: Actor, id: string) {
      return call(actor, `${detailPath(id)}/review`, "POST", {
        decision: "APPROVED",
        note: "Confirmed recorded working time",
      })
    }
    async function pendingInbox(actor: Actor, id: string) {
      const response = await call(actor, inboxPath)
      await expectStatus(response, 200)
      const { notifications, unreadCount } = (await response.json()) as {
        notifications: Notice[]
        unreadCount: number
      }
      assert.equal(
        unreadCount,
        notifications.filter((item) => item.readAt === null).length,
      )
      return notifications.filter(
        (item) => item.entityId === id && item.type === pendingType,
      )
    }
    async function pendingNotice(actor: Actor, id: string) {
      const notices = await pendingInbox(actor, id)
      assert.equal(notices.length, 1)
      return notices[0]
    }
    async function queue(
      actor: Actor,
      id: string,
      expected: "HEAD" | "HR" | "HIDDEN",
      count: number,
    ) {
      const detail = await call(actor, detailPath(id))
      await expectStatus(detail, expected === "HIDDEN" ? 404 : 200)
      if (expected !== "HIDDEN") {
        const { adjustment } = (await detail.json()) as {
          adjustment: {
            capabilities: { approve: boolean; verify: boolean; reject: boolean }
          }
        }
        assert.deepEqual(adjustment.capabilities, {
          approve: expected === "HR",
          verify: expected === "HEAD",
          reject: true,
        })
      }
      const list = await call(
        actor,
        "/attendance/adjustments?scope=team&type=CORRECTION&status=PENDING",
      )
      const counts = await call(
        actor,
        "/attendance/adjustments/overview?scope=team",
      )
      // A former Head may lose the team scope altogether.
      if (count === 0 && list.status === 403) {
        await expectStatus(counts, 403)
        return
      }
      await expectStatus(list, 200)
      await expectStatus(counts, 200)
      const { adjustments, total } = (await list.json()) as {
        adjustments: { id: string }[]
        total: number
      }
      assert.equal(
        adjustments.some((item) => item.id === id),
        expected !== "HIDDEN",
      )
      assert.equal(total, count)
      const { groups } = (await counts.json()) as {
        groups: {
          type: string
          status: string
          count: number
          awaitingHrPending: number
        }[]
      }
      const group = groups.find(
        ({ type, status }) => type === "CORRECTION" && status === "PENDING",
      )
      assert.equal(group?.count ?? 0, count)
      assert.equal(group?.awaitingHrPending ?? 0, expected === "HR" ? count : 0)
    }
    async function state(id: string) {
      return {
        request: await prisma.attendanceAdjustment.findUniqueOrThrow({
          where: { id },
        }),
        audit: await prisma.attendanceAudit.findMany({
          where: { entityId: id },
          orderBy: { id: "asc" },
        }),
      }
    }
    async function notices(id: string) {
      return prisma.workflowNotification.findMany({
        where: { attendanceAdjustmentId: id, type: pendingType },
        orderBy: { id: "asc" },
      })
    }

    await t.test(
      "same-department replacement preserves read notices and decisions",
      async () => {
        const { department, subject, original, replacement } =
          await team("replacement")
        const id = await submit(subject)
        const before = await state(id)
        await queue(original, id, "HEAD", 1)
        await queue(hr, id, "HIDDEN", 0)
        const oldNotice = await pendingNotice(original, id)
        await expectStatus(await markRead(original, oldNotice.id), 200)
        const historical = await pendingNotice(original, id)
        assert.ok(historical.readAt)
        const oversightNotice = await pendingNotice(superadmin, id)
        await expectStatus(await markRead(superadmin, oversightNotice.id), 200)
        const oversight = await pendingNotice(superadmin, id)
        await head(department.id, replacement)
        await queue(replacement, id, "HEAD", 1)
        await queue(original, id, "HIDDEN", 0)
        await queue(hr, id, "HIDDEN", 0)
        const current = await pendingNotice(replacement, id)
        assert.equal(current.readAt, null)
        assert.deepEqual(await pendingInbox(original, id), [])
        assert.deepEqual(await pendingInbox(hr, id), [])
        const rows = await notices(id)
        await expectStatus(await markRead(original, oldNotice.id), 404)
        await expectStatus(
          await call(original, `${inboxPath}/read-all`, "PATCH"),
          200,
        )
        await expectStatus(await review(original, id), 403)
        assert.deepEqual(await notices(id), rows)
        await head(department.id, replacement)
        assert.deepEqual(await notices(id), rows)
        await head(department.id, original)
        assert.deepEqual(await pendingNotice(original, id), historical)
        assert.deepEqual(await pendingNotice(superadmin, id), oversight)
        assert.deepEqual(await pendingInbox(replacement, id), [])
        assert.equal((await notices(id)).length, 3)
        assert.deepEqual(await state(id), before)

        const verificationBefore = await state(id)
        const noticesBefore = await notices(id)
        await db.exec(`
          CREATE FUNCTION fail_correction_verification_notice() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF NEW.type = 'ATTENDANCE_CORRECTION_VERIFIED' THEN
              RAISE EXCEPTION 'Synthetic correction verification notice failure';
            END IF;
            RETURN NEW;
          END $$;
          CREATE TRIGGER fail_correction_verification_notice
          BEFORE INSERT ON "WorkflowNotification"
          FOR EACH ROW EXECUTE FUNCTION fail_correction_verification_notice();
        `)
        try {
          await expectStatus(await review(original, id), 500)
        } finally {
          await db.exec(
            'DROP TRIGGER fail_correction_verification_notice ON "WorkflowNotification"; DROP FUNCTION fail_correction_verification_notice();',
          )
        }
        assert.deepEqual(await state(id), verificationBefore)
        assert.deepEqual(await notices(id), noticesBefore)
        assert.equal(
          await prisma.workflowNotification.count({
            where: {
              attendanceAdjustmentId: id,
              type: "ATTENDANCE_CORRECTION_VERIFIED",
            },
          }),
          0,
        )

        await expectStatus(await review(original, id), 200)
        const verified = await state(id)
        assert.equal(verified.request.status, "VERIFIED")
        assert.equal(
          verified.audit.filter(
            ({ entityType, entityId }) =>
              entityType === "AttendanceAdjustment" && entityId === id,
          ).length,
          2,
        )
        assert(
          verified.audit.some(
            ({ action, actorId }) =>
              action === "INSERT" && actorId === subject.user.id,
          ),
        )
        assert(
          verified.audit.some(
            ({ action, actorId }) =>
              action === "UPDATE" && actorId === original.user.id,
          ),
        )
        assert(
          (await prisma.workflowNotification.count({
            where: {
              attendanceAdjustmentId: id,
              type: "ATTENDANCE_CORRECTION_VERIFIED",
            },
          })) > 0,
        )
        await expectStatus(await review(hr, id), 200)
      },
    )

    await t.test(
      "removing and restoring a Head activates and withdraws HR fallback",
      async () => {
        const { department, subject, original } = await team("removal")
        const id = await submit(subject)
        const before = await state(id)
        await head(department.id, null)
        await queue(hr, id, "HR", 1)
        await queue(original, id, "HIDDEN", 0)
        const fallback = await pendingNotice(hr, id)
        assert.equal(fallback.readAt, null)
        await expectStatus(await markRead(hr, fallback.id), 200)
        const read = await pendingNotice(hr, id)
        assert.ok(read.readAt)
        await head(department.id, original)
        await queue(hr, id, "HIDDEN", 0)
        assert.deepEqual(await pendingInbox(hr, id), [])
        const rows = await notices(id)
        await expectStatus(await markRead(hr, fallback.id), 404)
        await expectStatus(
          await call(hr, `${inboxPath}/read-all`, "PATCH"),
          200,
        )
        await expectStatus(await review(hr, id), 403)
        assert.deepEqual(await notices(id), rows)
        await head(department.id, null)
        assert.deepEqual(await pendingNotice(hr, id), read)
        assert.deepEqual(await state(id), before)
        await expectStatus(await review(hr, id), 200)
      },
    )

    await t.test(
      "Head login status and temporary self-Head handoff reroute only pending notices",
      async () => {
        const { subject, original, replacement } = await team("lifecycle")
        const id = await submit(subject)
        const verified = await submit(subject, "10")
        await expectStatus(await review(original, verified), 200)
        const initial = await state(id)
        const verifiedState = await state(verified)
        const verifiedNotices = await notices(verified)
        const initialHeadNotice = await pendingNotice(original, id)
        await expectStatus(await markRead(original, initialHeadNotice.id), 200)
        const read = await pendingNotice(original, id)
        await expectStatus(
          await call(superadmin, `/users/${original.user.id}/status`, "PATCH", {
            isActive: false,
          }),
          200,
        )
        await expectStatus(await call(original, detailPath(id)), 401)
        await expectStatus(await markRead(original, read.id), 401)
        await queue(hr, id, "HR", 1)
        const fallback = await pendingNotice(hr, id)
        await expectStatus(await markRead(hr, fallback.id), 200)
        const fallbackRead = await pendingNotice(hr, id)
        await expectStatus(
          await call(superadmin, `/users/${original.user.id}/status`, "PATCH", {
            isActive: true,
          }),
          200,
        )
        original.token = (await issueSession(original.user)).token
        await queue(original, id, "HEAD", 1)
        assert.deepEqual(await pendingNotice(original, id), read)
        await queue(hr, id, "HIDDEN", 0)
        await expectStatus(await markRead(hr, fallback.id), 404)

        await expectStatus(
          await call(hr, `/employees/${original.employee.id}`, "PUT", {
            status: "ON_LEAVE",
            replacementHeadEmployeeId: replacement.employee.id,
          }),
          200,
        )
        await queue(replacement, id, "HEAD", 1)
        assert.equal((await pendingNotice(replacement, id)).readAt, null)
        await queue(original, id, "HIDDEN", 0)
        await expectStatus(
          await call(hr, `/employees/${original.employee.id}`, "PUT", {
            status: "ACTIVE",
          }),
          200,
        )
        await queue(replacement, id, "HIDDEN", 0)
        await expectStatus(
          await call(hr, `/employees/${original.employee.id}`, "PUT", {
            status: "ON_LEAVE",
            replacementHeadEmployeeId: subject.employee.id,
          }),
          200,
        )
        await queue(hr, id, "HR", 1)
        assert.deepEqual(await pendingNotice(hr, id), fallbackRead)
        assert.deepEqual(await pendingInbox(subject, id), [])
        await expectStatus(await review(subject, id), 403)
        await expectStatus(
          await call(hr, `/employees/${original.employee.id}`, "PUT", {
            status: "ACTIVE",
          }),
          200,
        )
        await queue(hr, id, "HIDDEN", 0)
        assert.deepEqual(await pendingNotice(original, id), read)
        assert.deepEqual(await state(id), initial)
        assert.deepEqual(await state(verified), verifiedState)
        assert.deepEqual(await notices(verified), verifiedNotices)
        await expectStatus(await review(original, id), 200)
        await expectStatus(await review(hr, id), 200)
      },
    )

    await t.test(
      "transfers preserve read state until a verified correction reopens",
      async () => {
        const origin = await team("transfer-origin")
        const destination = await team("transfer-destination")
        const id = await submit(origin.subject)
        const initial = await state(id)
        const originalNotice = await pendingNotice(origin.original, id)
        await expectStatus(
          await markRead(origin.original, originalNotice.id),
          200,
        )
        const originalRead = await pendingNotice(origin.original, id)
        const oversightNotice = await pendingNotice(superadmin, id)
        await expectStatus(await markRead(superadmin, oversightNotice.id), 200)
        const oversightRead = await pendingNotice(superadmin, id)
        async function move(departmentId: string) {
          await expectStatus(
            await call(hr, `/employees/${origin.subject.employee.id}`, "PUT", {
              departmentId,
            }),
            200,
          )
        }
        await move(destination.department.id)
        await queue(origin.original, id, "HIDDEN", 0)
        await queue(destination.original, id, "HEAD", 1)
        const incoming = await pendingNotice(destination.original, id)
        assert.equal(incoming.readAt, null)
        await expectStatus(
          await markRead(destination.original, incoming.id),
          200,
        )
        await expectStatus(
          await markRead(origin.original, originalNotice.id),
          404,
        )
        await expectStatus(await review(origin.original, id), 404)
        await move(origin.department.id)
        assert.deepEqual(await pendingNotice(origin.original, id), originalRead)
        assert.deepEqual(await pendingNotice(superadmin, id), oversightRead)
        assert.deepEqual(await state(id), initial)

        await expectStatus(await review(origin.original, id), 200)
        const verified = await state(id)
        assert.equal(verified.request.status, "VERIFIED")
        assert.equal(
          verified.request.verifiedDepartmentId,
          origin.department.id,
        )
        await move(destination.department.id)
        const reopened = await state(id)
        assert.equal(reopened.request.status, "PENDING")
        assert.equal(reopened.request.verifiedById, null)
        assert.equal(reopened.request.verifiedDepartmentId, null)
        assert.equal(reopened.audit.length, verified.audit.length + 1)
        await queue(destination.original, id, "HEAD", 1)
        await queue(hr, id, "HIDDEN", 0)
        const renewed = await pendingNotice(destination.original, id)
        assert.ok(
          Date.parse(renewed.createdAt) > Date.parse(incoming.createdAt),
        )
        assert.deepEqual(renewed, {
          ...incoming,
          createdAt: renewed.createdAt,
          readAt: null,
        })
        assert.equal((await notices(id)).length, 3)
        await expectStatus(await review(destination.original, id), 200)
        await expectStatus(await review(hr, id), 200)
      },
    )

    await t.test(
      "a correction notice write failure rolls back a Head change",
      async () => {
        const { department, subject, original, replacement } =
          await team("rollback")
        const id = await submit(subject)
        const before = await state(id)
        const priorNotices = await notices(id)
        const history = () =>
          prisma.workforceManagementChange.findMany({
            where: { subjectType: "DEPARTMENT", subjectId: department.id },
            orderBy: { id: "asc" },
          })
        const beforeHistory = await history()
        await db.exec(`
      CREATE FUNCTION fail_correction_notice() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.type = 'ATTENDANCE_CORRECTION_PENDING' THEN
          RAISE EXCEPTION 'Synthetic correction notice failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fail_correction_notice BEFORE INSERT ON "WorkflowNotification"
      FOR EACH ROW EXECUTE FUNCTION fail_correction_notice();
    `)
        try {
          await head(department.id, replacement, 500)
        } finally {
          await db.exec(
            'DROP TRIGGER fail_correction_notice ON "WorkflowNotification"; DROP FUNCTION fail_correction_notice();',
          )
        }
        assert.equal(
          (
            await prisma.department.findUniqueOrThrow({
              where: { id: department.id },
            })
          ).headId,
          original.user.id,
        )
        assert.deepEqual(await history(), beforeHistory)
        assert.deepEqual(await state(id), before)
        assert.deepEqual(await notices(id), priorNotices)
        await queue(original, id, "HEAD", 1)
        await queue(replacement, id, "HIDDEN", 0)
        await head(department.id, replacement)
        await pendingNotice(replacement, id)
      },
    )
  },
)
