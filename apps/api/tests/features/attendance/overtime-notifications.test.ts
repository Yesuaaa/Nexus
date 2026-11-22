import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "pending overtime notices follow current review authority",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base, db } = await startPgliteApp(t, {
      app: { attendanceClock: () => new Date("2026-11-14T12:00:00+08:00") },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Overtime notice policy",
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
      const email = `${name.toLowerCase().replaceAll(" ", "-")}@overtime-notice.test`
      const { user, employee } = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash: "test-only", role, departmentId },
        })
        const employee =
          role === "SUPERADMIN"
            ? null
            : await tx.employee.create({
                data: {
                  userId: user.id,
                  fullName: name,
                  employeeId: `OT-NOTICE-${name}`,
                  departmentId,
                },
              })
        return { user, employee }
      })
      return { user, employee, token: (await issueSession(user)).token }
    }
    const hr = await account("HR", "ADMIN")
    const superadmin = await account("Superadmin", "SUPERADMIN")
    type Actor = typeof hr
    type Notice = {
      id: string
      readAt: string | null
      createdAt: string
      type: string
      entityId: string
    }
    type Capabilities = { approve: boolean; verify: boolean; reject: boolean }
    type Adjustment = { id: string; status: string; capabilities: Capabilities }
    const pendingType = "ATTENDANCE_OVERTIME_PENDING"
    const inbox = "/request-workflows/notifications"
    const detail = (id: string) => `/attendance/adjustments/${id}`

    async function call(
      actor: Actor,
      path: string,
      status: number,
      method = "GET",
      body?: object,
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${actor.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
      assert.equal(
        response.status,
        status,
        `${method} ${path}: ${await response.clone().text()}`,
      )
      return response
    }
    function head(departmentId: string, actor: Actor | null, status = 200) {
      return call(hr, `/departments/${departmentId}`, status, "PUT", {
        headId: actor?.user.id ?? null,
      })
    }
    function active(actor: Actor, isActive: boolean, status = 200) {
      return call(
        superadmin,
        `/users/${actor.user.id}/status`,
        status,
        "PATCH",
        { isActive },
      )
    }
    function markRead(actor: Actor, notice: Notice, status = 200) {
      return call(actor, `${inbox}/${notice.id}/read`, status, "PATCH")
    }
    async function review(
      actor: Actor,
      id: string,
      status: number,
      stage?: string,
      decision = "APPROVED",
    ) {
      const response = await call(
        actor,
        `${detail(id)}/review`,
        status,
        "POST",
        {
          decision,
          note: "Reviewed recorded overtime",
        },
      )
      if (stage)
        assert.equal(
          ((await response.json()) as { adjustment: Adjustment }).adjustment
            .status,
          stage,
        )
    }
    async function team(name: string) {
      const department = await prisma.department.create({ data: { name } })
      const subject = await account(`${name} requester`, "STAFF", department.id)
      const original = await account(`${name} Head`, "STAFF", department.id)
      const incoming = await account(
        `${name} replacement`,
        "STAFF",
        department.id,
      )
      await head(department.id, original)
      assert.ok(subject.employee && original.employee && incoming.employee)
      return {
        department,
        subject,
        original,
        incoming,
        subjectId: subject.employee.id,
        originalId: original.employee.id,
        incomingId: incoming.employee.id,
      }
    }
    async function submit(actor: Actor) {
      assert.ok(actor.employee)
      const employeeId = actor.employee.id
      await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId,
          policyId: policy.id,
          effectiveFrom: new Date("2026-01-01"),
        },
      })
      await prisma.attendanceWorkSession.create({
        data: {
          employeeId,
          startedAt: new Date("2026-11-13T08:00:00+08:00"),
          endedAt: new Date("2026-11-13T18:00:00+08:00"),
        },
      })
      const response = await call(
        actor,
        "/attendance/adjustments",
        201,
        "POST",
        {
          type: "OVERTIME",
          requestKey: randomUUID(),
          startedAt: "2026-11-13T16:00:00+08:00",
          endedAt: "2026-11-13T18:00:00+08:00",
          reason: "Recorded overtime for reviewer routing",
        },
      )
      const { adjustment } = (await response.json()) as {
        adjustment: Adjustment & { overtimeMinutes: number }
      }
      assert.equal(adjustment.overtimeMinutes, 120)
      return adjustment.id
    }
    async function pending(actor: Actor, id: string) {
      const response = await call(actor, inbox, 200)
      const { notifications, unreadCount } = (await response.json()) as {
        notifications: Notice[]
        unreadCount: number
      }
      assert.equal(
        unreadCount,
        notifications.filter(({ readAt }) => readAt === null).length,
      )
      return notifications.filter(
        (notice) => notice.entityId === id && notice.type === pendingType,
      )
    }
    async function notice(actor: Actor, id: string) {
      const notices = await pending(actor, id)
      assert.equal(notices.length, 1, `Pending notices for ${actor.user.email}`)
      return notices[0]
    }
    async function expectReviewer(
      actor: Actor,
      id: string,
      route: "HEAD" | "HR" | "HIDDEN",
      teamStatus = 200,
    ) {
      const hidden = route === "HIDDEN"
      const record = await call(actor, detail(id), hidden ? 404 : 200)
      const list = await call(
        actor,
        "/attendance/adjustments?scope=team&type=OVERTIME&status=PENDING",
        teamStatus,
      )
      const overview = await call(
        actor,
        "/attendance/adjustments/overview?scope=team",
        teamStatus,
      )
      if (teamStatus === 200) {
        const { adjustments, total } = (await list.json()) as {
          adjustments: Adjustment[]
          total: number
        }
        const { groups } = (await overview.json()) as {
          groups: {
            type: string
            status: string
            count: number
            overtimeMinutes: number
            awaitingHrPending: number
          }[]
        }
        const group = groups.find(
          ({ type, status }) => type === "OVERTIME" && status === "PENDING",
        )
        assert.equal(total, hidden ? 0 : 1)
        assert.equal(group?.count ?? 0, total)
        assert.equal(group?.overtimeMinutes ?? 0, total * 120)
        assert.equal(group?.awaitingHrPending ?? 0, route === "HR" ? 1 : 0)
        if (!hidden) {
          const { adjustment } = (await record.json()) as {
            adjustment: Adjustment
          }
          assert.deepEqual(adjustments[0], adjustment)
          assert.deepEqual(adjustment.capabilities, {
            approve: route === "HR",
            verify: route === "HEAD",
            reject: true,
          })
        }
      }
      if (hidden) assert.deepEqual(await pending(actor, id), [])
      else await notice(actor, id)
    }
    function notices(id: string) {
      return prisma.workflowNotification.findMany({
        where: { attendanceAdjustmentId: id },
        orderBy: { id: "asc" },
      })
    }
    async function state(id: string) {
      return {
        adjustment: await prisma.attendanceAdjustment.findUniqueOrThrow({
          where: { id },
        }),
        audit: await prisma.attendanceAudit.findMany({
          where: { entityId: id },
          orderBy: { id: "asc" },
        }),
      }
    }

    await t.test(
      "same-department Head replacement grants notice and withdraws former access",
      async () => {
        const { department, subject, original, incoming } =
          await team("Replacement")
        const id = await submit(subject)
        const before = await state(id)
        await expectReviewer(original, id, "HEAD")
        await expectReviewer(hr, id, "HIDDEN")
        const oldNotice = await notice(original, id)
        const oversight = await notice(superadmin, id)
        await head(department.id, incoming)
        await expectReviewer(original, id, "HIDDEN", 403)
        await expectReviewer(incoming, id, "HEAD")
        assert.equal((await notice(incoming, id)).readAt, null)
        await markRead(original, oldNotice, 404)
        await call(original, `${inbox}/read-all`, 200, "PATCH")
        await review(original, id, 403)
        assert.equal(
          (await notices(id)).find(({ id }) => id === oldNotice.id)?.readAt,
          null,
        )
        await markRead(incoming, await notice(incoming, id))
        const rows = await notices(id)
        await head(department.id, incoming)
        assert.deepEqual(await notices(id), rows)
        assert.deepEqual(await notice(superadmin, id), oversight)
        assert.deepEqual(await state(id), before)
        await review(incoming, id, 200, "VERIFIED")
        await review(hr, id, 200, "APPROVED")
      },
    )

    await t.test(
      "disabling the replacement Head grants HR fallback and reactivation preserves reads",
      async () => {
        const { department, subject, original, incoming } =
          await team("Account")
        const id = await submit(subject)
        await head(department.id, incoming)
        await active(incoming, false)
        await call(incoming, detail(id), 401)
        await call(incoming, inbox, 401)
        await expectReviewer(hr, id, "HR")
        const fallback = await notice(hr, id)
        await markRead(hr, fallback)
        const fallbackRead = await notice(hr, id)
        await active(incoming, true)
        incoming.token = (await issueSession(incoming.user)).token
        await expectReviewer(incoming, id, "HEAD")
        const headNotice = await notice(incoming, id)
        await markRead(incoming, headNotice)
        const headRead = await notice(incoming, id)
        await expectReviewer(hr, id, "HIDDEN")
        await markRead(hr, fallback, 404)
        await review(hr, id, 403)
        await active(incoming, false)
        await markRead(incoming, headNotice, 401)
        assert.deepEqual(await notice(hr, id), fallbackRead)
        await active(incoming, true)
        incoming.token = (await issueSession(incoming.user)).token
        assert.deepEqual(await notice(incoming, id), headRead)
        assert.equal((await notices(id)).length, 4)
        await head(department.id, original)
        await review(original, id, 200, "REJECTED", "REJECTED")
      },
    )

    await t.test(
      "removal, restoration and temporary handoffs route headless and self-Head overtime",
      async () => {
        const {
          department,
          subject,
          original,
          incoming,
          originalId,
          incomingId,
          subjectId,
        } = await team("Temporary")
        const id = await submit(subject)
        await markRead(original, await notice(original, id))
        const originalRead = await notice(original, id)
        await head(department.id, null)
        await expectReviewer(hr, id, "HR")
        await markRead(hr, await notice(hr, id))
        const fallbackRead = await notice(hr, id)
        await head(department.id, original)
        assert.deepEqual(await notice(original, id), originalRead)
        async function handoff(replacementHeadEmployeeId: string) {
          await call(hr, `/employees/${originalId}`, 200, "PUT", {
            status: "ON_LEAVE",
            replacementHeadEmployeeId,
          })
        }
        async function restore() {
          await call(hr, `/employees/${originalId}`, 200, "PUT", {
            status: "ACTIVE",
          })
          assert.deepEqual(await notice(original, id), originalRead)
          await expectReviewer(hr, id, "HIDDEN")
        }
        await handoff(incomingId)
        await expectReviewer(incoming, id, "HEAD")
        await expectReviewer(original, id, "HIDDEN", 403)
        await markRead(incoming, await notice(incoming, id))
        const temporaryRead = await notice(incoming, id)
        await restore()
        await handoff(incomingId)
        assert.deepEqual(await notice(incoming, id), temporaryRead)
        await restore()
        await handoff(subjectId)
        await expectReviewer(hr, id, "HR")
        assert.deepEqual(await notice(hr, id), fallbackRead)
        assert.deepEqual(await pending(subject, id), [])
        const own = await call(subject, detail(id), 200)
        assert.deepEqual(
          ((await own.json()) as { adjustment: Adjustment }).adjustment
            .capabilities,
          {
            approve: false,
            verify: false,
            reject: false,
          },
        )
        await review(subject, id, 403)
        await restore()
        await review(original, id, 200, "VERIFIED")
        await review(hr, id, 200, "APPROVED")

        const headless = await account("No department", "STAFF")
        const headlessId = await submit(headless)
        await expectReviewer(hr, headlessId, "HR")
        await review(headless, headlessId, 403)
        await review(hr, headlessId, 200, "APPROVED")
      },
    )

    await t.test(
      "pending transfers preserve reads and a verified transfer renews notices",
      async () => {
        const from = await team("Origin")
        const to = await team("Destination")
        const id = await submit(from.subject)
        const before = await state(id)
        await markRead(from.original, await notice(from.original, id))
        await markRead(superadmin, await notice(superadmin, id))
        const originRead = await notice(from.original, id)
        const oversightRead = await notice(superadmin, id)
        async function move(departmentId: string) {
          await call(hr, `/employees/${from.subjectId}`, 200, "PUT", {
            departmentId,
          })
        }
        await move(to.department.id)
        await expectReviewer(from.original, id, "HIDDEN")
        await expectReviewer(to.original, id, "HEAD")
        const destination = await notice(to.original, id)
        assert.equal(destination.readAt, null)
        await markRead(to.original, destination)
        await markRead(from.original, originRead, 404)
        await review(from.original, id, 404)
        await move(from.department.id)
        assert.deepEqual(await notice(from.original, id), originRead)
        assert.deepEqual(await notice(superadmin, id), oversightRead)
        assert.deepEqual(await state(id), before)
        await review(from.original, id, 200, "VERIFIED")
        const verified = await state(id)
        const verificationNotices = (await notices(id)).filter(
          ({ type }) => type === "ATTENDANCE_OVERTIME_VERIFIED",
        )
        await head(from.department.id, from.incoming)
        assert.deepEqual(await state(id), verified)
        assert.deepEqual(await pending(from.incoming, id), [])
        await move(to.department.id)
        const reopened = await state(id)
        assert.equal(reopened.adjustment.status, "PENDING")
        assert.equal(reopened.adjustment.verifiedById, null)
        assert.equal(reopened.adjustment.verifiedDepartmentId, null)
        assert.equal(reopened.adjustment.verifiedAt, null)
        assert.equal(reopened.adjustment.verificationNote, null)
        assert.equal(reopened.audit.length, verified.audit.length + 1)
        await expectReviewer(to.original, id, "HEAD")
        await expectReviewer(hr, id, "HIDDEN")
        for (const [actor, previous] of [
          [to.original, destination],
          [superadmin, oversightRead],
        ] as const) {
          const renewed = await notice(actor, id)
          assert.equal(renewed.id, previous.id)
          assert.equal(renewed.readAt, null)
          assert.ok(
            Date.parse(renewed.createdAt) > Date.parse(previous.createdAt),
          )
        }
        const rows = await notices(id)
        assert.equal(rows.filter(({ type }) => type === pendingType).length, 3)
        assert.deepEqual(
          rows.filter(({ type }) => type === "ATTENDANCE_OVERTIME_VERIFIED"),
          verificationNotices,
        )
        await review(hr, id, 403)
        await review(to.original, id, 200, "VERIFIED")
        await call(
          hr,
          `/departments/${to.department.id}/members/${from.subjectId}`,
          200,
          "DELETE",
        )
        await expectReviewer(to.original, id, "HIDDEN")
        await expectReviewer(hr, id, "HR")
        assert.equal((await notice(hr, id)).readAt, null)
        await review(hr, id, 200, "APPROVED")
      },
    )

    await t.test(
      "failed notice writes roll back leadership, handoff and account status changes",
      async () => {
        const {
          department,
          subject,
          original,
          incoming,
          originalId,
          incomingId,
        } = await team("Rollback")
        const id = await submit(subject)
        async function snapshot() {
          return {
            department: await prisma.department.findUniqueOrThrow({
              where: { id: department.id },
            }),
            employee: await prisma.employee.findUniqueOrThrow({
              where: { id: originalId },
            }),
            user: await prisma.user.findUniqueOrThrow({
              where: { id: original.user.id },
            }),
            sessions: await prisma.session.findMany({
              where: { userId: original.user.id },
              orderBy: { id: "asc" },
            }),
            notices: await notices(id),
            state: await state(id),
            managementHistory: await prisma.workforceManagementChange.findMany({
              orderBy: { id: "asc" },
            }),
            accountHistory: await prisma.accountManagementChange.findMany({
              orderBy: { id: "asc" },
            }),
          }
        }
        const before = await snapshot()
        await db.exec(`
      CREATE FUNCTION fail_overtime_notice() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.type = 'ATTENDANCE_OVERTIME_PENDING' THEN
          RAISE EXCEPTION 'Synthetic overtime notice failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fail_overtime_notice BEFORE INSERT ON "WorkflowNotification"
      FOR EACH ROW EXECUTE FUNCTION fail_overtime_notice();
    `)
        try {
          await head(department.id, incoming, 500)
          assert.deepEqual(await snapshot(), before)
          await call(hr, `/employees/${originalId}`, 500, "PUT", {
            status: "ON_LEAVE",
            replacementHeadEmployeeId: incomingId,
          })
          assert.deepEqual(await snapshot(), before)
          await active(original, false, 500)
          assert.deepEqual(await snapshot(), before)
          await expectReviewer(original, id, "HEAD")
        } finally {
          await db.exec(
            'DROP TRIGGER fail_overtime_notice ON "WorkflowNotification"; DROP FUNCTION fail_overtime_notice();',
          )
        }
        await head(department.id, incoming)
        await expectReviewer(incoming, id, "HEAD")
        await review(incoming, id, 200, "REJECTED", "REJECTED")
      },
    )
  },
)
