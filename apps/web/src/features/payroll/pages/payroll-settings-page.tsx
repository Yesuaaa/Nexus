"use client"

import { useState, type FormEvent } from "react"
import { CalendarRange, Plus } from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DateInput } from "@/components/ui/date-input"
import { EmptyState } from "@/components/ui/empty-state"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
import { Pill } from "@/components/ui/pill"
import {
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
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import {
  createPayrollConfigurationVersion,
  getPayrollSettings,
  getPayrollSettingsHistory,
  type PayrollConfiguration,
  type PayrollFrequency,
} from "../api/payroll-api"

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

const configurationGrid =
  "grid grid-cols-[minmax(110px,.8fr)_minmax(180px,1.3fr)_minmax(175px,1fr)_minmax(200px,1.5fr)_minmax(100px,.7fr)] items-center gap-3"

function dayAfter(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const [year, month, day] = value.slice(0, 10).split("-").map(Number)
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function frequencyLabel(value: PayrollFrequency) {
  return value === "MONTHLY" ? "Monthly" : "Semi-monthly"
}

function ordinal(value: number) {
  const lastTwo = value % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function cutoffLabel(configuration: PayrollConfiguration) {
  if (configuration.frequency === "MONTHLY") return "1st–last day of each month"
  const cutoff = configuration.firstCutoffDay ?? 0
  return `1st–${ordinal(cutoff)} and ${ordinal(cutoff + 1)}–last day of each month`
}

function statusFor(configuration: PayrollConfiguration) {
  const today = todayInManila()
  if (configuration.effectiveFrom > today)
    return { label: "Scheduled", tone: "warning" as const }
  if (!configuration.effectiveTo || configuration.effectiveTo >= today)
    return { label: "Current", tone: "success" as const }
  return { label: "Past", tone: "neutral" as const }
}

export function PayrollSettingsPage() {
  const account = usePortalAccount()
  const canManage = canManagePayroll(account)
  const settings = useAsyncResource(
    async (signal) => {
      const [current, history] = await Promise.all([
        getPayrollSettings(signal),
        getPayrollSettingsHistory(signal),
      ])
      return { settings: current, history: history.rows }
    },
    [],
    { fallbackError: "Couldn't load Payroll settings." },
  )
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Payroll Settings"
    >
      <PageHeader
        title="Payroll Settings"
        description="Configure payroll schedules and effective-dated settings."
        actions={
          canManage ? (
            <PageHeaderButton type="button" onClick={() => setEditorOpen(true)}>
              <Plus size={15} aria-hidden="true" /> Add schedule
            </PageHeaderButton>
          ) : (
            <Pill tone="neutral">Read only</Pill>
          )
        }
      />
      {settings.loading ? (
        <p className="py-12 text-center text-sm text-[#65718a]" role="status">
          Loading Payroll settings…
        </p>
      ) : settings.error ? (
        <EmptyState
          icon={CalendarRange}
          title="Payroll settings couldn't be loaded"
          description={settings.error}
          role="alert"
          action={
            <Button variant="outline" onClick={settings.retry}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="mt-5 grid min-w-0 gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <ScheduleCard
              title="Current schedule"
              configuration={settings.data?.settings.current ?? null}
            />
            <ScheduleCard
              title="Next scheduled change"
              configuration={settings.data?.settings.future ?? null}
              scheduled
            />
          </div>
          <section aria-labelledby="payroll-settings-history-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2
                  id="payroll-settings-history-heading"
                  className="m-0 text-sm font-semibold"
                >
                  Configuration history
                </h2>
                <p className="mt-1 mb-0 text-xs text-[#738096]">
                  Each schedule keeps its own effective dates and change reason.
                </p>
              </div>
            </div>
            {settings.data?.history.length ? (
              <ResponsiveDataTable label="Payroll configuration history">
                <ResponsiveDataTableHeader
                  className="@max-[820px]:sr-only"
                  rowClassName={configurationGrid}
                >
                  {[
                    "Frequency",
                    "Cutoff schedule",
                    "Effective dates",
                    "Reason",
                    "Status",
                  ].map((label) => (
                    <ResponsiveDataTableColumnHeader key={label}>
                      {label}
                    </ResponsiveDataTableColumnHeader>
                  ))}
                </ResponsiveDataTableHeader>
                <ResponsiveDataTableBody>
                  {settings.data.history.map((configuration) => {
                    const badge = statusFor(configuration)
                    return (
                      <ResponsiveDataTableRow
                        key={configuration.id}
                        className={`${configurationGrid} border-b border-[#edf0f3] px-4 py-3 last:border-b-0 @max-[820px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @max-[820px]:gap-x-3 @max-[820px]:gap-y-2`}
                      >
                        <ResponsiveDataTableCell className="text-xs font-semibold @max-[820px]:col-start-1 @max-[820px]:row-start-1">
                          {frequencyLabel(configuration.frequency)}
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell className="min-w-0 break-words text-xs @max-[820px]:col-start-1 @max-[820px]:row-start-2">
                          <span className="mr-1.5 hidden text-[#65718a] @max-[820px]:inline">
                            Cutoffs
                          </span>
                          {cutoffLabel(configuration)}
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell className="text-xs @max-[820px]:col-start-2 @max-[820px]:row-start-1 @max-[820px]:text-right">
                          <span className="mr-1.5 hidden text-[#65718a] @max-[820px]:inline">
                            Effective
                          </span>
                          {formatDate(configuration.effectiveFrom)} –{" "}
                          {formatDate(configuration.effectiveTo)}
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell className="min-w-0 text-xs @max-[820px]:col-span-2 @max-[820px]:col-start-1 @max-[820px]:row-start-3">
                          <span className="line-clamp-2">
                            <span className="mr-1.5 hidden text-[#65718a] @max-[820px]:inline">
                              Reason
                            </span>
                            {configuration.changeReason}
                          </span>
                        </ResponsiveDataTableCell>
                        <ResponsiveDataTableCell className="@max-[820px]:col-start-2 @max-[820px]:row-start-2 @max-[820px]:justify-self-end">
                          <span className="mr-1.5 hidden text-xs text-[#65718a] @max-[820px]:inline">
                            Status
                          </span>
                          <Pill tone={badge.tone}>{badge.label}</Pill>
                        </ResponsiveDataTableCell>
                      </ResponsiveDataTableRow>
                    )
                  })}
                </ResponsiveDataTableBody>
              </ResponsiveDataTable>
            ) : (
              <EmptyState
                icon={CalendarRange}
                title="No payroll schedule configured"
                description="Add an effective-dated schedule when payroll frequency and cutoff dates are ready."
                size="md"
              />
            )}
          </section>
        </div>
      )}
      {editorOpen && canManage && (
        <ScheduleEditor
          history={settings.data?.history ?? []}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false)
            settings.retry()
          }}
        />
      )}
    </main>
  )
}

function ScheduleCard({
  title,
  configuration,
  scheduled = false,
}: {
  title: string
  configuration: PayrollConfiguration | null
  scheduled?: boolean
}) {
  return (
    <SidePanelSection
      title={title}
      className="rounded-xl border border-[#e8ebef] bg-white p-4"
    >
      {configuration ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold">
              {frequencyLabel(configuration.frequency)}
            </span>
            {scheduled && <Pill tone="warning">Scheduled</Pill>}
          </div>
          <DetailList>
            <DetailItem label="Cutoff dates">
              {cutoffLabel(configuration)}
            </DetailItem>
            <DetailItem label="Effective from">
              {formatDate(configuration.effectiveFrom)}
            </DetailItem>
            <DetailItem label="Reason">{configuration.changeReason}</DetailItem>
          </DetailList>
        </>
      ) : (
        <p className="m-0 text-xs text-[#738096]">
          {scheduled
            ? "No future schedule is queued."
            : "A schedule has not been configured."}
        </p>
      )}
    </SidePanelSection>
  )
}

function ScheduleEditor({
  history,
  onClose,
  onSaved,
}: {
  history: PayrollConfiguration[]
  onClose: () => void
  onSaved: () => void
}) {
  const latestStart = history[0]?.effectiveFrom
  const nextAllowed = latestStart ? dayAfter(latestStart) : todayInManila()
  const minimumDate =
    nextAllowed > todayInManila() ? nextAllowed : todayInManila()
  const [frequency, setFrequency] = useState<PayrollFrequency | "">("")
  const [firstCutoffDay, setFirstCutoffDay] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState(minimumDate)
  const [changeReason, setChangeReason] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (!frequency) {
      setError("Choose a payroll frequency before continuing.")
      return
    }
    if (frequency === "SEMI_MONTHLY" && !firstCutoffDay) {
      setError("Choose the first semi-monthly cutoff day.")
      return
    }
    setConfirmOpen(true)
  }

  async function save() {
    if (!frequency) return
    setPending(true)
    setError("")
    try {
      await createPayrollConfigurationVersion({
        frequency,
        firstCutoffDay:
          frequency === "SEMI_MONTHLY" && firstCutoffDay
            ? Number(firstCutoffDay)
            : null,
        currency: "PHP",
        effectiveFrom,
        changeReason: changeReason.trim(),
      })
      sileo.success({ title: "Payroll schedule created" })
      setConfirmOpen(false)
      onSaved()
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't create the Payroll schedule."))
      setConfirmOpen(false)
    } finally {
      setPending(false)
    }
  }

  const cutoffOptions = Array.from({ length: 27 }, (_, index) => index + 1)

  return (
    <>
      <SidePanel
        open
        onOpenChange={(open) => !open && !pending && onClose()}
        dismissible={false}
        busy={pending}
        className="w-full sm:max-w-[560px]"
      >
        <SidePanelHeader
          title="Add payroll schedule"
          description="Create a new effective-dated schedule version."
          closeDisabled={pending}
        />
        <Form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <SidePanelBody>
            <p className="m-0 text-xs leading-5 text-[#65718a]">
              The current schedule remains in history and ends the day before
              this version takes effect.
            </p>
            <SidePanelFieldset title="Payroll schedule">
              <label
                className="grid gap-1.5 text-xs font-medium"
                htmlFor="payroll-frequency"
              >
                Frequency
                <Select
                  value={frequency}
                  onValueChange={(value) => {
                    setFrequency(value as PayrollFrequency)
                    if (value !== "SEMI_MONTHLY") setFirstCutoffDay("")
                  }}
                >
                  <SelectTrigger
                    id="payroll-frequency"
                    aria-label="Payroll frequency"
                    className="h-10"
                  >
                    <SelectValue placeholder="Choose a frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="SEMI_MONTHLY">Semi-monthly</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {frequency === "SEMI_MONTHLY" && (
                <label
                  className="grid gap-1.5 text-xs font-medium"
                  htmlFor="payroll-cutoff"
                >
                  First cutoff day
                  <Select
                    value={firstCutoffDay}
                    onValueChange={setFirstCutoffDay}
                  >
                    <SelectTrigger
                      id="payroll-cutoff"
                      aria-label="First cutoff day"
                      className="h-10"
                    >
                      <SelectValue placeholder="Choose a day" />
                    </SelectTrigger>
                    <SelectContent>
                      {cutoffOptions.map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}
              <label
                className="grid gap-1.5 text-xs font-medium"
                htmlFor="payroll-settings-effective-from"
              >
                Schedule effective from
                <DateInput
                  id="payroll-settings-effective-from"
                  min={minimumDate}
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  required
                />
              </label>
              <label
                className="grid gap-1.5 text-xs font-medium sm:col-span-2"
                htmlFor="payroll-settings-reason"
              >
                Reason for change
                <FormTextarea
                  id="payroll-settings-reason"
                  value={changeReason}
                  onChange={(event) => setChangeReason(event.target.value)}
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                />
              </label>
            </SidePanelFieldset>
            {error && (
              <Alert variant="text" role="alert">
                {error}
              </Alert>
            )}
          </SidePanelBody>
          <SidePanelFooter>
            <SidePanelButton
              variant="secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </SidePanelButton>
            <SidePanelButton
              type="submit"
              disabled={
                pending || (frequency === "SEMI_MONTHLY" && !firstCutoffDay)
              }
            >
              {pending ? "Saving…" : "Review schedule"}
            </SidePanelButton>
          </SidePanelFooter>
        </Form>
      </SidePanel>
      <ConfirmationDialog
        open={confirmOpen}
        title="Create this payroll schedule?"
        subject={`${frequency ? frequencyLabel(frequency) : "Payroll schedule"} · ${frequency === "SEMI_MONTHLY" ? `first cutoff day ${firstCutoffDay}` : "calendar-month periods"}`}
        description={`This schedule takes effect ${formatDate(effectiveFrom)}. The previous schedule will remain available in history.`}
        confirmLabel="Create schedule"
        pendingLabel="Creating…"
        pending={pending}
        destructive={false}
        error={error}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void save()}
      />
    </>
  )
}
