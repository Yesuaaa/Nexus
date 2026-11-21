import { serializePayrollExport } from "./payroll-report-export.js"
import {
  readPayrollReadiness,
  readPayrollAudit,
} from "./payroll-administration.service.js"
import {
  payrollReportFilters,
  readPayrollReport,
  payrollReportCsv,
} from "./payroll-reports.service.js"
import { readPayrollOverview } from "./payroll-overview.service.js"
import { createManagementOperation } from "../../shared/management-history.js"
import {
  readReconciliation,
  recordReconciliationExceptions,
  decideReconciliationException,
  readExceptionDecisions,
} from "./payroll-reconciliation.service.js"
import { disbursementsRouter } from "./payroll-disbursements.controller.js"
import { Router } from "express"
import {
  PayrollFrequency,
  PayrollPayType,
  PayrollRunStatus,
  PayrollSandboxDestinationKind,
} from "../../generated/prisma/client.js"
import { fail, mapPrismaErrors } from "../../shared/http-error.js"
import { parsePage } from "../../shared/query/pagination.js"
import { parseQueryString } from "../../shared/query-helpers.js"
import { isRecordId, recordIdParam } from "../../shared/validation.js"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import {
  validateCompensationVersion,
  validatePayrollConfiguration,
} from "./payroll.schema.js"
import { payrollService } from "./payroll.service.js"
import { payrollRunsService } from "./payroll-runs.service.js"
import { isPayrollSimulatorEnabled } from "./payroll-simulator.js"
import { payMongoDisbursements } from "./paymongo-disbursements.js"
import {
  readPayrollPreferences,
  updatePayrollPreferences,
} from "./payroll-preferences.js"
import {
  validatePayrollPeriodGeneration,
  validatePayrollRunCreation,
} from "./payroll-runs.schema.js"

import { payrollDocumentsRouter } from "./payroll-documents.controller.js"

export const payrollRouter = Router()
payrollRouter.use(requireAuth)
payrollRouter.use(payrollDocumentsRouter, disbursementsRouter)

payrollRouter.get(
  "/reports",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const page = parsePage(request.query.page)
    if (page === null) fail(400, "Invalid report page")
    response.set("Cache-Control", "no-store")
    response.json(
      await readPayrollReport(payrollReportFilters(request.query), page),
    )
  },
)

payrollRouter.get(
  "/reports/export",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) => {
    const filters = payrollReportFilters(request.query)
    const format = request.query.format
    if (format !== undefined && format !== "csv" && format !== "xlsx")
      fail(400, "Choose CSV or Excel")
    const report = await readPayrollReport(
      filters,
      1,
      true,
      format !== undefined,
    )
    response.set("Cache-Control", "private, no-store")
    if (format === undefined) {
      response.attachment("payroll-" + filters.kind + ".csv")
      response
        .type("text/csv; charset=utf-8")
        .send(payrollReportCsv(report.columns, report.rows))
      return
    }
    const file = serializePayrollExport(filters, report, format)
    response.attachment(file.filename).type(file.type).send(file.content)
  },
)

payrollRouter.get(
  "/overview",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const range = request.query.periods ?? "6"
    if (range !== "3" && range !== "6" && range !== "12")
      fail(400, "Select 3, 6, or 12 payroll periods")
    response.set("Cache-Control", "no-store")
    response.json(await readPayrollOverview(Number(range)))
  },
)

payrollRouter.get(
  "/periods/current",
  requirePermission(Permission.PAYROLL_READ),
  async (_request, response) =>
    response.json(await payrollRunsService.currentPeriod()),
)

payrollRouter.get(
  "/periods",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const page = parsePage(request.query.page)
    const year = parseQueryString(request.query.year)
    if (
      page === null ||
      year === null ||
      (year !== "" && !/^\d{4}$/.test(year)) ||
      (year !== "" && (Number(year) < 1900 || Number(year) > 9999))
    )
      return response
        .status(400)
        .json({ error: "Invalid payroll period filters" })
    return response.json(
      await payrollRunsService.listPeriods({
        page,
        year: year ? Number(year) : null,
      }),
    )
  },
)

payrollRouter.post(
  "/periods",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) => {
    const parsed = validatePayrollPeriodGeneration(request.body)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    return response
      .status(201)
      .json(
        await payrollRunsService.generatePeriods(
          request.auth!,
          parsed.value.year,
        ),
      )
  },
)

payrollRouter.get(
  ["/runs", "/approvals"],
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const page = parsePage(request.query.page)
    const search = parseQueryString(request.query.search)
    const status = parseQueryString(request.query.status)
    const frequency = parseQueryString(request.query.frequency)
    if (
      page === null ||
      search === null ||
      status === null ||
      frequency === null ||
      search.length > 100 ||
      (status !== "" &&
        !Object.values(PayrollRunStatus).includes(
          status as PayrollRunStatus,
        )) ||
      (frequency !== "" &&
        !Object.values(PayrollFrequency).includes(
          frequency as PayrollFrequency,
        ))
    )
      return response.status(400).json({ error: "Invalid payroll run filters" })
    return response.json(
      await payrollRunsService.listRuns({
        page,
        search,
        status: status as "" | PayrollRunStatus,
        approvals: /^\/approvals\/?$/i.test(request.path),
        frequency: frequency as "" | "MONTHLY" | "SEMI_MONTHLY",
      }),
    )
  },
)

payrollRouter.post(
  "/runs",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) => {
    const parsed = validatePayrollRunCreation(request.body)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    return response
      .status(201)
      .json(
        await payrollRunsService.createRun(
          request.auth!,
          parsed.value.periodId,
        ),
      )
  },
)

payrollRouter.param("runId", recordIdParam("Invalid payroll run reference"))

payrollRouter.get(
  "/runs/:runId/reconciliation",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const page = parsePage(request.query.page)
    const exceptionPage = parsePage(request.query.exceptionPage)
    const search = parseQueryString(request.query.search)
    const payoutStatus = parseQueryString(request.query.payoutStatus)
    const category = parseQueryString(request.query.category)
    const observation = parseQueryString(request.query.observation)
    if (
      page === null ||
      exceptionPage === null ||
      search === null ||
      search.length > 200 ||
      payoutStatus === null ||
      ![
        "",
        "SUCCEEDED",
        "PENDING",
        "FAILED",
        "MATCHED",
        "EXCEPTION",
        "NOT_STARTED",
      ].includes(payoutStatus) ||
      category === null ||
      ![
        "",
        "AMOUNT_MISMATCH",
        "MISSING_PAYOUT_RECORD",
        "FAILED_PAYOUT",
        "UNMATCHED_PAYOUT",
      ].includes(category) ||
      observation === null ||
      !["", "CURRENT", "HISTORICAL"].includes(observation)
    )
      fail(400, "Invalid reconciliation filters")
    response.set("Cache-Control", "no-store")
    response.json(
      await readReconciliation(
        String(request.params.runId),
        page,
        exceptionPage,
        { search, payoutStatus, category, observation },
      ),
    )
  },
)

payrollRouter.post(
  "/runs/:runId/reconciliation/observations",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) => {
    response.set("Cache-Control", "no-store")
    response.json({
      observed: await recordReconciliationExceptions(
        String(request.params.runId),
        createManagementOperation(request.auth!),
      ),
    })
  },
)
payrollRouter.get(
  "/runs/:runId/reconciliation/exceptions/:category/:subjectId/decisions",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    response.set("Cache-Control", "no-store")
    response.json(
      await readExceptionDecisions(
        String(request.params.runId),
        String(request.params.category),
        String(request.params.subjectId),
      ),
    )
  },
)

payrollRouter.post(
  "/runs/:runId/reconciliation/decisions",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) => {
    response.set("Cache-Control", "no-store")
    response.json(
      await decideReconciliationException(
        String(request.params.runId),
        request.body,
        createManagementOperation(request.auth!),
      ),
    )
  },
)

payrollRouter.param("itemId", recordIdParam("Invalid payroll item reference"))

payrollRouter.get(
  "/runs/:runId/items/:itemId",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) =>
    response.json(
      await payrollRunsService.getItem(
        String(request.params.runId),
        String(request.params.itemId),
      ),
    ),
)

payrollRouter.get(
  "/runs/:runId/items",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const page = parsePage(request.query.page)
    const search = parseQueryString(request.query.search)
    const calculationId = parseQueryString(request.query.calculationId)
    if (
      page === null ||
      search === null ||
      calculationId === null ||
      search.length > 100 ||
      (calculationId !== "" && !isRecordId(calculationId))
    )
      return response
        .status(400)
        .json({ error: "Invalid payroll item filters" })
    return response.json(
      await payrollRunsService.listItems({
        runId: String(request.params.runId),
        page,
        search,
        calculationId,
      }),
    )
  },
)

payrollRouter.post(
  "/runs/:runId/calculate",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) =>
    response.json(
      await payrollRunsService.calculateRun(
        request.auth!,
        String(request.params.runId),
      ),
    ),
)

payrollRouter.get(
  "/runs/:runId/approval-history",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const run = await payrollRunsService.getRun(String(request.params.runId))
    return response.json(
      run.calculationHistory.flatMap((revision) =>
        revision.approvalEvents.map((event) => ({
          ...event,
          revision: revision.revision,
        })),
      ),
    )
  },
)

for (const action of ["submit", "approve", "reject"] as const) {
  payrollRouter.post(
    "/runs/:runId/" + action,
    requirePermission(Permission.PAYROLL_MANAGE),
    async (request, response) => {
      const calculationId = request.body?.calculationId
      const reason =
        typeof request.body?.reason === "string"
          ? request.body.reason.trim()
          : ""
      if (typeof calculationId !== "string" || !isRecordId(calculationId))
        return response
          .status(400)
          .json({ error: "A valid calculation revision is required" })
      if (action === "reject" && (reason.length < 5 || reason.length > 500))
        return response.status(400).json({
          error: "Enter a rejection reason between 5 and 500 characters",
        })
      return response.json(
        await payrollRunsService.transitionApproval(
          request.auth!,
          String(request.params.runId),
          calculationId,
          action,
          action === "reject" ? reason : undefined,
        ),
      )
    },
  )
}
payrollRouter.get(
  "/runs/:runId",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) =>
    response.json(
      await payrollRunsService.getRun(String(request.params.runId)),
    ),
)

payrollRouter.get(
  "/compensation",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const search = parseQueryString(request.query.search)
    const departmentId = parseQueryString(request.query.departmentId)
    const payType = parseQueryString(request.query.payType)
    const status = parseQueryString(request.query.status)
    const page = parsePage(request.query.page)
    const allowedStatus = [
      "",
      "CONFIGURED",
      "NOT_CONFIGURED",
      "FUTURE_REVISION",
    ]
    if (
      search === null ||
      departmentId === null ||
      payType === null ||
      status === null ||
      search.length > 100 ||
      (departmentId && !isRecordId(departmentId)) ||
      (payType &&
        !Object.values(PayrollPayType).includes(payType as PayrollPayType)) ||
      !allowedStatus.includes(status) ||
      page === null
    )
      return response
        .status(400)
        .json({ error: "Invalid compensation filters" })

    return response.json(
      await payrollService.listCompensation({
        search,
        departmentId,
        payType: payType as PayrollPayType | "",
        status: status as
          "CONFIGURED" | "NOT_CONFIGURED" | "FUTURE_REVISION" | "",
        page,
      }),
    )
  },
)

payrollRouter.param("employeeId", recordIdParam("Invalid employee reference"))
payrollRouter.get(
  "/compensation/:employeeId/history",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) =>
    response.json(
      await payrollService.getCompensationHistory(
        String(request.params.employeeId),
      ),
    ),
)
payrollRouter.get(
  "/compensation/:employeeId",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) =>
    response.json(
      await payrollService.getEmployeeCompensation(
        String(request.params.employeeId),
      ),
    ),
)
payrollRouter.post(
  "/compensation/:employeeId/versions",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) => {
    const parsed = validateCompensationVersion(request.body)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    return response
      .status(201)
      .json(
        await payrollService.createCompensationVersion(
          request.auth!,
          String(request.params.employeeId),
          parsed.value,
        ),
      )
  },
)

payrollRouter.get(
  "/settings/readiness",
  requirePermission(Permission.PAYROLL_READ),
  async (_request, response) => {
    response.set("Cache-Control", "private, no-store")
    response.json(await readPayrollReadiness())
  },
)

payrollRouter.get(
  "/settings/audit",
  requirePermission(Permission.PAYROLL_READ),
  async (request, response) => {
    const page = parsePage(request.query.page)
    if (page === null) fail(400, "Invalid audit page")
    response.set("Cache-Control", "private, no-store")
    response.json(await readPayrollAudit(page, request.query.subject))
  },
)
payrollRouter.get(
  "/settings/history",
  requirePermission(Permission.PAYROLL_READ),
  async (_request, response) =>
    response.json(await payrollService.getPayrollSettingsHistory()),
)
payrollRouter.get(
  "/settings",
  requirePermission(Permission.PAYROLL_READ),
  async (_request, response) =>
    response.json({
      ...(await payrollService.getPayrollSettings()),
      capabilities: {
        simulatorEnabled: isPayrollSimulatorEnabled(),
        payMongoEnabled: payMongoDisbursements.enabled,
        sandboxDestinationKinds: Object.values(PayrollSandboxDestinationKind),
      },
    }),
)
payrollRouter.post(
  "/settings/versions",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) => {
    const parsed = validatePayrollConfiguration(request.body)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    return response
      .status(201)
      .json(
        await payrollService.createPayrollConfiguration(
          request.auth!,
          parsed.value,
        ),
      )
  },
)

payrollRouter.get(
  "/settings/preferences",
  requirePermission(Permission.PAYROLL_READ),
  async (_request, response) => {
    response.set("Cache-Control", "private, no-store")
    return response.json(await readPayrollPreferences())
  },
)
payrollRouter.put(
  "/settings/preferences",
  requirePermission(Permission.PAYROLL_MANAGE),
  async (request, response) =>
    response.json(await updatePayrollPreferences(request.auth!, request.body)),
)

payrollRouter.use(
  mapPrismaErrors({
    P2034: {
      status: 409,
      message: "The effective date conflicts with another payroll version",
    },
  }),
)
