import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { issueSession } from "../../../../src/features/auth/auth.service.js"
import type { TestContext } from "node:test"
import type { LeaveContext } from "./context.js"

/** Reviewer routing as Heads, accounts and departments change. */
export async function reviewRouting(
  t: TestContext,
  {
    prisma,
    account,
    setDepartmentHead,
    savedLeave,
    api,
    expectLeaveReadDenied,
    admin,
    submit,
    noticePath,
    superadmin,
    action,
    base,
    employee,
    head,
    pendingLeaveQueue,
    inboxFor,
    markLeaveNoticeRead,
  }: LeaveContext,
) {
  await t.test(
    "an unlinked Superadmin can open organization leave in every status",
    async () => {
      const reviewer = await prisma.user.create({
        data: {
          email: "organization-leave-reader@leave.test",
          fullName: "Organization leave reader",
          passwordHash: "test-only",
          role: "SUPERADMIN",
        },
      })
      const reader = await issueSession(reviewer)
      const team = await prisma.department.create({
        data: { name: "Organization leave detail team" },
      })
      const subject = await account("detail-subject", "STAFF", team.id)
      const teamHead = await account("detail-head", "STAFF", team.id)
      const coworker = await account("detail-peer", "STAFF", team.id)
      await setDepartmentHead(team.id, teamHead.user.id)

      async function expectOrganizationDetail(id: string, status: string) {
        const before = await savedLeave(id)
        const list = await api(
          reader,
          `/leave/requests?scope=team&status=${status}&search=detail-subject`,
        )
        assert.equal(list.status, 200)
        const { requests } = (await list.json()) as {
          requests: { id: string; status: string }[]
        }
        const row = requests.find((item) => item.id === id)
        assert.equal(row?.status, status)

        const path = `/leave/requests/${id}`
        await expectLeaveReadDenied(await api(coworker, path))
        assert.equal((await api(teamHead, path)).status, 200)
        if (status === "SUBMITTED") {
          await expectLeaveReadDenied(await api(admin, path))
        } else {
          assert.equal((await api(admin, path)).status, 200)
        }
        const detail = await api(reader, path)
        assert.equal(detail.status, 200, await detail.clone().text())
        assert.deepEqual(await detail.json(), { request: row })
        assert.deepEqual(await savedLeave(id), before)
      }

      const { request } = await submit("2027-03-01", "2027-03-01", subject)
      const inbox = await api(reader, noticePath)
      assert.equal(inbox.status, 200)
      const { notifications } = (await inbox.json()) as {
        notifications: { entityId: string; type: string }[]
      }
      const notice = notifications.find(
        ({ entityId, type }) =>
          entityId === request.id && type === "LEAVE_SUBMITTED",
      )
      assert.ok(notice)
      await expectOrganizationDetail(notice.entityId, "SUBMITTED")

      for (const [actor, decision, version, status] of [
        [teamHead, "verify", 1, "VERIFIED"],
        [admin, "approve", 2, "APPROVED"],
        [superadmin, "reverse", 3, "REVERSED"],
      ] as const) {
        const result = await action(actor, request.id, decision, version)
        assert.equal(result.status, 200, await result.text())
        await expectOrganizationDetail(request.id, status)
      }

      const rejected = await submit("2027-03-02", "2027-03-02", subject)
      const rejection = await action(teamHead, rejected.request.id, "reject", 1)
      assert.equal(rejection.status, 200, await rejection.text())
      await expectOrganizationDetail(rejected.request.id, "REJECTED")

      const cancelled = await submit("2027-03-03", "2027-03-03", subject)
      const cancellation = await action(
        subject,
        cancelled.request.id,
        "cancel",
        1,
      )
      assert.equal(cancellation.status, 200, await cancellation.text())
      await expectOrganizationDetail(cancelled.request.id, "CANCELLED")

      // PG-013-F001-A008-T002: compare the organization summary projection
      // with all persisted status/type groups visible to Superadmin.
      const persistedLeave = await prisma.leaveRequest.findMany({
        select: { status: true, type: true },
      })
      const expectedGroups = new Map<
        string,
        { status: string; type: string; count: number }
      >()
      for (const row of persistedLeave) {
        const key = `${row.status}:${row.type}`
        const group = expectedGroups.get(key)
        expectedGroups.set(key, {
          status: row.status,
          type: row.type,
          count: (group?.count ?? 0) + 1,
        })
      }
      const overview = await api(reader, "/leave/overview?scope=team")
      assert.equal(overview.status, 200, await overview.clone().text())
      const { groups } = (await overview.json()) as {
        groups: { status: string; type: string; count: number }[]
      }
      assert.ok(
        groups.every(
          (group) =>
            JSON.stringify(Object.keys(group).sort()) ===
            JSON.stringify(["count", "status", "type"]),
        ),
      )
      const sortGroups = (
        values: { status: string; type: string; count: number }[],
      ) =>
        values.sort((left, right) =>
          `${left.status}:${left.type}`.localeCompare(
            `${right.status}:${right.type}`,
          ),
        )
      assert.deepEqual(
        sortGroups(groups),
        sortGroups([...expectedGroups.values()]),
      )

      await expectLeaveReadDenied(
        await api(reader, `/leave/requests/${randomUUID()}`),
      )

      // PG-013-F001-A015-T002: cover query allowlists, authentication,
      // supported roles, and the Staff team-scope boundary.
      const unsupported = await account("overview-user", "USER")
      const anonymousOverview = await fetch(`${base}/leave/overview?scope=team`)
      const missingScope = await api(superadmin, "/leave/overview")
      const invalidScope = await api(
        superadmin,
        "/leave/overview?scope=invalid",
      )
      const unknownQuery = await api(
        superadmin,
        "/leave/overview?scope=team&unexpected=true",
      )
      assert.equal(anonymousOverview.status, 401)
      assert.equal(missingScope.status, 400)
      assert.equal(invalidScope.status, 400)
      assert.equal(unknownQuery.status, 400)
      const unsupportedRole = await api(
        unsupported,
        "/leave/overview?scope=mine",
      )
      const nonHeadTeam = await api(employee, "/leave/overview?scope=team")
      assert.equal(unsupportedRole.status, 403)
      assert.equal(nonHeadTeam.status, 403)
      for (const denied of [anonymousOverview, unsupportedRole, nonHeadTeam]) {
        const body = (await denied.json()) as Record<string, unknown>
        assert.equal("groups" in body, false)
      }
      for (const [actor, scope] of [
        [employee, "mine"],
        [head, "team"],
        [admin, "team"],
        [superadmin, "team"],
      ] as const) {
        assert.equal(
          (await api(actor, `/leave/overview?scope=${scope}`)).status,
          200,
        )
      }
    },
  )

  await t.test(
    "appointing the requester as Head makes pending leave discoverable to HR",
    async () => {
      const team = await prisma.department.create({
        data: { name: "Self Head routing" },
      })
      const subject = await account("self-head-subject", "STAFF", team.id)
      const previousHead = await account("self-head-former", "STAFF", team.id)
      await setDepartmentHead(team.id, previousHead.user.id)
      const { request } = await submit("2026-12-02", "2026-12-02", subject)
      const path = `/leave/requests/${request.id}`
      const before = await savedLeave(request.id)
      const priorNotice = before.notifications.find(
        ({ userId }) => userId === previousHead.user.id,
      )
      assert.ok(priorNotice)
      const beforeQueue = await pendingLeaveQueue(request.id)
      assert.equal(beforeQueue.entry, undefined)

      await setDepartmentHead(team.id, subject.user.id)
      const detail = await api(admin, path)
      const queue = await pendingLeaveQueue(request.id)
      const inbox = await inboxFor(admin, request.id)
      const selfDetail = await api(subject, path)
      const owner = (await selfDetail.json()) as {
        request: { capabilities: { fallback: boolean } }
      }
      assert.equal(owner.request.capabilities.fallback, true)
      assert.deepEqual(
        {
          listed: Boolean(queue.entry),
          overviewAdded: queue.submittedAnnual - beforeQueue.submittedAnnual,
          detailStatus: detail.status,
          noticeTypes: inbox.notifications.map(({ type }) => type),
          selfVerifyStatus: (await action(subject, request.id, "verify", 1))
            .status,
        },
        {
          listed: true,
          overviewAdded: 1,
          detailStatus: 200,
          noticeTypes: ["LEAVE_SUBMITTED"],
          selfVerifyStatus: 403,
        },
      )
      assert.ok(queue.entry)
      assert.equal(queue.entry.capabilities.approve, true)
      assert.equal(queue.entry.capabilities.reject, true)
      assert.deepEqual(
        ((await detail.json()) as { request: typeof queue.entry }).request
          .capabilities,
        queue.entry.capabilities,
      )
      assert.equal(
        (await inboxFor(previousHead, request.id)).notifications.length,
        0,
      )
      assert.equal(
        (await markLeaveNoticeRead(previousHead, priorNotice.id)).status,
        404,
      )
      const after = await savedLeave(request.id)
      assert.deepEqual(after.decisions, before.decisions)
      assert.deepEqual(after.days, before.days)
      assert.equal(after.routeDepartmentId, team.id)
      assert.equal(after.version, 1)
      assert.equal(
        after.notifications.find(({ id }) => id === priorNotice.id)?.readAt,
        null,
      )
      assert.equal(
        inbox.notifications[0]?.summary,
        "A leave request is awaiting review.",
      )
      const newNotice = inbox.notifications[0]!
      assert.equal((await markLeaveNoticeRead(admin, newNotice.id)).status, 200)

      await setDepartmentHead(team.id, previousHead.user.id)
      assert.equal((await inboxFor(admin, request.id)).notifications.length, 0)
      await setDepartmentHead(team.id, subject.user.id)
      await setDepartmentHead(team.id, subject.user.id)
      const again = await inboxFor(admin, request.id)
      assert.equal(again.notifications.length, 1)
      assert.equal(again.notifications[0]?.id, newNotice.id)
      assert.ok(again.notifications[0]?.readAt)
      assert.deepEqual(
        (await savedLeave(request.id)).decisions,
        before.decisions,
      )
      assert.equal(
        (await action(admin, queue.entry.id, "approve", 1)).status,
        200,
      )
    },
  )

  await t.test(
    "appointing an eligible Head withdraws pending HR fallback visibility",
    async () => {
      const team = await prisma.department.create({
        data: { name: "Headless routing" },
      })
      const subject = await account("headless-subject", "STAFF", team.id)
      const newHead = await account("headless-new-head", "STAFF", team.id)
      const { request } = await submit("2026-12-02", "2026-12-02", subject)
      const path = `/leave/requests/${request.id}`
      const oldQueue = await pendingLeaveQueue(request.id)
      assert.equal(oldQueue.entry?.capabilities.approve, true)
      const oldInbox = await inboxFor(admin, request.id)
      const oldNotice = oldInbox.notifications[0]
      assert.ok(oldNotice)
      assert.equal(oldNotice.readAt, null)

      await setDepartmentHead(team.id, newHead.user.id)
      const beforeDenials = await savedLeave(request.id)
      const detail = await api(admin, path)
      const queue = await pendingLeaveQueue(request.id)
      const inbox = await inboxFor(admin, request.id)
      assert.deepEqual(
        {
          listed: Boolean(queue.entry),
          overviewRemoved: oldQueue.submittedAnnual - queue.submittedAnnual,
          detailStatus: detail.status,
          notices: inbox.notifications.length,
          unreadRemoved: oldInbox.unreadCount - inbox.unreadCount,
          markReadStatus: (await markLeaveNoticeRead(admin, oldNotice.id))
            .status,
          approveStatus: (await action(admin, request.id, "approve", 1)).status,
          rejectStatus: (await action(admin, request.id, "reject", 1)).status,
        },
        {
          listed: false,
          overviewRemoved: 1,
          detailStatus: 404,
          notices: 0,
          unreadRemoved: 1,
          markReadStatus: 404,
          approveStatus: 403,
          rejectStatus: 403,
        },
      )
      await expectLeaveReadDenied(detail)
      assert.equal(
        (await api(admin, `${noticePath}/read-all`, { method: "PATCH" }))
          .status,
        200,
      )
      assert.deepEqual(await savedLeave(request.id), beforeDenials)
      assert.equal(
        (await pendingLeaveQueue(request.id, newHead)).entry?.capabilities
          .verify,
        true,
      )
      assert.equal(
        (await inboxFor(newHead, request.id)).notifications.length,
        1,
      )
      assert.equal((await action(newHead, request.id, "verify", 1)).status, 200)
      const verified = await api(admin, path)
      assert.equal(verified.status, 200)
      assert.equal(
        (
          (await verified.json()) as {
            request: { capabilities: { approve: boolean } }
          }
        ).request.capabilities.approve,
        true,
      )
      assert.deepEqual(
        (await inboxFor(admin, request.id)).notifications.map(
          ({ type }) => type,
        ),
        ["LEAVE_VERIFIED"],
      )
      assert.equal((await action(admin, request.id, "approve", 2)).status, 200)
    },
  )

  await t.test(
    "ordinary Head replacement reroutes pending notices and preserves verification",
    async () => {
      const team = await prisma.department.create({
        data: { name: "Ordinary Head replacement" },
      })
      const subject = await account("replacement-subject", "STAFF", team.id)
      const previousHead = await account(
        "replacement-original",
        "STAFF",
        team.id,
      )
      const newHead = await account("replacement-new", "STAFF", team.id)
      await setDepartmentHead(team.id, previousHead.user.id)
      const { request: verified } = await submit(
        "2026-12-02",
        "2026-12-02",
        subject,
      )
      assert.equal(
        (await action(previousHead, verified.id, "verify", 1)).status,
        200,
      )
      const verifiedBefore = await savedLeave(verified.id)
      const { request: pending } = await submit(
        "2026-12-03",
        "2026-12-03",
        subject,
      )
      const oldNotice = (await inboxFor(previousHead, pending.id))
        .notifications[0]
      assert.ok(oldNotice)

      await setDepartmentHead(team.id, newHead.user.id)
      assert.equal((await pendingLeaveQueue(pending.id)).entry, undefined)
      await expectLeaveReadDenied(
        await api(admin, `/leave/requests/${pending.id}`),
      )
      assert.equal(
        (await pendingLeaveQueue(pending.id, newHead)).entry?.capabilities
          .verify,
        true,
      )
      assert.equal(
        (await inboxFor(previousHead, pending.id)).notifications.length,
        0,
      )
      assert.equal(
        (await markLeaveNoticeRead(previousHead, oldNotice.id)).status,
        404,
      )
      assert.equal(
        (await inboxFor(newHead, pending.id)).notifications.length,
        1,
      )
      const beforeDenial = await savedLeave(pending.id)
      assert.equal(
        (await action(previousHead, pending.id, "verify", 1)).status,
        403,
      )
      assert.deepEqual(await savedLeave(pending.id), beforeDenial)
      assert.deepEqual(await savedLeave(verified.id), verifiedBefore)
      assert.equal((await action(admin, verified.id, "approve", 2)).status, 200)
      assert.equal((await action(newHead, pending.id, "verify", 1)).status, 200)
    },
  )

  await t.test(
    "Head account deactivation and reactivation switch pending reviewers",
    async () => {
      const team = await prisma.department.create({
        data: { name: "Head account changes" },
      })
      const subject = await account("head-account-subject", "STAFF", team.id)
      const reviewer = await account("head-account-reviewer", "STAFF", team.id)
      await setDepartmentHead(team.id, reviewer.user.id)
      const { request } = await submit("2026-12-02", "2026-12-02", subject)
      const path = `/leave/requests/${request.id}`
      const before = await savedLeave(request.id)
      const changeStatus = async (isActive: boolean) => {
        const response = await api(
          superadmin,
          `/users/${reviewer.user.id}/status`,
          {
            method: "PATCH",
            body: { isActive },
          },
        )
        assert.equal(response.status, 200, await response.text())
      }

      await changeStatus(false)
      assert.equal((await api(reviewer, path)).status, 401)
      assert.equal(
        (await pendingLeaveQueue(request.id)).entry?.capabilities.approve,
        true,
      )
      assert.equal((await api(admin, path)).status, 200)
      const notice = (await inboxFor(admin, request.id)).notifications[0]
      assert.ok(notice)

      await changeStatus(true)
      await expectLeaveReadDenied(await api(admin, path))
      assert.equal((await inboxFor(admin, request.id)).notifications.length, 0)
      assert.equal((await markLeaveNoticeRead(admin, notice.id)).status, 404)
      assert.equal((await action(admin, request.id, "approve", 1)).status, 403)
      assert.deepEqual(
        (await savedLeave(request.id)).decisions,
        before.decisions,
      )

      // Department Management rejects non-Staff Heads, so inject a legacy linkage.
      await prisma.user.update({
        where: { id: reviewer.user.id },
        data: { role: "USER" },
      })
      assert.equal(
        (await pendingLeaveQueue(request.id)).entry?.capabilities.approve,
        true,
      )
      assert.equal((await api(admin, path)).status, 200)
      const restored = (await inboxFor(admin, request.id)).notifications
      assert.equal(restored.length, 1)
      assert.equal(restored[0]?.id, notice.id)
      assert.equal(restored[0]?.readAt, null)
      assert.equal((await action(admin, request.id, "approve", 1)).status, 200)
    },
  )

  await t.test(
    "temporary self-Head handoff and restoration update pending notice visibility",
    async () => {
      const team = await prisma.department.create({
        data: { name: "Temporary Head routing" },
      })
      const subject = await account("temp-head-subject", "STAFF", team.id)
      const originalHead = await account("temp-head-original", "STAFF", team.id)
      await setDepartmentHead(team.id, originalHead.user.id)
      const { request } = await submit("2026-12-02", "2026-12-02", subject)
      const path = `/employees/${originalHead.employee.id}`
      const before = await savedLeave(request.id)
      const update = async (body: object) => {
        const response = await api(admin, path, { method: "PUT", body })
        assert.equal(response.status, 200, await response.text())
      }
      await update({
        status: "ON_LEAVE",
        replacementHeadEmployeeId: subject.employee.id,
      })
      assert.equal(
        (await pendingLeaveQueue(request.id)).entry?.capabilities.approve,
        true,
      )
      const notice = (await inboxFor(admin, request.id)).notifications[0]
      assert.ok(notice)
      await update({ status: "ACTIVE" })
      assert.equal((await pendingLeaveQueue(request.id)).entry, undefined)
      assert.equal((await inboxFor(admin, request.id)).notifications.length, 0)
      assert.equal((await markLeaveNoticeRead(admin, notice.id)).status, 404)
      assert.deepEqual(
        (await savedLeave(request.id)).decisions,
        before.decisions,
      )
    },
  )

  await t.test(
    "a submitted fallback follows the receiving department's Head",
    async () => {
      const origin = await prisma.department.create({
        data: { name: "Fallback transfer origin" },
      })
      const destination = await prisma.department.create({
        data: { name: "Fallback transfer destination" },
      })
      const subject = await account(
        "fallback-transfer-subject",
        "STAFF",
        origin.id,
      )
      const receivingHead = await account(
        "fallback-transfer-head",
        "STAFF",
        destination.id,
      )
      await setDepartmentHead(destination.id, receivingHead.user.id)
      const { request } = await submit("2026-12-02", "2026-12-02", subject)
      const oldNotice = (await inboxFor(admin, request.id)).notifications[0]
      assert.ok(oldNotice)
      const moved = await api(admin, `/employees/${subject.employee.id}`, {
        method: "PUT",
        body: { departmentId: destination.id },
      })
      assert.equal(moved.status, 200, await moved.text())
      assert.equal((await pendingLeaveQueue(request.id)).entry, undefined)
      await expectLeaveReadDenied(
        await api(admin, `/leave/requests/${request.id}`),
      )
      assert.equal((await markLeaveNoticeRead(admin, oldNotice.id)).status, 404)
      assert.equal(
        (await pendingLeaveQueue(request.id, receivingHead)).entry?.capabilities
          .verify,
        true,
      )
      assert.equal(
        (await action(receivingHead, request.id, "verify", 1)).status,
        200,
      )
      assert.deepEqual(
        (await inboxFor(admin, request.id)).notifications.map(
          ({ type }) => type,
        ),
        ["LEAVE_VERIFIED"],
      )
      const verified = await savedLeave(request.id)
      assert.equal(verified.routeDepartmentId, destination.id)
      assert.equal(verified.verifiedById, receivingHead.user.id)
      assert.equal((await action(admin, request.id, "approve", 2)).status, 200)
    },
  )
}
