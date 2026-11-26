"use client"

import { Alert } from "@/components/ui/alert"
import { Pill } from "@/components/ui/pill"
import {
  DetailItem,
  DetailList,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { formatPayrollDate } from "../../model/period-format"
import type { PayrollRunItem } from "../../api/payroll-runs-api"
import {
  itemStatusTone,
  itemStatusLabel,
  formatMoney,
} from "../../model/payroll-run-view"

export function PayrollItemBreakdown({ item }: { item: PayrollRunItem }) {
  const expectedCount = item.attendanceSnapshot.expectedWorkdays.length
  const recordedCount = item.attendanceSnapshot.workdays.length
  return (
    <SidePanelSection title={`${item.employeeName} · calculation breakdown`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={itemStatusTone(item.status)}>
          {itemStatusLabel(item.status)}
        </Pill>
        <span className="text-[10px] text-[#738096]">
          {item.employeeNumber} · {item.employmentType.replaceAll("_", " ")}
        </span>
      </div>
      <DetailList>
        <DetailItem label="Known gross">
          {formatMoney(item.grossAmount)}
        </DetailItem>
        <DetailItem label="Known deductions">
          {formatMoney(item.deductionsAmount)}
        </DetailItem>
        <DetailItem label="Known net">{formatMoney(item.netAmount)}</DetailItem>
        <DetailItem label="Compensation versions">
          {item.compensationSnapshot.length}
        </DetailItem>
        <DetailItem label="Scheduled workdays">{expectedCount}</DetailItem>
        <DetailItem label="Recorded workdays">{recordedCount}</DetailItem>
      </DetailList>
      {item.blocks.length > 0 && (
        <div className="grid gap-2">
          <h4 className="m-0 text-xs font-semibold text-[#a02d42]">
            Calculation blocked
          </h4>
          {item.blocks.map((block, index) => (
            <Alert key={`${block.code}-${block.reference ?? index}`}>
              {block.message}
            </Alert>
          ))}
        </div>
      )}
      {item.warnings.length > 0 && (
        <div className="grid gap-2">
          <h4 className="m-0 text-xs font-semibold">Review warnings</h4>
          {item.warnings.map((warning, index) => (
            <Alert
              key={`${warning.code}-${warning.reference ?? index}`}
              className="border-[#e3e8ef] bg-[#f8fafc] text-[#52627a]"
            >
              {warning.message}
            </Alert>
          ))}
        </div>
      )}
      <div className="grid gap-3">
        <div>
          <h4 className="mb-2 mt-0 text-xs font-semibold">
            Compensation snapshots
          </h4>
          {item.compensationSnapshot.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {item.compensationSnapshot.map((version) => (
                <li
                  key={version.id}
                  className="rounded-lg border border-[#e8ebef] p-3 text-[11px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {version.payType.replaceAll("_", " ")} ·{" "}
                      {formatMoney(version.baseRate)}
                    </span>
                    <Pill tone="neutral">{version.id}</Pill>
                  </div>
                  <p className="mb-0 mt-1 text-[10px] text-[#738096]">
                    {formatPayrollDate(version.effectiveFrom)} –{" "}
                    {version.effectiveTo
                      ? formatPayrollDate(version.effectiveTo)
                      : "No end date"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-[#738096]">
              No compensation version was recorded.
            </p>
          )}
        </div>
        <div>
          <h4 className="mb-2 mt-0 text-xs font-semibold">Calculation lines</h4>
          {item.components.length ? (
            <ul className="m-0 grid list-none divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3 p-0">
              {item.components.map((component) => (
                <li
                  key={component.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11px]"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{component.name}</span>
                    <span className="text-[10px] text-[#738096]">
                      {component.componentType.replaceAll("_", " ")}
                      {component.sourceId
                        ? ` · source ${component.sourceId}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex-none font-semibold tabular-nums">
                    {component.amount === null
                      ? "Unresolved"
                      : formatMoney(component.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-[#738096]">
              No calculation lines were produced.
            </p>
          )}
        </div>
        <div>
          <h4 className="mb-2 mt-0 text-xs font-semibold">Attendance inputs</h4>
          {item.attendanceSnapshot.workdays.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {item.attendanceSnapshot.workdays.map((day) => (
                <li
                  key={day.id}
                  className="rounded-lg border border-[#e8ebef] p-3 text-[11px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {formatPayrollDate(day.workDate)}
                    </span>
                    <span className="text-[10px] text-[#738096]">
                      {day.sessions.length} session
                      {day.sessions.length === 1 ? "" : "s"} ·{" "}
                      {day.requiredMinutes} scheduled minutes
                    </span>
                  </div>
                  {day.sessions.map((session) => (
                    <p
                      key={session.id}
                      className="m-0 mt-1 break-all text-[10px] text-[#738096]"
                    >
                      {session.startedAt} – {session.endedAt ?? "Still open"}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-[#738096]">
              No attendance workdays were recorded.
            </p>
          )}
          {item.attendanceSnapshot.overtimeAdjustments.length > 0 && (
            <p className="mb-0 mt-2 text-[10px] text-[#738096]">
              {item.attendanceSnapshot.overtimeAdjustments.length} overtime
              adjustment
              {item.attendanceSnapshot.overtimeAdjustments.length === 1
                ? ""
                : "s"}{" "}
              recorded. Overtime has no configured multiplier and is not
              included in amounts.
            </p>
          )}
        </div>
      </div>
    </SidePanelSection>
  )
}
