import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Phase 5 serves immutable payslips and private requests only to authorized accounts",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function account(
      id: string,
      role: Role,
      active = true,
      deleted = false,
    ) {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: id + "@payslip.test",
          passwordHash: "fixture",
          isActive: active,
          accountDeletedAt: deleted ? new Date() : null,
        },
      })
      return { id, token: (await issueSession(user)).token }
    }
    const admin = await account("document-admin", Role.ADMIN)
    const superadmin = await account("document-superadmin", Role.SUPERADMIN)
    const staff = await account("document-staff", Role.STAFF)
    const other = await account("document-other", Role.STAFF)
    const unlinked = await account("document-unlinked", Role.STAFF)
    const inactive = await account("document-inactive", Role.STAFF, false)
    const deleted = await account("document-deleted", Role.STAFF, true, true)
    const client = await account("document-client", Role.USER)
    const employee = await prisma.employee.create({
      data: {
        userId: staff.id,
        employeeId: "PAY-001",
        fullName: "Morgan Payroll",
        employmentType: "FULL_TIME",
      },
    })
    await prisma.employee.create({
      data: {
        userId: other.id,
        employeeId: "PAY-002",
        fullName: "Other Staff",
        employmentType: "FULL_TIME",
      },
    })
    const startDate = new Date("2026-11-01T00:00:00.000Z")
    const configuration = await prisma.payrollConfiguration.create({
      data: {
        frequency: "MONTHLY",
        effectiveFrom: startDate,
        createdById: admin.id,
        changeReason: "Payslip fixture",
      },
    })
    const period = await prisma.payrollPeriod.create({
      data: {
        configurationId: configuration.id,
        createdById: admin.id,
        cutoffLabel: "November 2026",
        startDate,
        endDate: new Date("2026-11-30T00:00:00.000Z"),
      },
    })
    const run = await prisma.payrollRun.create({
      data: {
        status: "DRAFT",
        periodId: period.id,
        createdById: admin.id,
        calculationCount: 1,
      },
    })
    const revision = await prisma.payrollRunCalculation.create({
      data: {
        runId: run.id,
        revision: 1,
        status: "COMPLETE",
        createdById: admin.id,
        inputSnapshot: {},
        calculatedItemCount: 1,
        items: {
          create: {
            employeeId: employee.id,
            employeeNumberSnapshot: employee.employeeId,
            employeeNameSnapshot: employee.fullName,
            employmentTypeSnapshot: "FULL_TIME",
            status: "CALCULATED",
            grossAmount: "12345.67",
            deductionsAmount: "45.67",
            netAmount: "12300.00",
            compensationSnapshot: {},
            attendanceSnapshot: {},
            warnings: [],
            blocks: [],
            components: {
              create: [
                {
                  name: "Base earnings",
                  componentType: "BASE_EARNING",
                  status: "CALCULATED",
                  amount: "12345.67",
                  metadata: {},
                },
                {
                  name: "Recurring deduction",
                  componentType: "DEDUCTION",
                  status: "CALCULATED",
                  amount: "45.67",
                  metadata: {},
                },
              ],
            },
          },
        },
      },
    })
    function api(
      path: string,
      actor?: typeof admin,
      method = "GET",
      body?: object,
    ) {
      return fetch(base + path, {
        method,
        headers: {
          ...(actor ? { Authorization: "Bearer " + actor.token } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    }
    const generate = "/payroll/runs/" + run.id + "/generate-payslips"
    const publish = "/payroll/runs/" + run.id + "/publish-payslips"
    const self = "/staff/my-payroll"
    assert.equal((await api(generate, admin, "POST")).status, 409)
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "REJECTED" },
    })
    assert.equal((await api(generate, admin, "POST")).status, 409)
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "APPROVED" },
    })
    await prisma.payrollApprovalEvent.create({
      data: {
        calculationId: revision.id,
        action: "PAYROLL_APPROVED",
        actorId: "independent-reviewer",
      },
    })
    assert.equal((await api(publish, admin, "POST")).status, 409)
    assert.equal((await api(generate, superadmin, "POST")).status, 403)
    const generated = await api(generate, admin, "POST")
    assert.deepEqual(await generated.json(), { total: 1, changed: 1 })
    assert.deepEqual(await (await api(generate, admin, "POST")).json(), {
      total: 1,
      changed: 0,
    })
    const document = await prisma.payrollPayslip.findFirstOrThrow()
    const detail = self + "/payslips/" + document.id
    assert.equal((await api(detail, staff)).status, 404)
    const unpublishedResponse = await api(self + "/payslips", staff)
    const unpublishedPayslips = (await unpublishedResponse.json()) as {
      rows: { id: string }[]
    }
    assert.deepEqual(unpublishedPayslips.rows, [])
    assert.equal(
      (
        await api(self + "/requests", staff, "POST", {
          type: "PAYSLIP_CORRECTION",
          payslipId: document.id,
          description: "Please review this draft payslip.",
        })
      ).status,
      404,
    )
    assert.equal((await api(publish, superadmin, "POST")).status, 403)
    assert.equal(
      (await api("/payroll/payslips/" + document.id, superadmin)).status,
      200,
    )
    assert.deepEqual(await (await api(publish, admin, "POST")).json(), {
      total: 1,
      changed: 1,
    })
    assert.deepEqual(await (await api(publish, admin, "POST")).json(), {
      total: 1,
      changed: 0,
    })
    const slip = await api(detail, staff)
    assert.equal(slip.status, 200)
    assert.equal(((await slip.json()) as { net: string }).net, "12300.00")
    const ownPayslipList = await api(self + "/payslips", staff)
    assert.deepEqual(
      ((await ownPayslipList.json()) as { rows: { id: string }[] }).rows.map(
        (row) => row.id,
      ),
      [document.id],
    )
    const otherPayslipList = await api(self + "/payslips", other)
    assert.deepEqual(
      ((await otherPayslipList.json()) as { rows: { id: string }[] }).rows,
      [],
    )
    const initialOverview = await api(self, staff)
    assert.equal(initialOverview.status, 200)
    const initialSummary = (await initialOverview.json()) as {
      linked: boolean
      latestPayslip: { net: string } | null
      openConcernCount: number
    }
    assert.equal(initialSummary.linked, true)
    assert.equal(initialSummary.latestPayslip?.net, "12300.00")
    assert.equal(initialSummary.openConcernCount, 0)
    const pdf = await api(detail + "/download", staff)
    assert.equal(pdf.status, 200)
    assert.match(pdf.headers.get("cache-control")!, /no-store/)
    assert.match(pdf.headers.get("content-type")!, /application\/pdf/)
    const pdfContents = await pdf.text()
    assert.match(pdfContents, /^%PDF-/)
    assert.match(pdfContents, /Net pay: PHP 12300\.00/)
    assert.match(pdfContents, /Total deductions: PHP 45\.67/)
    for (const actor of [other, unlinked]) {
      assert.equal((await api(detail, actor)).status, 404)
      assert.equal((await api(detail + "/download", actor)).status, 404)
    }
    for (const actor of [inactive, deleted, undefined])
      assert.equal((await api(detail, actor)).status, 401)
    assert.equal((await api(detail, client)).status, 403)
    assert.equal((await api("/payroll/payslips", staff)).status, 403)
    await assert.rejects(
      prisma.payrollPayslip.update({
        where: { id: document.id },
        data: { document: Buffer.from("changed") },
      }),
    )

    const requestBody = {
      type: "PAYSLIP_CORRECTION",
      payslipId: document.id,
      description: "Please review my payslip.",
    }
    assert.equal(
      (
        await api(self + "/requests", staff, "POST", {
          ...requestBody,
          payslipId: "invalid/reference",
        })
      ).status,
      400,
    )
    assert.equal(
      (await api(self + "/requests", other, "POST", requestBody)).status,
      404,
    )
    assert.equal(
      (await api(self + "/requests", unlinked, "POST", requestBody)).status,
      403,
    )
    const created = await api(self + "/requests", staff, "POST", {
      ...requestBody,
      employeeId: "another-employee",
    })
    assert.equal(created.status, 201)
    const request = (await created.json()) as {
      id: string
      createdAt: string
      employee: { employeeId: string }
    }
    assert.equal(request.employee.employeeId, employee.employeeId)
    const staffRequest = self + "/requests/" + request.id
    const adminRequest = "/payroll/requests/" + request.id
    for (const actor of [other, unlinked]) {
      assert.equal(
        (
          await api(staffRequest, actor, "PATCH", {
            type: "PAYROLL_DISCREPANCY",
            payslipId: null,
            description: "Unauthorized edit attempt.",
          })
        ).status,
        actor === unlinked ? 403 : 404,
      )
      assert.equal(
        (await api(staffRequest, actor, "DELETE")).status,
        actor === unlinked ? 403 : 404,
      )
    }
    assert.equal(
      (
        await api(staffRequest, staff, "PATCH", {
          type: "PAYROLL_DISCREPANCY",
          payslipId: document.id,
          description: "  Please verify the revised earnings.  ",
        })
      ).status,
      200,
    )
    const editedResponse = await api(staffRequest, staff)
    const edited = (await editedResponse.json()) as {
      id: string
      type: string
      status: string
      createdAt: string
      updatedAt: string
      payslip: { id: string } | null
      messages: { body: string; isAdmin: boolean }[]
      activity: {
        changes: {
          activity?: string
          type?: { before: string; after: string }
          description?: { before: string; after: string }
        }
      }[]
    }
    assert.equal(edited.id, request.id)
    assert.equal(edited.type, "PAYROLL_DISCREPANCY")
    assert.equal(edited.status, "OPEN")
    assert.equal(edited.createdAt, request.createdAt)
    assert.ok(Date.parse(edited.updatedAt) >= Date.parse(edited.createdAt))
    assert.equal(edited.payslip?.id, document.id)
    assert.equal(
      edited.messages[0]?.body,
      "Please verify the revised earnings.",
    )
    assert.equal(edited.messages[0]?.isAdmin, false)
    assert.ok(
      edited.activity.some(
        (entry) =>
          entry.changes.activity === "REQUEST_EDITED" &&
          entry.changes.type?.before === "PAYSLIP_CORRECTION" &&
          entry.changes.type.after === "PAYROLL_DISCREPANCY" &&
          entry.changes.description?.after ===
            "Please verify the revised earnings.",
      ),
    )
    const searchedConcerns = await api(
      self +
        "/requests?search=verify%20the%20revised&status=OPEN&type=PAYROLL_DISCREPANCY",
      staff,
    )
    assert.deepEqual(
      (
        (await searchedConcerns.json()) as {
          rows: { id: string }[]
          total: number
        }
      ).rows.map((row) => row.id),
      [request.id],
    )
    const otherSearch = await api(
      self + "/requests?search=" + encodeURIComponent(request.id),
      other,
    )
    assert.equal(((await otherSearch.json()) as { total: number }).total, 0)
    const deletionCreated = await api(self + "/requests", staff, "POST", {
      type: "MISSING_SALARY_PAYMENT",
      description: "Please check my missing salary payment.",
    })
    assert.equal(deletionCreated.status, 201)
    const deletionRequest = (await deletionCreated.json()) as {
      id: string
      createdAt: string
    }
    const deletionPath = self + "/requests/" + deletionRequest.id
    assert.equal((await api(deletionPath, inactive, "DELETE")).status, 401)
    assert.equal((await api(deletionPath, undefined, "DELETE")).status, 401)
    assert.equal((await api(deletionPath, client, "DELETE")).status, 403)
    const withdrawnResponse = await api(deletionPath, staff, "DELETE")
    assert.equal(withdrawnResponse.status, 200)
    const withdrawn = (await withdrawnResponse.json()) as {
      id: string
      status: string
      createdAt: string
      withdrawnAt: string | null
      withdrawnBy: string | null
    }
    assert.equal(withdrawn.id, deletionRequest.id)
    assert.equal(withdrawn.status, "CLOSED")
    assert.equal(withdrawn.createdAt, deletionRequest.createdAt)
    assert.ok(withdrawn.withdrawnAt)
    assert.equal(withdrawn.withdrawnBy, staff.id)
    assert.equal((await api(deletionPath, staff)).status, 404)
    const retainedForAdmin = await api(
      "/payroll/requests/" + deletionRequest.id,
      admin,
    )
    assert.equal(retainedForAdmin.status, 200)
    const retainedRequest = (await retainedForAdmin.json()) as {
      withdrawnAt: string | null
      activity: { changes: { activity?: string } }[]
    }
    assert.ok(retainedRequest.withdrawnAt)
    assert.ok(
      retainedRequest.activity.some(
        (entry) => entry.changes.activity === "REQUEST_WITHDRAWN",
      ),
    )
    const activeConcerns = await api(self + "/requests", staff)
    assert.deepEqual(
      ((await activeConcerns.json()) as { rows: { id: string }[] }).rows.map(
        (row) => row.id,
      ),
      [request.id],
    )
    const raceCreated = await api(self + "/requests", staff, "POST", {
      type: "PAYROLL_DISCREPANCY",
      description: "Please review this concurrent concern.",
    })
    assert.equal(raceCreated.status, 201)
    const raceRequest = (await raceCreated.json()) as { id: string }
    const raceStaffPath = self + "/requests/" + raceRequest.id
    const raceAdminPath = "/payroll/requests/" + raceRequest.id
    const [raceReview, raceWithdrawal] = await Promise.all([
      api(raceAdminPath, admin, "PATCH", {
        status: "IN_REVIEW",
        message: "I am beginning this review.",
      }),
      api(raceStaffPath, staff, "DELETE"),
    ])
    assert.notEqual(raceReview.status === 200, raceWithdrawal.status === 200)
    const finalRaceRecord =
      await prisma.payrollEmployeeRequest.findUniqueOrThrow({
        where: { id: raceRequest.id },
      })
    if (raceWithdrawal.status === 200) {
      assert.equal(finalRaceRecord.status, "CLOSED")
      assert.ok(finalRaceRecord.withdrawnAt)
      assert.equal(raceReview.status, 409)
    } else {
      assert.equal(finalRaceRecord.status, "IN_REVIEW")
      assert.equal(finalRaceRecord.withdrawnAt, null)
      assert.equal(raceWithdrawal.status, 409)
    }
    const editRaceCreated = await api(self + "/requests", staff, "POST", {
      type: "PAYROLL_DISCREPANCY",
      description: "Please check this concurrent edit concern.",
    })
    assert.equal(editRaceCreated.status, 201)
    const editRaceRequest = (await editRaceCreated.json()) as { id: string }
    const editRaceStaffPath = self + "/requests/" + editRaceRequest.id
    const editRaceAdminPath = "/payroll/requests/" + editRaceRequest.id
    const [editRaceReview, editRaceStaff] = await Promise.all([
      api(editRaceAdminPath, admin, "PATCH", {
        status: "IN_REVIEW",
        message: "Reviewing this concern now.",
      }),
      api(editRaceStaffPath, staff, "PATCH", {
        type: "PAYROLL_DISCREPANCY",
        payslipId: null,
        description: "Updated during the review race.",
      }),
    ])
    assert.equal(editRaceReview.status, 200)
    assert.ok(editRaceStaff.status === 200 || editRaceStaff.status === 409)
    const editRaceFinal = await prisma.payrollEmployeeRequest.findUniqueOrThrow(
      {
        where: { id: editRaceRequest.id },
        include: { messages: { where: { isAdmin: false } } },
      },
    )
    assert.equal(editRaceFinal.status, "IN_REVIEW")
    assert.equal(
      editRaceFinal.messages[0]?.body,
      editRaceStaff.status === 200
        ? "Updated during the review race."
        : "Please check this concurrent edit concern.",
    )
    const overviewWithConcern = (await (await api(self, staff)).json()) as {
      latestPayslip: { net: string } | null
      openConcernCount: number
    }
    assert.equal(
      overviewWithConcern.openConcernCount,
      raceReview.status === 200 ? 3 : 2,
    )
    assert.equal(overviewWithConcern.latestPayslip?.net, "12300.00")
    assert.equal((await api(staffRequest, other)).status, 404)
    assert.equal(
      (
        await api(adminRequest, superadmin, "PATCH", {
          status: "IN_REVIEW",
          message: "Checking the details.",
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await api(adminRequest, admin, "PATCH", {
          status: "RESOLVED",
          message: "Checking the details.",
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await api(adminRequest, admin, "PATCH", {
          status: "IN_REVIEW",
          message: "Checking the details.",
        })
      ).status,
      200,
    )
    assert.equal(
      (
        await api(staffRequest, staff, "PATCH", {
          type: "PAYSLIP_CORRECTION",
          description: "Too late to edit this concern.",
          payslipId: document.id,
        })
      ).status,
      409,
    )
    assert.equal((await api(staffRequest, staff, "DELETE")).status, 409)
    assert.equal(
      (
        await api(staffRequest + "/messages", staff, "POST", {
          message: "Thank you for checking.",
        })
      ).status,
      200,
    )
    const resolution = await api(adminRequest, admin, "PATCH", {
      status: "RESOLVED",
      message: "Correction requires a future approved adjustment.",
      needsFinancialCorrection: true,
    })
    assert.equal(resolution.status, 200)
    const resolved = (await resolution.json()) as {
      status: string
      needsFinancialCorrection: boolean
    }
    assert.equal(resolved.status, "RESOLVED")
    assert.equal(resolved.needsFinancialCorrection, true)
    const resolvedOverview = (await (await api(self, staff)).json()) as {
      openConcernCount: number
    }
    assert.equal(
      resolvedOverview.openConcernCount,
      raceReview.status === 200 ? 2 : 1,
    )
    const otherOverview = (await (await api(self, other)).json()) as {
      linked: boolean
      latestPayslip: { net: string } | null
      openConcernCount: number
    }
    assert.equal(otherOverview.linked, true)
    assert.equal(otherOverview.latestPayslip, null)
    assert.equal(otherOverview.openConcernCount, 0)
    await assert.rejects(
      prisma.payrollRunItem.update({
        where: { id: document.itemId },
        data: { netAmount: "1.00" },
      }),
    )
    assert.equal(
      (
        await api(staffRequest + "/messages", staff, "POST", {
          message: "One more detail.",
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await prisma.payrollRunCalculation.findUniqueOrThrow({
          where: { id: revision.id },
        })
      ).status,
      "COMPLETE",
    )
    assert.equal(
      await prisma.workforceManagementChange.count({
        where: { action: "PAYROLL_DOCUMENT_ACTIVITY" },
      }),
      13 + (editRaceStaff.status === 200 ? 1 : 0),
    )
  },
)
