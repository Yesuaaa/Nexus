import { Router } from "express"
import {
  PayrollFrequency,
  PayrollPayType,
  PayrollRunStatus,
} from "../../generated/prisma/client.js"
import { mapPrismaErrors } from "../../shared/http-error.js"
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
import {
  validatePayrollPeriodGeneration,
  validatePayrollRunCreation,
} from "./payroll-runs.schema.js"

import { payrollDocumentsRouter } from "./payroll-documents.controller.js"

export const payrollRouter = Router()
payrollRouter.use(requireAuth)
payrollRouter.use(payrollDocumentsRouter)

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
  "/settings/history",
  requirePermission(Permission.PAYROLL_READ),
  async (_request, response) =>
    response.json(await payrollService.getPayrollSettingsHistory()),
)
payrollRouter.get(
  "/settings",
  requirePermission(Permission.PAYROLL_READ),
  async (_request, response) =>
    response.json(await payrollService.getPayrollSettings()),
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

payrollRouter.use(
  mapPrismaErrors({
    P2034: {
      status: 409,
      message: "The effective date conflicts with another payroll version",
    },
  }),
)
