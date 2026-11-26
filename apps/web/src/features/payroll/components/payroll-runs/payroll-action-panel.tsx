"use client"

import { useMemo, useState } from "react"
import { CalendarRange } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Form } from "@/components/ui/form"
import { FormInput } from "@/components/ui/form-input"
import { Pill } from "@/components/ui/pill"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import {
  SidePanelError,
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFieldset,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import {
  createPayrollRun,
  generatePayrollPeriods,
  listAllPayrollPeriodsForYear,
  type PayrollPeriod,
  type PayrollRun,
} from "../../api/payroll-runs-api"
import {
  type PanelMode,
  frequencyLabel,
  formatPeriodRange,
} from "../../model/payroll-run-view"

export function PayrollActionPanel({
  mode,
  year,
  onYearChange,
  onClose,
  onSwitchToGenerate,
  onGenerate,
  onCreateRun,
}: {
  mode: PanelMode
  year: number
  onYearChange: (year: number) => void
  onClose: () => void
  onSwitchToGenerate: () => void
  onGenerate: (result: { createdCount: number; total: number }) => void
  onCreateRun: (run: PayrollRun) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [selectedPeriodId, setSelectedPeriodId] = useState("")
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 9999
  const periods = useAsyncResource(
    (signal) => listAllPayrollPeriodsForYear(year, signal),
    [year, mode],
    {
      enabled: mode === "create-run" && validYear,
      fallbackError: "Couldn't load payroll periods.",
    },
  )
  const periodsByDate = useMemo(
    () =>
      [...(periods.data ?? [])].sort(
        (first, second) =>
          first.startDate.localeCompare(second.startDate) ||
          first.endDate.localeCompare(second.endDate) ||
          first.id.localeCompare(second.id),
      ),
    [periods.data],
  )
  const availablePeriods = useMemo(
    () => periodsByDate.filter((period) => period.run === null),
    [periodsByDate],
  )
  const periodsReady = validYear && !periods.loading && !periods.error
  const selectedPeriod = periodsReady
    ? availablePeriods.find((period) => period.id === selectedPeriodId)
    : undefined
  const selectedPeriodAvailable = Boolean(selectedPeriod)
  const title =
    mode === "generate" ? "Generate payroll periods" : "Create a Draft Run"
  const description =
    mode === "generate"
      ? "Add calendar periods from the payroll schedule versions that cover the selected year. Existing periods are kept."
      : "Select an eligible payroll period to create a draft payroll run."

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const result = await generatePayrollPeriods(year)
      onGenerate(result)
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't generate payroll periods."))
    } finally {
      setPending(false)
    }
  }

  async function createRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPeriodAvailable) {
      setSelectedPeriodId("")
      setError(
        "That payroll period is no longer available. Choose another period.",
      )
      periods.retry()
      return
    }
    setPending(true)
    setError("")
    try {
      const run = await createPayrollRun(selectedPeriodId)
      onCreateRun(run)
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't create the draft run."))
      periods.retry()
    } finally {
      setPending(false)
    }
  }

  return (
    <SidePanel
      open={mode !== null}
      onOpenChange={(open) => !open && onClose()}
      busy={pending}
    >
      {mode && (
        <>
          <SidePanelHeader
            title={title}
            description={description}
            wrapDescription={mode === "create-run"}
          />
          <SidePanelBody>
            {mode === "generate" ? (
              <Form id="payroll-period-generation" onSubmit={generate}>
                <SidePanelFieldset
                  title="Calendar year"
                  description="Only periods inside configured schedule dates are generated."
                >
                  <label className="grid gap-1.5 text-[11px] font-medium text-[#52627a] sm:col-span-2">
                    Year
                    <FormInput
                      type="number"
                      min={1900}
                      max={9999}
                      required
                      value={year || ""}
                      disabled={pending}
                      onChange={(event) => {
                        setError("")
                        onYearChange(Number(event.target.value) || 0)
                      }}
                      step={1}
                      aria-label="Payroll calendar year"
                    />
                  </label>
                </SidePanelFieldset>
                {error && <Alert>{error}</Alert>}
                <p className="m-0 text-xs leading-5 text-[#65718a]">
                  Monthly schedules create one period per month. Semi-monthly
                  schedules use each configured cutoff. Schedule changes inside
                  a period create clipped, non-overlapping dates.
                </p>
              </Form>
            ) : (
              <Form id="payroll-create-run" onSubmit={createRun}>
                <SidePanelFieldset
                  title="Select a payroll period"
                  description="A period can have one draft run."
                >
                  <label className="grid gap-1.5 text-[11px] font-medium text-[#52627a]">
                    Year
                    <FormInput
                      type="number"
                      min={1900}
                      max={9999}
                      required
                      value={year || ""}
                      disabled={pending}
                      onChange={(event) => {
                        setError("")
                        onYearChange(Number(event.target.value) || 0)
                        setSelectedPeriodId("")
                      }}
                      step={1}
                      aria-label="Payroll period year"
                    />
                  </label>
                  {!validYear ? (
                    <div className="sm:col-span-2">
                      <Alert>
                        Enter a calendar year from 1900 through 9999.
                      </Alert>
                    </div>
                  ) : periods.loading ? (
                    <div
                      className="grid min-w-0 gap-2 sm:col-span-2"
                      aria-busy="true"
                    >
                      <span role="status" className="sr-only">
                        Loading payroll periods…
                      </span>
                      <MemberRowSkeleton className="py-3" />
                      <MemberRowSkeleton className="py-3" />
                      <MemberRowSkeleton className="py-3" />
                    </div>
                  ) : periods.error ? (
                    <div className="sm:col-span-2">
                      <SidePanelError
                        message={periods.error}
                        onRetry={periods.retry}
                      />
                    </div>
                  ) : periods.data?.length === 0 ? (
                    <div className="sm:col-span-2">
                      <EmptyState
                        icon={CalendarRange}
                        size="sm"
                        title="No payroll periods generated"
                        description="Generate payroll periods for the selected year before creating a draft run."
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onSwitchToGenerate}
                          >
                            Generate periods for {year}
                          </Button>
                        }
                      />
                    </div>
                  ) : availablePeriods.length === 0 ? (
                    <div className="sm:col-span-2">
                      <EmptyState
                        icon={CalendarRange}
                        size="sm"
                        title="No available periods"
                        description="All generated payroll periods for this year already have associated runs."
                      />
                    </div>
                  ) : (
                    <label className="grid min-w-0 gap-1.5 text-[11px] font-medium text-[#52627a]">
                      Period
                      <Select
                        value={selectedPeriodAvailable ? selectedPeriodId : ""}
                        onValueChange={setSelectedPeriodId}
                        disabled={pending || periods.loading}
                      >
                        <SelectTrigger aria-label="Choose payroll period">
                          <SelectValue placeholder="Choose a period" />
                        </SelectTrigger>
                        <SelectContent maxHeight="roomy">
                          {periodsByDate.map((period) => (
                            <SelectItem
                              key={period.id}
                              value={period.id}
                              disabled={period.run !== null}
                            >
                              {periodOptionLabel(period)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  )}
                  {selectedPeriod && (
                    <SidePanelSection
                      title="Selected period"
                      className="sm:col-span-2"
                    >
                      <DetailList>
                        <DetailItem label="Period">
                          <span className="font-semibold">
                            {periodOptionLabel(selectedPeriod)}
                          </span>
                          <Pill tone="success" className="ml-2">
                            Available
                          </Pill>
                        </DetailItem>
                        <DetailItem label="Frequency">
                          {frequencyLabel(selectedPeriod.frequency)}
                        </DetailItem>
                        <DetailItem label="Period dates">
                          {formatPeriodRange(
                            selectedPeriod.startDate,
                            selectedPeriod.endDate,
                          )}
                        </DetailItem>
                      </DetailList>
                    </SidePanelSection>
                  )}
                </SidePanelFieldset>
                {error && <Alert>{error}</Alert>}
                <p className="m-0 text-xs leading-5 text-[#65718a]">
                  Creating a run only saves a draft. Employee amounts are
                  calculated separately from current compensation and attendance
                  records.
                </p>
              </Form>
            )}
          </SidePanelBody>
          <SidePanelFooter>
            <SidePanelButton
              variant="secondary"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </SidePanelButton>
            {mode === "generate" ? (
              <SidePanelButton
                type="submit"
                form="payroll-period-generation"
                disabled={pending}
              >
                {pending ? "Generating…" : "Generate periods"}
              </SidePanelButton>
            ) : (
              <SidePanelButton
                type="submit"
                form="payroll-create-run"
                disabled={
                  pending ||
                  periods.loading ||
                  !selectedPeriodAvailable ||
                  availablePeriods.length === 0
                }
              >
                {pending ? "Creating…" : "Create draft"}
              </SidePanelButton>
            )}
          </SidePanelFooter>
        </>
      )}
    </SidePanel>
  )
}

export function periodOptionLabel(period: PayrollPeriod) {
  const [startYear, startMonth, startDay] = period.startDate
    .slice(0, 10)
    .split("-")
    .map(Number)
  const [endYear, endMonth, endDay] = period.endDate
    .slice(0, 10)
    .split("-")
    .map(Number)
  const lastDayOfMonth = new Date(
    Date.UTC(startYear, startMonth, 0),
  ).getUTCDate()

  if (
    period.frequency === "MONTHLY" &&
    startYear === endYear &&
    startMonth === endMonth &&
    startDay === 1 &&
    endDay === lastDayOfMonth
  ) {
    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(startYear, startMonth - 1, startDay)))
  }

  return formatPeriodRange(period.startDate, period.endDate, "long")
}
