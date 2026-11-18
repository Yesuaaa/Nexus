import { createManagementOperation } from "../../shared/management-history.js"
import {
  writeWorkforceManagementChange,
  type WorkforceManagementChangeInput,
} from "../employees/workforce-management-history.js"
import type { AuthContext } from "../auth/auth.middleware.js"
import { randomUUID } from "node:crypto"
import { Router } from "express"
import {
  PayrollRequestStatus,
  PayrollRequestType,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { isRecordId, recordIdParam } from "../../shared/validation.js"
import { paginate, parsePage } from "../../shared/query/pagination.js"
import {
  requireAuth,
  requirePermission,
  requireRole,
} from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { renderPayslipPdf } from "./payslip-pdf.js"
import { readPayrollPreferences } from "./payroll-preferences.js"

export const payrollDocumentsRouter = Router()
export const staffPayrollRouter = Router()
staffPayrollRouter.use(requireAuth, requireRole(Role.STAFF))
function payrollActivity(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  subjectType: "PAYROLL_RUN" | "PAYROLL_REQUEST",
  subjectId: string,
  changes: Extract<
    WorkforceManagementChangeInput,
    { action: "PAYROLL_DOCUMENT_ACTIVITY" }
  >["changes"],
  changedFields: Extract<
    WorkforceManagementChangeInput,
    { action: "PAYROLL_DOCUMENT_ACTIVITY" }
  >["changedFields"] = [],
) {
  return writeWorkforceManagementChange(
    tx,
    createManagementOperation(
      auth,
      auth.user.role === Role.STAFF ? "staff-payroll" : "management",
    ),
    {
      action: "PAYROLL_DOCUMENT_ACTIVITY",
      origin: "PAYROLL_MANAGEMENT",
      subjectType,
      subjectId,
      changedFields,
      changes,
    },
  )
}

const read = requirePermission(Permission.PAYROLL_READ)
const manage = requirePermission(Permission.PAYROLL_MANAGE)

for (const router of [payrollDocumentsRouter, staffPayrollRouter]) {
  router.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store")
    next()
  })
  router.param("id", recordIdParam("Invalid payroll reference"))
}

const slipSelect = {
  id: true,
  reference: true,
  generatedAt: true,
  generatedBy: true,
  publishedAt: true,
  publishedBy: true,
  item: {
    select: {
      employeeNameSnapshot: true,
      employeeNumberSnapshot: true,
      currency: true,
      grossAmount: true,
      deductionsAmount: true,
      netAmount: true,
      components: {
        where: { status: "CALCULATED" },
        orderBy: [{ componentType: "asc" }, { name: "asc" }],
        select: { name: true, componentType: true, amount: true },
      },
      calculation: {
        select: {
          id: true,
          revision: true,
          run: {
            select: {
              id: true,
              period: {
                select: {
                  cutoffLabel: true,
                  startDate: true,
                  endDate: true,
                  configuration: { select: { frequency: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PayrollPayslipSelect

type Slip = Prisma.PayrollPayslipGetPayload<{ select: typeof slipSelect }>

function slipView({ item, ...slip }: Slip) {
  const { calculation } = item
  return {
    ...slip,
    employeeName: item.employeeNameSnapshot,
    employeeNumber: item.employeeNumberSnapshot,
    currency: item.currency.trim(),
    gross: item.grossAmount?.toFixed(2),
    deductions: item.deductionsAmount?.toFixed(2),
    net: item.netAmount?.toFixed(2),
    lines: item.components.map((line) => ({
      ...line,
      amount: line.amount?.toFixed(2),
    })),
    revision: calculation.revision,
    calculationId: calculation.id,
    runId: calculation.run.id,
    period: calculation.run.period,
  }
}

async function staffEmployee(userId: string) {
  return getPrisma()!.employee.findUnique({
    where: { userId },
    select: { id: true },
  })
}

const ownSlips = (employeeId: string): Prisma.PayrollPayslipWhereInput => ({
  item: { employeeId },
  publishedAt: { not: null },
})

function pageNumber(value: unknown) {
  const page = parsePage(value)
  if (page === null) fail(400, "Invalid page")
  return page
}

async function listSlips(page: number, where: Prisma.PayrollPayslipWhereInput) {
  const result = await paginate(page, {
    rows: (db, window) =>
      db.payrollPayslip.findMany({
        where,
        select: slipSelect,
        orderBy: [
          { item: { calculation: { run: { period: { endDate: "desc" } } } } },
          { id: "desc" },
        ],
        ...window,
      }),
    count: (db) => db.payrollPayslip.count({ where }),
  })
  return { ...result, rows: result.rows.map(slipView) }
}

async function getSlip(id: string, scope: Prisma.PayrollPayslipWhereInput) {
  const slip = await getPrisma()!.payrollPayslip.findFirst({
    where: { ...scope, id },
    select: slipSelect,
  })
  if (!slip) fail(404, "Payslip not found")
  return slipView(slip)
}

async function downloadSlip(
  id: string,
  scope: Prisma.PayrollPayslipWhereInput,
) {
  const slip = await getPrisma()!.payrollPayslip.findFirst({
    where: { ...scope, id },
    select: { reference: true, document: true },
  })
  if (!slip) fail(404, "Payslip not found")
  return slip
}

type ApprovedPayslipItem = {
  employeeNameSnapshot: string
  employeeNumberSnapshot: string
  currency: string
  grossAmount: Prisma.Decimal | null
  deductionsAmount: Prisma.Decimal | null
  netAmount: Prisma.Decimal | null
  status: string
  components: {
    componentType: string
    status: string
    name: string
    amount: Prisma.Decimal | null
  }[]
}

type ApprovedPayslipRun = {
  period: {
    cutoffLabel: string
    startDate: Date
    endDate: Date
    configuration: { frequency: string }
  }
}

function assertRenderablePayslipItem(item: ApprovedPayslipItem) {
  if (
    item.status !== "CALCULATED" ||
    !item.grossAmount ||
    !item.deductionsAmount ||
    !item.netAmount ||
    !item.components.some(
      ({ componentType }) => componentType === "BASE_EARNING",
    ) ||
    item.components.some(
      ({ status, amount }) => status !== "CALCULATED" || amount === null,
    )
  )
    fail(409, "An approved employee result is missing its financial breakdown")
}

function renderApprovedPayslipDocument(
  item: ApprovedPayslipItem,
  run: ApprovedPayslipRun,
  revision: number,
  reference: string,
  generatedAt: Date,
  preferences: Awaited<ReturnType<typeof readPayrollPreferences>>,
) {
  assertRenderablePayslipItem(item)
  const lineView = (line: ApprovedPayslipItem["components"][number]) => ({
    name: line.name,
    amount: line.amount!.toFixed(2),
  })
  return renderPayslipPdf({
    employee: item.employeeNameSnapshot,
    showCompanyLogo: preferences.showCompanyLogo,
    employeeId: preferences.showEmployeeId
      ? item.employeeNumberSnapshot
      : undefined,
    period: run.period.cutoffLabel,
    dates: `${run.period.startDate.toISOString().slice(0, 10)} to ${run.period.endDate.toISOString().slice(0, 10)}`,
    frequency:
      run.period.configuration.frequency === "MONTHLY"
        ? "Monthly"
        : "Semi-monthly",
    revision,
    reference,
    generatedOn: generatedAt.toISOString().slice(0, 10),
    earnings: item.components
      .filter((line) => line.componentType !== "DEDUCTION")
      .map(lineView),
    deductions: item.components
      .filter((line) => line.componentType === "DEDUCTION")
      .map(lineView),
    gross: item.grossAmount!.toFixed(2),
    totalDeductions: item.deductionsAmount!.toFixed(2),
    net: item.netAmount!.toFixed(2),
  })
}

payrollDocumentsRouter.get("/payslips", read, async (req, res) => {
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().slice(0, 100)
      : ""
  const status = req.query.status
  if (status && status !== "published" && status !== "generated")
    fail(400, "Invalid publication filter")
  const where: Prisma.PayrollPayslipWhereInput = {
    ...(status
      ? { publishedAt: status === "published" ? { not: null } : null }
      : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" } },
            {
              item: {
                employeeNameSnapshot: { contains: search, mode: "insensitive" },
              },
            },
            {
              item: {
                calculation: {
                  run: {
                    period: {
                      cutoffLabel: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
  }
  return res.json(await listSlips(pageNumber(req.query.page), where))
})
payrollDocumentsRouter.get("/payslips/:id", read, async (req, res) =>
  res.json(await getSlip(String(req.params.id), {})),
)

for (const [router, guards, staff] of [
  [payrollDocumentsRouter, [read], false],
  [staffPayrollRouter, [], true],
] as const) {
  router.get("/payslips/:id/download", ...guards, async (req, res) => {
    const employee = staff ? await staffEmployee(req.auth!.user.id) : null
    if (staff && !employee) fail(404, "Payslip not found")
    const slip = await downloadSlip(
      String(req.params.id),
      employee ? ownSlips(employee.id) : {},
    )
    return res
      .attachment(slip.reference + ".pdf")
      .type("application/pdf")
      .set("X-Content-Type-Options", "nosniff")
      .send(Buffer.from(slip.document))
  })
  router.get("/payslips/:id/preview", ...guards, async (req, res) => {
    const employee = staff ? await staffEmployee(req.auth!.user.id) : null
    if (staff && !employee) fail(404, "Payslip not found")
    const slip = await downloadSlip(
      String(req.params.id),
      employee ? ownSlips(employee.id) : {},
    )
    return res
      .type("application/pdf")
      .set(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(slip.reference)}.pdf"`,
      )
      .set("X-Content-Type-Options", "nosniff")
      .send(Buffer.from(slip.document))
  })
}

export async function approvedRevision(
  tx: Prisma.TransactionClient,
  runId: string,
) {
  const run = await tx.payrollRun.findUnique({
    where: { id: runId },
    include: {
      period: { include: { configuration: { select: { frequency: true } } } },
    },
  })
  if (!run) fail(404, "Payroll run not found")
  if (run.status !== "APPROVED")
    fail(409, "Payslips require an approved payroll run")
  const revision = await tx.payrollRunCalculation.findFirst({
    where: {
      runId,
      revision: run.calculationCount,
      status: "COMPLETE",
      approvalEvents: { some: { action: "PAYROLL_APPROVED" } },
    },
    include: {
      items: {
        include: { components: true, payslip: { select: { id: true } } },
      },
    },
  })
  if (!revision?.items.length)
    fail(409, "The approved calculation has no employee results")
  return { run, revision }
}

for (const action of ["generate", "publish"] as const) {
  payrollDocumentsRouter.post(
    "/runs/:id/" + action + "-payslips",
    manage,
    async (req, res) => {
      const runId = String(req.params.id)
      const actorId = req.auth!.user.id
      const result = await getPrisma()!.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(848225, hashtext(${runId}))`
        const { run, revision } = await approvedRevision(tx, runId)
        const where = { item: { calculationId: revision.id } }
        if (action === "publish") {
          const total = await tx.payrollPayslip.count({ where })
          if (total !== revision.items.length)
            fail(409, "Generate all payslips before publishing")
          const { count } = await tx.payrollPayslip.updateMany({
            where: { ...where, publishedAt: null },
            data: { publishedAt: new Date(), publishedBy: actorId },
          })
          if (count)
            await payrollActivity(tx, req.auth!, "PAYROLL_RUN", runId, {
              activity: "PUBLISHED",
              calculationId: revision.id,
            })
          return { total, changed: count }
        }

        const generatedAt = new Date()
        const preferences = await readPayrollPreferences(tx)
        const rows = revision.items
          .filter((item) => !item.payslip)
          .map((item) => {
            const reference = "PS-" + randomUUID()
            const document = renderApprovedPayslipDocument(
              item,
              run,
              revision.revision,
              reference,
              generatedAt,
              preferences,
            )
            return {
              itemId: item.id,
              reference,
              document,
              generatedAt,
              generatedBy: actorId,
            }
          })
        const { count } = rows.length
          ? await tx.payrollPayslip.createMany({ data: rows })
          : { count: 0 }
        if (count)
          await payrollActivity(tx, req.auth!, "PAYROLL_RUN", runId, {
            activity: "GENERATED",
            calculationId: revision.id,
          })
        return { total: revision.items.length, changed: count }
      })
      return res.json(result)
    },
  )
}

payrollDocumentsRouter.post(
  "/payslips/:id/regenerate",
  manage,
  async (req, res) => {
    const payslipId = String(req.params.id)
    const actorId = req.auth!.user.id
    const result = await getPrisma()!.$transaction(async (tx) => {
      const link = await tx.payrollPayslip.findUnique({
        where: { id: payslipId },
        select: {
          itemId: true,
          publishedAt: true,
          item: { select: { calculation: { select: { runId: true } } } },
        },
      })
      if (!link) fail(404, "Payslip not found")
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(848225, hashtext(${link.item.calculation.runId}))`
      const { run, revision } = await approvedRevision(
        tx,
        link.item.calculation.runId,
      )
      const item = revision.items.find(
        (candidate) => candidate.id === link.itemId,
      )
      if (!item) fail(404, "Payslip not found")
      if (link.publishedAt) {
        fail(409, "Published payslips cannot be regenerated")
      }
      const generatedAt = new Date()
      const current = await tx.payrollPayslip.findUnique({
        where: { id: payslipId },
        select: { reference: true, publishedAt: true },
      })
      if (!current) fail(404, "Payslip not found")
      if (current.publishedAt) {
        fail(409, "Published payslips cannot be regenerated")
      }
      const document = renderApprovedPayslipDocument(
        item,
        run,
        revision.revision,
        current.reference,
        generatedAt,
        await readPayrollPreferences(tx),
      )
      const updated = await tx.payrollPayslip.update({
        where: { id: payslipId },
        data: { document, generatedAt, generatedBy: actorId },
        select: { id: true, reference: true, generatedAt: true },
      })
      await payrollActivity(tx, req.auth!, "PAYROLL_RUN", run.id, {
        activity: "REGENERATED",
        calculationId: revision.id,
      })
      return {
        ...updated,
        generatedAt: updated.generatedAt.toISOString(),
      }
    })
    return res.json(result)
  },
)

const requestSelect = {
  id: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  withdrawnAt: true,
  withdrawnBy: true,
  needsFinancialCorrection: true,
  employee: { select: { fullName: true, employeeId: true } },
  payslip: { select: { id: true, reference: true } },
  messages: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, body: true, isAdmin: true, createdAt: true },
  },
} satisfies Prisma.PayrollEmployeeRequestSelect

function requestFilters(
  query: Record<string, unknown>,
): Prisma.PayrollEmployeeRequestWhereInput {
  const { status, type } = query
  if (
    status &&
    !Object.values(PayrollRequestStatus).includes(
      status as PayrollRequestStatus,
    )
  )
    fail(400, "Invalid request status")
  if (
    type &&
    !Object.values(PayrollRequestType).includes(type as PayrollRequestType)
  )
    fail(400, "Invalid request type")
  const search =
    typeof query.search === "string" ? query.search.trim().slice(0, 100) : ""
  const normalizedSearch = search.toLowerCase().replaceAll("_", " ")
  const matchingTypes = Object.values(PayrollRequestType).filter((value) =>
    value.toLowerCase().replaceAll("_", " ").includes(normalizedSearch),
  )
  const matchingStatuses = Object.values(PayrollRequestStatus).filter((value) =>
    value.toLowerCase().replaceAll("_", " ").includes(normalizedSearch),
  )
  const searchTerms: Prisma.PayrollEmployeeRequestWhereInput[] = search
    ? [
        { id: { contains: search, mode: "insensitive" } },
        {
          messages: {
            some: {
              isAdmin: false,
              body: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          payslip: {
            is: {
              reference: { contains: search, mode: "insensitive" },
            },
          },
        },
        ...(matchingTypes.length ? [{ type: { in: matchingTypes } }] : []),
        ...(matchingStatuses.length
          ? [{ status: { in: matchingStatuses } }]
          : []),
      ]
    : []
  return {
    ...(status ? { status: status as PayrollRequestStatus } : {}),
    ...(type ? { type: type as PayrollRequestType } : {}),
    ...(searchTerms.length ? { AND: [{ OR: searchTerms }] } : {}),
  }
}

function message(value: unknown, required = true) {
  const text = typeof value === "string" ? value.trim() : ""
  if (
    (required || value !== undefined) &&
    (text.length < 5 || text.length > 2000)
  )
    fail(400, "Enter 5 to 2,000 characters")
  return text
}

async function listRequests(
  page: number,
  where: Prisma.PayrollEmployeeRequestWhereInput,
) {
  return paginate(page, {
    rows: (db, window) =>
      db.payrollEmployeeRequest.findMany({
        where,
        select: requestSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...window,
      }),
    count: (db) => db.payrollEmployeeRequest.count({ where }),
  })
}

async function getRequest(id: string, employeeId?: string) {
  const request = await getPrisma()!.payrollEmployeeRequest.findFirst({
    where: {
      id,
      ...(employeeId ? { employeeId, withdrawnAt: null } : {}),
    },
    select: requestSelect,
  })
  if (!request) fail(404, "Payroll request not found")
  const activity = await getPrisma()!.workforceManagementChange.findMany({
    where: {
      subjectType: "PAYROLL_REQUEST",
      subjectId: id,
      origin: "PAYROLL_MANAGEMENT",
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      action: true,
      actorRoleAtTime: true,
      changedFields: true,
      changes: true,
      createdAt: true,
    },
  })
  return { ...request, activity }
}

payrollDocumentsRouter.get("/requests", read, async (req, res) =>
  res.json(
    await listRequests(pageNumber(req.query.page), requestFilters(req.query)),
  ),
)
payrollDocumentsRouter.get("/requests/:id", read, async (req, res) =>
  res.json(await getRequest(String(req.params.id))),
)

async function updateRequest(
  id: string,
  auth: AuthContext,
  employeeId: string | undefined,
  nextStatus: PayrollRequestStatus | undefined,
  body: string,
  needsFinancialCorrection?: boolean,
) {
  return getPrisma()!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(848226, hashtext(${id}))`
    const current = await tx.payrollEmployeeRequest.findFirst({
      where: { id, employeeId },
    })
    if (!current) fail(404, "Payroll request not found")
    if (current.withdrawnAt) fail(409, "This payroll concern was withdrawn")
    if (current.status === "RESOLVED" || current.status === "CLOSED")
      fail(409, "This request is closed to updates")
    if (
      nextStatus &&
      nextStatus !== current.status &&
      !(
        (current.status === "OPEN" &&
          (nextStatus === "IN_REVIEW" || nextStatus === "CLOSED")) ||
        (current.status === "IN_REVIEW" &&
          (nextStatus === "RESOLVED" || nextStatus === "CLOSED"))
      )
    )
      fail(409, "This request cannot move to the selected status")
    if (
      needsFinancialCorrection !== undefined &&
      current.type !== "PAYSLIP_CORRECTION" &&
      current.type !== "PAYROLL_DISCREPANCY"
    )
      fail(
        400,
        "Only a correction or discrepancy can require a financial correction",
      )
    const updated = await tx.payrollEmployeeRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        needsFinancialCorrection,
        updatedAt: new Date(),
        ...(nextStatus === "RESOLVED" || nextStatus === "CLOSED"
          ? { resolvedAt: new Date() }
          : {}),
        messages: {
          create: {
            actorId: auth.user.id,
            isAdmin: employeeId === undefined,
            body,
          },
        },
      },
      select: requestSelect,
    })
    const changedFields: Array<"requestStatus" | "correctionFlag"> = []
    if (current.status !== updated.status) changedFields.push("requestStatus")
    if (current.needsFinancialCorrection !== updated.needsFinancialCorrection)
      changedFields.push("correctionFlag")
    await payrollActivity(
      tx,
      auth,
      "PAYROLL_REQUEST",
      id,
      {
        activity: employeeId ? "REQUEST_MESSAGE" : "REQUEST_UPDATED",
        ...(current.status !== updated.status
          ? { requestStatus: { before: current.status, after: updated.status } }
          : {}),
        ...(current.needsFinancialCorrection !==
        updated.needsFinancialCorrection
          ? {
              correctionFlag: {
                before: current.needsFinancialCorrection,
                after: updated.needsFinancialCorrection,
              },
            }
          : {}),
      },
      changedFields,
    )
    return updated
  })
}

async function editStaffRequest(
  id: string,
  auth: AuthContext,
  employeeId: string,
  type: PayrollRequestType,
  description: string,
  payslipId: string | null,
) {
  return getPrisma()!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(848226, hashtext(${id}))`
    const current = await tx.payrollEmployeeRequest.findFirst({
      where: { id, employeeId },
      select: requestSelect,
    })
    if (!current) fail(404, "Payroll concern not found")
    if (current.withdrawnAt || current.status !== "OPEN")
      fail(409, "Only open payroll concerns can be edited")

    if (payslipId) {
      const payslip = await tx.payrollPayslip.findFirst({
        where: { id: payslipId, ...ownSlips(employeeId) },
        select: { id: true },
      })
      if (!payslip) fail(400, "Select one of your published payslips")
    }

    const originalMessage = await tx.payrollRequestMessage.findFirst({
      where: { requestId: id, isAdmin: false },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, body: true },
    })
    if (!originalMessage) fail(409, "The concern description is unavailable")

    const changedFields: Array<"type" | "description" | "payslipId"> = []
    const changes: Extract<
      WorkforceManagementChangeInput,
      { action: "PAYROLL_DOCUMENT_ACTIVITY" }
    >["changes"] = { activity: "REQUEST_EDITED" }
    if (current.type !== type) {
      changes.type = { before: current.type, after: type }
      changedFields.push("type")
    }
    if (originalMessage.body !== description) {
      changes.description = {
        before: originalMessage.body,
        after: description,
      }
      changedFields.push("description")
    }
    if (current.payslip?.id !== payslipId) {
      changes.payslipId = {
        before: current.payslip?.id ?? null,
        after: payslipId,
      }
      changedFields.push("payslipId")
    }
    if (!changedFields.length) return current

    const now = new Date()
    await tx.payrollEmployeeRequest.update({
      where: { id },
      data: { type, payslipId, updatedAt: now },
    })
    if (originalMessage.body !== description)
      await tx.payrollRequestMessage.update({
        where: { id: originalMessage.id },
        data: { body: description },
      })
    await payrollActivity(
      tx,
      auth,
      "PAYROLL_REQUEST",
      id,
      changes,
      changedFields,
    )
    return tx.payrollEmployeeRequest.findUniqueOrThrow({
      where: { id },
      select: requestSelect,
    })
  })
}

async function withdrawStaffRequest(
  id: string,
  auth: AuthContext,
  employeeId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(848226, hashtext(${id}))`
    const current = await tx.payrollEmployeeRequest.findFirst({
      where: { id, employeeId },
      select: requestSelect,
    })
    if (!current) fail(404, "Payroll concern not found")
    if (current.withdrawnAt || current.status !== "OPEN")
      fail(409, "Only open payroll concerns can be deleted")

    const now = new Date()
    const updated = await tx.payrollEmployeeRequest.update({
      where: { id },
      data: {
        status: "CLOSED",
        withdrawnAt: now,
        withdrawnBy: auth.user.id,
        updatedAt: now,
      },
      select: requestSelect,
    })
    await payrollActivity(
      tx,
      auth,
      "PAYROLL_REQUEST",
      id,
      {
        activity: "REQUEST_WITHDRAWN",
        requestStatus: { before: current.status, after: updated.status },
        withdrawnAt: { before: null, after: now.toISOString() },
        withdrawnBy: { before: null, after: auth.user.id },
      },
      ["requestStatus", "withdrawnAt", "withdrawnBy"],
    )
    return updated
  })
}

payrollDocumentsRouter.patch("/requests/:id", manage, async (req, res) => {
  const next = requestFilters({ status: req.body?.status }).status as
    PayrollRequestStatus | undefined
  const correction = req.body?.needsFinancialCorrection
  if (correction !== undefined && typeof correction !== "boolean")
    fail(400, "Invalid correction flag")
  return res.json(
    await updateRequest(
      String(req.params.id),
      req.auth!,
      undefined,
      next,
      message(req.body?.message),
      correction,
    ),
  )
})

staffPayrollRouter.get("/", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  if (!employee)
    return res.json({
      linked: false,
      latestPayslip: null,
      recentRequests: [],
      openConcernCount: 0,
    })
  const [slips, requests, openConcernCount] = await Promise.all([
    listSlips(1, ownSlips(employee.id)),
    listRequests(1, { employeeId: employee.id, withdrawnAt: null }),
    getPrisma()!.payrollEmployeeRequest.count({
      where: {
        employeeId: employee.id,
        withdrawnAt: null,
        status: { in: ["OPEN", "IN_REVIEW"] },
      },
    }),
  ])
  return res.json({
    linked: true,
    latestPayslip: slips.rows[0] ?? null,
    recentRequests: requests.rows.slice(0, 3),
    openConcernCount,
  })
})
staffPayrollRouter.get("/payslips", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  const page = pageNumber(req.query.page)
  return res.json(
    employee
      ? await listSlips(page, ownSlips(employee.id))
      : { rows: [], total: 0, page, pageSize: 10 },
  )
})
staffPayrollRouter.get("/payslips/:id", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  if (!employee) fail(404, "Payslip not found")
  return res.json(await getSlip(String(req.params.id), ownSlips(employee.id)))
})
staffPayrollRouter.get("/requests", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  const page = pageNumber(req.query.page)
  return res.json(
    employee
      ? await listRequests(page, {
          employeeId: employee.id,
          withdrawnAt: null,
          ...requestFilters(req.query),
        })
      : { rows: [], total: 0, page, pageSize: 10 },
  )
})
staffPayrollRouter.get("/requests/:id", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  if (!employee) fail(404, "Payroll request not found")
  return res.json(await getRequest(String(req.params.id), employee.id))
})
staffPayrollRouter.post("/requests", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  if (!employee) fail(403, "Your Staff account has no linked employee record")
  const type = requestFilters({ type: req.body?.type }).type as
    PayrollRequestType | undefined
  if (!type) fail(400, "Select a payroll request type")
  const body = message(req.body?.description)
  const payslipId = req.body?.payslipId
  if (payslipId != null && !isRecordId(payslipId))
    fail(400, "Invalid payslip reference")
  if (payslipId) await getSlip(payslipId, ownSlips(employee.id))
  const created = await getPrisma()!.$transaction(async (tx) => {
    const request = await tx.payrollEmployeeRequest.create({
      data: {
        employeeId: employee.id,
        type,
        payslipId,
        createdBy: req.auth!.user.id,
        messages: {
          create: { actorId: req.auth!.user.id, isAdmin: false, body },
        },
      },
      select: requestSelect,
    })
    await payrollActivity(tx, req.auth!, "PAYROLL_REQUEST", request.id, {
      activity: "REQUEST_CREATED",
    })
    return request
  })
  return res.status(201).json(created)
})
staffPayrollRouter.patch("/requests/:id", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  if (!employee) fail(403, "Your Staff account has no linked employee record")
  const type = requestFilters({ type: req.body?.type }).type as
    PayrollRequestType | undefined
  if (!type) fail(400, "Select a payroll concern type")
  const description = message(req.body?.description)
  if (!Object.hasOwn(req.body ?? {}, "payslipId"))
    fail(400, "Include a related payslip reference or null")
  const payslipId = req.body?.payslipId
  if (payslipId !== null && !isRecordId(payslipId))
    fail(400, "Invalid payslip reference")
  return res.json(
    await editStaffRequest(
      String(req.params.id),
      req.auth!,
      employee.id,
      type,
      description,
      payslipId,
    ),
  )
})
staffPayrollRouter.delete("/requests/:id", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  if (!employee) fail(403, "Your Staff account has no linked employee record")
  return res.json(
    await withdrawStaffRequest(String(req.params.id), req.auth!, employee.id),
  )
})
staffPayrollRouter.post("/requests/:id/messages", async (req, res) => {
  const employee = await staffEmployee(req.auth!.user.id)
  if (!employee) fail(404, "Payroll request not found")
  return res.json(
    await updateRequest(
      String(req.params.id),
      req.auth!,
      employee.id,
      undefined,
      message(req.body?.message),
    ),
  )
})
