"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { apiRequest } from "@/features/auth/api/auth-api"
import { FilterSelect } from "@/components/ui/filter-select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { CalendarRange, Eye, Plus } from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DateInput } from "@/components/ui/date-input"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
import {
  SettingsSection,
  SettingsSwitchRow,
} from "@/components/ui/settings-section"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
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
  useSidePanel,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  pageRange,
  TablePaginationFooter,
} from "@/components/ui/table-pagination-footer"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import {
  createPayrollConfigurationVersion,
  getPayrollSettings,
  getPayrollSettingsHistory,
  getPayrollPreferences,
  savePayrollPreferences,
  type PayrollPreferences,
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
  "grid grid-cols-[minmax(0,.9fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,.7fr)_56px] items-center gap-3"

const settingsTabs = [
  "Schedule",
  "Payslips",
  "Disbursements",
  "Readiness",
  "Audit History",
] as const
const schedulePageSize = 10

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
  const [tab, setTab] = useState<string>("Schedule")
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedSchedule, setSelectedSchedule] =
    useState<PayrollConfiguration | null>(null)
  const history = settings.data?.history ?? []
  const totalPages = Math.max(1, Math.ceil(history.length / schedulePageSize))
  const page = Math.min(historyPage, totalPages)

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Payroll Settings"
    >
      <PageHeader
        title="Payroll Settings"
        description="Manage payroll schedules, preferences, operational readiness, and audit history."
        actions={
          canManage && tab === "Schedule" ? (
            <PageHeaderButton
              type="button"
              disabled={
                settings.loading || Boolean(settings.error) || !settings.data
              }
              onClick={() => setEditorOpen(true)}
            >
              <Plus size={15} aria-hidden="true" /> Add schedule
            </PageHeaderButton>
          ) : !canManage ? (
            <Pill tone="neutral">Read only</Pill>
          ) : undefined
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="mt-4 min-w-0">
        <TabsList
          aria-label="Payroll settings sections"
          variant="underline"
          className="flex-wrap gap-x-5 gap-y-0 px-0 max-[560px]:px-0"
        >
          {settingsTabs.map((name) => (
            <TabsTrigger
              key={name}
              value={name}
              variant="underline"
              className="data-[state=active]:border-b-[#203f8c] data-[state=active]:text-[#203f8c]"
            >
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="Schedule" className="mt-0 min-w-0">
          {settings.error ? (
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
              {!settings.loading && (
                <div className="grid gap-4">
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
              )}
              <SettingsSection
                title="Configuration history"
                description="A mid-period change limits each generated period to its schedule’s effective dates."
              >
                {settings.loading || settings.data?.history.length ? (
                  <ResponsiveDataTable
                    label="Payroll configuration history"
                    aria-busy={settings.loading}
                  >
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
                        "Details",
                      ].map((label) => (
                        <ResponsiveDataTableColumnHeader key={label}>
                          {label}
                        </ResponsiveDataTableColumnHeader>
                      ))}
                    </ResponsiveDataTableHeader>
                    <ResponsiveDataTableBody>
                      {settings.loading ? (
                        <DataTableSkeletonRows
                          label="payroll configuration history"
                          rows={3}
                          rowClassName={`${configurationGrid} min-h-[48px] px-4 py-3 @max-[820px]:grid-cols-2`}
                          cellClassNames={["", "", "", "", "", ""]}
                        />
                      ) : (
                        history
                          .slice(
                            (page - 1) * schedulePageSize,
                            page * schedulePageSize,
                          )
                          .map((configuration) => {
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
                                  {configuration.effectiveTo
                                    ? formatDate(configuration.effectiveTo)
                                    : "Present"}
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
                                <ResponsiveDataTableCell className="flex justify-center @max-[820px]:col-start-2 @max-[820px]:justify-end">
                                  <Button
                                    variant="rowAction"
                                    size={null}
                                    aria-label={`View schedule effective ${formatDate(configuration.effectiveFrom)}`}
                                    onClick={() =>
                                      setSelectedSchedule(configuration)
                                    }
                                  >
                                    <Eye size={14} aria-hidden="true" />
                                    <HoverTooltip side="top-end">
                                      View schedule details
                                    </HoverTooltip>
                                  </Button>
                                </ResponsiveDataTableCell>
                              </ResponsiveDataTableRow>
                            )
                          })
                      )}
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
                {!settings.loading && history.length > 0 && (
                  <TablePaginationFooter
                    {...pageRange(page, schedulePageSize, history.length)}
                    page={page}
                    total={history.length}
                    totalPages={totalPages}
                    label="Payroll schedule history pages"
                    onPageChange={setHistoryPage}
                    hidePaginationWhenSinglePage
                  />
                )}
              </SettingsSection>
            </div>
          )}
        </TabsContent>
        <PayrollPreferenceTabs canManage={canManage} />
        <TabsContent value="Readiness">
          <PayrollReadiness onOpenSchedule={() => setTab("Schedule")} />
        </TabsContent>
        <TabsContent value="Audit History">
          <PayrollAudit />
        </TabsContent>
      </Tabs>
      {selectedSchedule && (
        <ScheduleDetails
          configuration={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
      {editorOpen && canManage && (
        <ScheduleEditor
          history={settings.data?.history ?? []}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false)
            setHistoryPage(1)
            settings.retry()
          }}
        />
      )}
    </main>
  )
}

function ScheduleDetails({
  configuration,
  onClose,
}: {
  configuration: PayrollConfiguration
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const status = statusFor(configuration)
  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Schedule details"
        description={frequencyLabel(configuration.frequency)}
        meta={<Pill tone={status.tone}>{status.label}</Pill>}
      />
      <SidePanelBody>
        <DetailList>
          <DetailItem label="Cutoff schedule">
            {cutoffLabel(configuration)}
          </DetailItem>
          <DetailItem label="Effective from">
            {formatDate(configuration.effectiveFrom)}
          </DetailItem>
          <DetailItem label="Effective through">
            {configuration.effectiveTo
              ? formatDate(configuration.effectiveTo)
              : "Present"}
          </DetailItem>
          <DetailItem label="Change reason">
            {configuration.changeReason}
          </DetailItem>
        </DetailList>
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton variant="secondary" onClick={() => panel.close()}>
          Close
        </SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}

function PayrollPreferenceTabs({ canManage }: { canManage: boolean }) {
  const preferences = useAsyncResource(getPayrollPreferences, [], {
    fallbackError: "Couldn't load payroll preferences.",
  })

  return (
    <>
      {(["Payslips", "Disbursements"] as const).map((section) => (
        <TabsContent
          key={section}
          value={section}
          forceMount
          className="mt-5 min-w-0 data-[state=inactive]:hidden"
        >
          {preferences.error ? (
            <Alert role="alert">
              {preferences.error}{" "}
              <Button variant="outline" size="sm" onClick={preferences.retry}>
                Retry
              </Button>
            </Alert>
          ) : preferences.loading || !preferences.data ? (
            <p role="status" className="text-sm">
              Loading payroll preferences…
            </p>
          ) : (
            <PayrollPreferenceForm
              section={section}
              canManage={canManage}
              saved={preferences.data}
              onSaved={preferences.setData}
              onReload={preferences.retry}
            />
          )}
        </TabsContent>
      ))}
    </>
  )
}

function PayrollPreferenceForm({
  section,
  canManage,
  saved,
  onSaved,
  onReload,
}: {
  section: "Payslips" | "Disbursements"
  canManage: boolean
  saved: PayrollPreferences
  onSaved: (value: PayrollPreferences) => void
  onReload: () => void
}) {
  const [draft, setDraft] = useState<PayrollPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const value = draft ?? saved
  const fields =
    section === "Payslips"
      ? ([
          [
            "showCompanyLogo",
            "Show company logo",
            "Include the EXP Digital Solutions logo on generated PDFs.",
          ],
          [
            "showEmployeeId",
            "Show employee ID",
            "Include the employee ID when generating a payslip PDF.",
          ],
          [
            "requirePublicationConfirmation",
            "Confirm payslip publication",
            "Prompt Admins before publishing approved payslips.",
          ],
        ] as const)
      : ([
          [
            "requireSimulationConfirmation",
            "Confirm payout simulation",
            "Prompt Admins before recording a local sandbox outcome.",
          ],
        ] as const)
  const dirty = fields.some(([key]) => value[key] !== saved[key])
  const stale = Boolean(draft && draft.revision !== saved.revision)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canManage || !draft || !dirty || stale || saving) return
    setSaving(true)
    setError("")
    try {
      const updated = await savePayrollPreferences(draft)
      onSaved(updated)
      setDraft(null)
      sileo.success({ title: "Payroll preferences saved" })
    } catch (cause) {
      const message = errorMessage(cause, "Couldn't save payroll preferences.")
      setError(message)
      sileo.error({ title: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      tone="tinted"
      title={`${section === "Payslips" ? "Payslip" : "Disbursement"} preferences`}
    >
      <Form onSubmit={save} className="grid gap-4">
        {!canManage && <Pill tone="neutral">Read only</Pill>}
        {fields.map(([key, label, description]) => (
          <SettingsSwitchRow
            key={key}
            label={label}
            description={description}
            checked={value[key]}
            disabled={!canManage || saving}
            onChange={(event) => {
              const checked = event.target.checked
              setDraft({ ...value, [key]: checked })
            }}
          />
        ))}
        {(error || stale) && (
          <Alert role="alert">
            {stale
              ? "Preferences changed. Discard this draft before editing again."
              : error}
          </Alert>
        )}
        {canManage && (
          <div className="flex flex-wrap justify-end gap-2">
            {error && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setDraft(null)
                  setError("")
                  onReload()
                }}
              >
                Discard and reload
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={saving || !draft}
              onClick={() => {
                setDraft(null)
                setError("")
              }}
            >
              Discard changes
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={!dirty || saving || stale}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </Form>
    </SettingsSection>
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
    <SettingsSection title={title}>
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
    </SettingsSection>
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
  const [expectedLatestId] = useState(history[0]?.id ?? null)
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
        expectedLatestId,
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

type Readiness = {
  capabilities: {
    id: string
    label: string
    state: "READY" | "ATTENTION_REQUIRED" | "NOT_CONFIGURED" | "UNAVAILABLE"
    reason: string
    description: string
    target?: string
  }[]
  permissions: { role: string; read: boolean; manage: boolean }[]
}

const readinessLabels = {
  READY: "Ready",
  ATTENTION_REQUIRED: "Attention required",
  NOT_CONFIGURED: "Not configured",
  UNAVAILABLE: "Unavailable",
} as const

function PayrollReadiness({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const result = useAsyncResource(
    (signal) =>
      apiRequest<Readiness>("/api/payroll/settings/readiness", { signal }),
    [],
  )
  return (
    <div className="grid min-w-0 gap-4">
      <SettingsSection title="Payroll Operational Readiness">
        <p className="m-0 text-xs text-muted-foreground">
          These checks describe capability availability. Each payroll run still
          has its own prerequisites.
        </p>
        {result.error ? (
          <Alert>
            {result.error}{" "}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={result.retry}
            >
              Retry
            </Button>
          </Alert>
        ) : result.loading ? (
          <Skeleton className="h-36 w-full" />
        ) : (
          <ul className="m-0 grid list-none divide-y divide-border p-0">
            {result.data?.capabilities.map((capability) => (
              <li
                key={capability.id}
                className="flex flex-wrap items-start justify-between gap-2 py-3"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {capability.label}
                    </span>
                    <Pill
                      tone={
                        capability.state === "READY"
                          ? "success"
                          : capability.state === "ATTENTION_REQUIRED"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {readinessLabels[capability.state]}
                    </Pill>
                  </div>
                  <p className="m-0 text-xs text-muted-foreground">
                    {capability.description}
                  </p>
                </div>
                {[
                  "NO_EFFECTIVE_SCHEDULE",
                  "INVALID_EFFECTIVE_SCHEDULE",
                ].includes(capability.reason) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenSchedule}
                  >
                    Open Schedule
                  </Button>
                ) : (
                  capability.target && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={capability.target}
                        aria-label={"Open " + capability.label + " workflow"}
                      >
                        Open workflow
                      </Link>
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
      {result.data && (
        <SettingsSection title="Payroll Access">
          <DetailList>
            {result.data.permissions.map(({ role, read, manage }) => (
              <DetailItem
                key={role}
                label={role === "USER" ? "Client" : humanizeEnum(role)}
              >
                {manage
                  ? "Configure payroll, prepare disbursements, and export reports. Approval and final exception decisions require independent review where applicable."
                  : read
                    ? "View payroll records and reports."
                    : role === "STAFF"
                      ? "Own published payslips and payroll requests through My Payroll."
                      : "No Payroll access."}
              </DetailItem>
            ))}
          </DetailList>
        </SettingsSection>
      )}
    </div>
  )
}

type AuditPage = {
  page: number
  pageSize: number
  total: number
  rows: {
    id: string
    actorName: string
    actorRoleAtTime: string
    subjectType: string
    subjectId: string
    action: string
    activity: string | null
    createdAt: string
  }[]
}
const auditGrid =
  "grid min-w-[660px] grid-cols-[1.15fr_1.1fr_1.1fr_1fr] items-center gap-3 px-4"

function PayrollAudit() {
  const [page, setPage] = useState(1)
  const [subject, setSubject] = useState("")
  const result = useAsyncResource(
    (signal) =>
      apiRequest<AuditPage>(
        "/api/payroll/settings/audit?" +
          new URLSearchParams({
            page: String(page),
            ...(subject ? { subject } : {}),
          }),
        { signal },
      ),
    [page, subject],
  )
  const data = result.loading || result.error ? undefined : result.data
  return (
    <SettingsSection title="Payroll Audit History">
      <FilterSelect
        fitOptions
        label="Audit category"
        value={subject}
        options={[
          { value: "", label: "All Payroll events" },
          { value: "PAYROLL_CONFIGURATION", label: "Configuration" },
          { value: "COMPENSATION", label: "Compensation" },
          { value: "PAYROLL_PERIOD", label: "Payroll periods" },
          { value: "PAYROLL_RUN", label: "Runs and operational actions" },
        ]}
        onChange={(value) => {
          setSubject(value)
          setPage(1)
        }}
      />
      {result.error ? (
        <Alert>
          {result.error}{" "}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={result.retry}
          >
            Retry
          </Button>
        </Alert>
      ) : (
        <ResponsiveDataTable
          label="Payroll audit history"
          className="overflow-x-auto"
          aria-busy={result.loading}
        >
          <ResponsiveDataTableHeader rowClassName={auditGrid}>
            {["Event", "Actor", "Record", "Recorded at"].map((label) => (
              <ResponsiveDataTableColumnHeader key={label}>
                {label}
              </ResponsiveDataTableColumnHeader>
            ))}
          </ResponsiveDataTableHeader>
          <ResponsiveDataTableBody>
            {result.loading ? (
              <DataTableSkeletonRows
                label="Payroll audit history"
                rows={3}
                rowClassName={auditGrid + " min-h-12"}
                cellClassNames={["", "", "", ""]}
              />
            ) : (
              data?.rows.map((event) => (
                <ResponsiveDataTableRow
                  key={event.id}
                  variant="directory"
                  className={auditGrid + " min-h-12 text-xs"}
                >
                  <ResponsiveDataTableCell>
                    {humanizeEnum(event.activity ?? event.action)}
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="break-words">
                    {event.actorName}
                    <div className="text-muted-foreground">
                      {humanizeEnum(event.actorRoleAtTime)}
                    </div>
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell className="break-all">
                    {humanizeEnum(event.subjectType)}
                    <div className="text-muted-foreground">
                      {event.subjectId}
                    </div>
                  </ResponsiveDataTableCell>
                  <ResponsiveDataTableCell>
                    {formatDateTime(event.createdAt, "Asia/Manila")}
                  </ResponsiveDataTableCell>
                </ResponsiveDataTableRow>
              ))
            )}
          </ResponsiveDataTableBody>
        </ResponsiveDataTable>
      )}
      {data?.total === 0 && (
        <EmptyState
          title="No Payroll audit events in this category"
          size="sm"
        />
      )}
      {data && data.total > data.pageSize && (
        <TablePaginationFooter
          {...pageRange(data.page, data.pageSize, data.total)}
          page={data.page}
          total={data.total}
          totalPages={Math.ceil(data.total / data.pageSize)}
          label="Payroll audit pages"
          onPageChange={setPage}
        />
      )}
    </SettingsSection>
  )
}
