"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import {
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  DetailItem,
  DetailList,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { SearchField } from "@/components/ui/search-field"
import { TableCell, TableRow } from "@/components/ui/table"
import { useAsyncResource } from "@/lib/use-async-resource"
import { formatPayrollMoney } from "../../model/money"
import {
  getPayrollRun,
  listPayrollRunItems,
  type PayrollRun,
} from "../../api/payroll-runs-api"
import {
  payslipStatusTone,
  payslipStatusLabel,
  timestamp,
} from "../../model/payroll-documents"
import { PayslipReview } from "./payslip-review"
import { RecordTable, Pages } from "./record-layout"

export function ApprovedRunDetailsSidebar({
  runId,
  refreshKey,
  manage,
  busy,
  onClose,
  onAction,
  onChanged,
}: {
  runId: string
  refreshKey: number
  manage: boolean
  busy: boolean
  onClose: () => void
  onAction: (action: "generate" | "publish", run: PayrollRun) => void
  onChanged: () => void
}) {
  const panel = useSidePanel(onClose)
  const [tab, setTab] = useState("overview")
  const [employeePage, setEmployeePage] = useState(1)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const { query: settledEmployeeSearch, pending: employeeSearchPending } =
    useTableSearchQuery(employeeSearch)
  const run = useAsyncResource(
    (signal) => getPayrollRun(runId, signal),
    [runId, refreshKey],
    { fallbackError: "Couldn't load the approved payroll run." },
  )
  const calculationId = run.data?.latestCalculation?.id ?? ""
  const employees = useAsyncResource(
    (signal) =>
      listPayrollRunItems(runId, {
        page: employeePage,
        search: settledEmployeeSearch,
        calculationId,
        signal,
      }),
    [
      runId,
      refreshKey,
      calculationId,
      employeePage,
      settledEmployeeSearch,
      tab,
    ],
    {
      enabled: Boolean(
        calculationId && tab === "employees" && !employeeSearchPending,
      ),
      fallbackError: "Couldn't load approved employees.",
    },
  )
  const selectedEmployee =
    employees.data?.rows.find((item) => item.id === selectedEmployeeId) ?? null
  const calculation = run.data?.latestCalculation
  const employeeCount =
    calculation?.payslipEmployeeCount ??
    (calculation
      ? calculation.calculatedItemCount +
        calculation.reviewItemCount +
        calculation.blockedItemCount
      : 0)
  const generatedCount = calculation?.payslipGeneratedCount ?? 0
  const publishedCount = calculation?.payslipPublishedCount ?? 0
  const generationStatus = calculation?.payslipStatus ?? "NOT_GENERATED"
  const detailDescription = run.data
    ? `${run.data.period.cutoffLabel} · Revision ${calculation?.revision ?? "—"}`
    : "Approved payroll run"

  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange} busy={busy}>
      <SidePanelHeader
        title="Payslip Details"
        description={detailDescription}
        meta={<Pill tone="success">Approved</Pill>}
        closeLabel="Close payslip details"
        closeDisabled={busy}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value)
          setSelectedEmployeeId("")
        }}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="flex-none">
          <TabsList
            aria-label="Approved run detail sections"
            variant="underline"
          >
            <TabsTrigger value="overview" variant="underline">
              Overview
            </TabsTrigger>
            <TabsTrigger value="employees" variant="underline">
              Employees
            </TabsTrigger>
          </TabsList>
        </div>
        <SidePanelBody className="min-w-0 grid-cols-1">
          <TabsContent value="overview" className="mt-0 grid min-w-0 gap-5">
            {run.error ? (
              <SidePanelError message={run.error} onRetry={run.retry} />
            ) : run.loading && !run.data ? (
              <div aria-busy="true" className="grid gap-2">
                <span className="sr-only" role="status">
                  Loading approved payroll run…
                </span>
                <MemberRowSkeleton className="py-3" />
                <MemberRowSkeleton className="py-3" />
                <MemberRowSkeleton className="py-3" />
              </div>
            ) : run.data ? (
              <>
                <SidePanelSection title="Payroll summary">
                  <DetailList>
                    <DetailItem label="Employees">{employeeCount}</DetailItem>
                    <DetailItem label="Gross pay">
                      <span className="tabular-nums">
                        {formatPayrollMoney(calculation?.grossTotal)}
                      </span>
                    </DetailItem>
                    <DetailItem label="Deductions">
                      <span className="tabular-nums">
                        {formatPayrollMoney(calculation?.deductionsTotal)}
                      </span>
                    </DetailItem>
                    <DetailItem
                      label="Net pay"
                      className="font-semibold [&_dd]:text-[13px]"
                    >
                      <span className="font-semibold tabular-nums">
                        {formatPayrollMoney(calculation?.netTotal)}
                      </span>
                    </DetailItem>
                  </DetailList>
                </SidePanelSection>
                <SidePanelSection title="Payslip lifecycle">
                  <DetailList>
                    <DetailItem label="Status">
                      <Pill tone={payslipStatusTone(generationStatus)}>
                        {payslipStatusLabel(generationStatus)}
                      </Pill>
                    </DetailItem>
                    <DetailItem label="Generated">
                      {generatedCount} of {employeeCount}
                    </DetailItem>
                    <DetailItem label="Published">
                      {publishedCount} of {employeeCount}
                    </DetailItem>
                    <DetailItem label="Not generated">
                      {Math.max(employeeCount - generatedCount, 0)}
                    </DetailItem>
                    {calculation?.payslipLastGeneratedAt && (
                      <DetailItem label="Last generated">
                        {timestamp(calculation.payslipLastGeneratedAt)}
                      </DetailItem>
                    )}
                    {calculation?.payslipLastPublishedAt && (
                      <DetailItem label="Last published">
                        {timestamp(calculation.payslipLastPublishedAt)}
                      </DetailItem>
                    )}
                  </DetailList>
                </SidePanelSection>
              </>
            ) : null}
          </TabsContent>
          <TabsContent value="employees" className="mt-0 grid min-w-0 gap-5">
            {selectedEmployee ? (
              <PayslipReview
                item={selectedEmployee}
                manage={manage}
                busy={busy}
                onBack={() => setSelectedEmployeeId("")}
                onChanged={() => {
                  employees.retry()
                  run.retry()
                  onChanged()
                }}
              />
            ) : (
              <SidePanelSection title="Employees" className="min-w-0">
                <div className="grid min-w-0 gap-3">
                  <SearchField
                    label="Search approved employees"
                    value={employeeSearch}
                    onChange={(event) => {
                      setEmployeeSearch(event.target.value)
                      setEmployeePage(1)
                    }}
                    placeholder="Search employee or ID…"
                  />
                  {employees.error ? (
                    <SidePanelError
                      message={employees.error}
                      onRetry={employees.retry}
                    />
                  ) : (
                    <RecordTable
                      headings={[
                        "Employee",
                        "Net Pay",
                        "Payslip Status",
                        "Details",
                      ]}
                      alignments={{ "Net Pay": "right", Details: "center" }}
                      columnClassNames={{
                        Employee: "w-[38%]",
                        "Net Pay": "w-[25%]",
                        "Payslip Status": "w-[24%]",
                        Details: "w-[13%]",
                      }}
                      tableClassName="min-w-0 table-fixed"
                      loading={employees.loading || employeeSearchPending}
                      empty={!employees.data?.rows.length}
                    >
                      {employees.data?.rows.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="min-w-0">
                            <div className="grid min-w-0 gap-0.5">
                              <span
                                className="block min-w-0 truncate font-medium"
                                title={item.employeeName}
                              >
                                {item.employeeName}
                              </span>
                              <span
                                className="block min-w-0 truncate text-[10px] text-[#738096]"
                                title={item.employeeNumber}
                              >
                                {item.employeeNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-0 whitespace-nowrap text-right tabular-nums">
                            {formatPayrollMoney(item.netAmount)}
                          </TableCell>
                          <TableCell className="min-w-0">
                            <Pill tone={payslipStatusTone(item.payslipStatus)}>
                              {payslipStatusLabel(item.payslipStatus)}
                            </Pill>
                          </TableCell>
                          <TableCell className="min-w-0 text-center">
                            <div className="flex justify-center">
                              <Button
                                type="button"
                                variant="rowAction"
                                size={null}
                                aria-label={`Review payslip for ${item.employeeName}`}
                                onClick={() => setSelectedEmployeeId(item.id)}
                              >
                                <Eye size={14} aria-hidden="true" />
                                <HoverTooltip>Review payslip</HoverTooltip>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </RecordTable>
                  )}
                  <Pages
                    result={
                      employees.loading ||
                      employeeSearchPending ||
                      employees.error
                        ? null
                        : employees.data
                    }
                    label="Approved employee pages"
                    onPageChange={setEmployeePage}
                  />
                </div>
              </SidePanelSection>
            )}
          </TabsContent>
        </SidePanelBody>
      </Tabs>
      <SidePanelFooter className="justify-between max-[560px]:items-stretch">
        <SidePanelButton
          variant="secondary"
          disabled={busy}
          onClick={() => panel.close()}
        >
          Close
        </SidePanelButton>
        {manage && run.data && (
          <div className="flex flex-wrap justify-end gap-2">
            <SidePanelButton
              variant="secondary"
              disabled={
                busy ||
                run.loading ||
                !employeeCount ||
                generatedCount >= employeeCount
              }
              onClick={() => onAction("generate", run.data!)}
            >
              {generatedCount >= employeeCount
                ? "Payslips generated"
                : "Generate payslips"}
            </SidePanelButton>
            <SidePanelButton
              disabled={
                busy ||
                run.loading ||
                !employeeCount ||
                generatedCount < employeeCount ||
                publishedCount >= employeeCount
              }
              onClick={() => onAction("publish", run.data!)}
            >
              {publishedCount >= employeeCount
                ? "Payslips published"
                : "Publish payslips"}
            </SidePanelButton>
          </div>
        )}
      </SidePanelFooter>
    </SidePanel>
  )
}
