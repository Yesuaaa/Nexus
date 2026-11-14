"use client"
import { useState } from "react"
import { Clock3, Coffee, LogOut, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Alert } from "@/components/ui/alert"
import { OverviewPanel } from "@/components/ui/overview-panel"
import { ProgressMeter } from "@/components/ui/stat-strip"
import {
  DetailList,
  DetailItem,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { useAsyncResource } from "@/lib/use-async-resource"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { AttendanceShell } from "../components/attendance-shell"
import {
  ResourceStatus,
  AttendancePagination,
  RangeFields,
} from "../components/attendance-shared"
import { AttendanceHistoryTable } from "../components/attendance-history"
import { AdjustmentDialog } from "../components/adjustment-dialog"
import { useAttendanceClock } from "../hooks/use-attendance-clock"
import {
  attendanceHistory,
  type AttendanceMutation,
  type AttendanceSession,
} from "../api/attendance-api"
import {
  attendanceDate,
  defaultRange,
  duration,
  elapsedWork,
} from "../model/attendance"

export function MyAttendancePage() {
  const clock = useAttendanceClock()
  const [range, setRange] = useState(defaultRange)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [confirm, setConfirm] = useState<{
    input: AttendanceMutation
    label: string
    description: string
  } | null>(null)
  const [actionError, setActionError] = useState("")
  const [correction, setCorrection] = useState<{
    session: AttendanceSession | null
  } | null>(null)
  const history = useAsyncResource(
    (signal) => attendanceHistory(range.from, range.to, page, signal),
    [range.from, range.to, page, revision],
    {
      enabled: Boolean(range.from && range.to),
      fallbackError: "Couldn't load your attendance history.",
    },
  )
  const day = clock.state?.workday
  const worked = day
    ? elapsedWork(day, clock.now || Date.parse(clock.state!.asOf))
    : 0
  const target = (day?.requiredMinutes ?? 0) * 60000
  const active = day?.activeSessionId
  const paused = Boolean(day?.activeBreakId)
  const blocked =
    clock.loading ||
    clock.pending ||
    Boolean(clock.error) ||
    !day ||
    Boolean(clock.state?.needsPolicy)
  const latest = history.data?.workdays[0]
  const lastEnd = latest?.sessions.at(-1)?.endedAt
  const localNow = day?.workDate
  const continuation =
    !active &&
    latest?.id &&
    day &&
    lastEnd &&
    latest.workDate < day.workDate &&
    new Intl.DateTimeFormat("sv-SE", { timeZone: latest.timeZone }).format(
      new Date(lastEnd),
    ) === localNow
      ? latest
      : null
  function propose(
    input: AttendanceMutation,
    label: string,
    description: string,
  ) {
    setActionError("")
    setConfirm({ input, label, description })
  }
  return (
    <AttendanceShell tab="my">
      <div className="grid gap-5">
        <ResourceStatus
          loading={clock.loading}
          error={clock.error}
          retry={() => {
            void clock.refresh()
          }}
        />
        {!clock.loading && clock.state?.needsPolicy && (
          <Alert>
            Your attendance policy has not been assigned. Ask HR to configure
            your working days and required hours before clocking in.
          </Alert>
        )}
        {day && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(250px,1fr)]">
            <OverviewPanel
              title="Your working time"
              description={`Attendance workday · ${day.workDate} · ${day.timeZone}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    aria-label="Elapsed work"
                    className="block text-[clamp(36px,5vw,56px)] leading-tight font-semibold tracking-tight text-[#203f8c] tabular-nums"
                  >
                    {duration(worked)}
                  </span>
                  <p className="mt-1 text-xs text-[#738096]">
                    Worked time excludes unpaid breaks
                  </p>
                </div>
                <Pill
                  tone={
                    paused
                      ? "warning"
                      : active
                        ? "info"
                        : worked >= target
                          ? "success"
                          : "neutral"
                  }
                >
                  {paused
                    ? "On unpaid break"
                    : active
                      ? "Clocked in"
                      : day.id
                        ? "Clocked out"
                        : "Not started"}
                </Pill>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {!active ? (
                  <Button
                    variant="brand"
                    disabled={blocked}
                    onClick={() =>
                      propose(
                        { action: "clock-in" },
                        "Clock in",
                        "Start a work session using the current server time. Your assigned policy determines its attendance workday.",
                      )
                    }
                  >
                    <Play size={15} />
                    Clock in
                  </Button>
                ) : (
                  <>
                    {paused ? (
                      <Button
                        variant="brand"
                        disabled={blocked}
                        onClick={() =>
                          propose(
                            {
                              action: "break-end",
                              sessionId: active,
                              breakId: day.activeBreakId!,
                            },
                            "End break",
                            "End your unpaid break and resume counting worked time.",
                          )
                        }
                      >
                        <Play size={15} />
                        End break
                      </Button>
                    ) : (
                      <Button
                        variant="brandOutline"
                        disabled={blocked || !day.policy.unpaidBreaksEnabled}
                        onClick={() =>
                          propose(
                            { action: "break-start", sessionId: active },
                            "Start break",
                            "Worked time will pause until you end this unpaid break.",
                          )
                        }
                      >
                        <Coffee size={15} />
                        Start break
                      </Button>
                    )}
                    <Button
                      variant="brand"
                      disabled={blocked}
                      onClick={() =>
                        propose(
                          { action: "clock-out", sessionId: active },
                          "Clock out",
                          paused
                            ? `End your unpaid break and clock out together. Break time stays excluded from worked hours on ${day.workDate}.`
                            : `End this session on attendance workday ${day.workDate}. Crossing midnight does not move its hours to another day.`,
                        )
                      }
                    >
                      <LogOut size={15} />
                      Clock out
                    </Button>
                  </>
                )}
                <Button
                  variant="brandOutline"
                  disabled={clock.pending}
                  onClick={() => {
                    void clock.refresh()
                    history.retry()
                  }}
                >
                  <Clock3 size={15} />
                  Refresh
                </Button>
              </div>
              {paused && (
                <p className="mt-3 text-xs text-[#805316]">
                  Worked time is paused. End break to resume, or Clock out to
                  finish your session and end the break together.
                </p>
              )}
              {active && (
                <p className="mt-3 text-xs leading-5 text-[#738096]">
                  This session stays on {day.workDate}, including work after
                  midnight. It will remain open until you clock out.
                </p>
              )}
              {continuation && (
                <div className="mt-4 rounded-lg border border-[#dfe6eb] p-3">
                  <p className="mt-0 text-xs leading-5">
                    Your previous overnight workday ended today. Continue{" "}
                    {continuation.workDate} or use Clock in to start today's
                    workday.
                  </p>
                  <Button
                    variant="brandOutline"
                    size="sm"
                    disabled={blocked}
                    onClick={() =>
                      propose(
                        { action: "clock-in", workdayId: continuation.id! },
                        "Continue overnight workday",
                        `Add another session to ${continuation.workDate}. Its daily requirement is counted once.`,
                      )
                    }
                  >
                    Continue {continuation.workDate}
                  </Button>
                </div>
              )}
            </OverviewPanel>
            <OverviewPanel
              title="Daily required hours"
              description={day.policy.name}
            >
              <p className="mt-0 text-2xl font-semibold tabular-nums">
                {(worked / 3600000).toFixed(2)}{" "}
                <span className="text-sm font-normal text-[#738096]">
                  / {day.requiredMinutes / 60} hours
                </span>
              </p>
              <ProgressMeter
                label="Daily required-hours progress"
                value={
                  target
                    ? Math.min(100, Math.floor((worked / target) * 100))
                    : 100
                }
                max={100}
                colorClass="bg-[#294a9b]"
              />
              <p className="mt-3 text-sm font-medium">
                {target === 0
                  ? "No required hours today"
                  : worked >= target
                    ? "Daily requirement complete"
                    : `${duration(target - worked)} remaining`}
              </p>
              {worked > target && (
                <p className="text-xs leading-5 text-[#805316]">
                  {duration(worked - target)} above the daily requirement.
                  Recorded for review; overtime has not been approved.
                </p>
              )}
              <DetailList className="mt-4">
                <DetailItem label="Working day">
                  {day.isWorkingDay ? "Yes" : "Rest day"}
                </DetailItem>
                <DetailItem label="Unpaid breaks">
                  {day.policy.unpaidBreaksEnabled ? "Enabled" : "Disabled"}
                </DetailItem>
              </DetailList>
              {day.overnightRequiresReview && (
                <p className="text-xs text-[#805316]">
                  This policy requires overnight work to be reviewed.
                </p>
              )}
            </OverviewPanel>
          </div>
        )}
        {day?.sessions.length ? (
          <SidePanelSection title="Current workday sessions">
            <AttendanceHistoryTable
              days={[{ ...day, workedMilliseconds: worked }]}
              asOf={clock.now}
              onCorrect={(session) => setCorrection({ session })}
            />
          </SidePanelSection>
        ) : null}
        <section aria-labelledby="personal-attendance-history">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="personal-attendance-history"
                className="m-0 text-[13px] font-semibold"
              >
                Personal attendance history
              </h2>
              <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                Actual clock-in and clock-out dates, grouped by assigned
                attendance workday.
              </p>
            </div>
            <Button
              variant="brandOutline"
              size="sm"
              onClick={() => setCorrection({ session: null })}
            >
              Request missing attendance
            </Button>
          </div>
          <div className="mb-4">
            <RangeFields
              {...range}
              onChange={(from, to) => {
                setRange({ from, to })
                setPage(1)
              }}
            />
          </div>
          <ResourceStatus
            loading={history.loading && !history.data}
            error={history.error}
            retry={history.retry}
          />
          {history.data && (
            <>
              <AttendanceHistoryTable
                days={history.data.workdays}
                asOf={Date.parse(history.data.asOf)}
                onCorrect={(session) => setCorrection({ session })}
              />
              <AttendancePagination
                data={history.data}
                disabled={history.loading}
                onChange={setPage}
              />
            </>
          )}
          {history.data?.asOf && (
            <p className="mt-3 text-[11px] text-[#738096]">
              History refreshed{" "}
              {attendanceDate(history.data.asOf, day?.timeZone ?? "UTC")}
            </p>
          )}
        </section>
      </div>
      {confirm && (
        <ConfirmationDialog
          title={confirm.label}
          description={confirm.description}
          confirmLabel={confirm.label}
          pendingLabel="Saving…"
          pending={clock.pending}
          destructive={false}
          error={actionError}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              if (await clock.act(confirm.input)) {
                sileo.success({ title: `${confirm.label} recorded` })
                setConfirm(null)
                setRevision((value) => value + 1)
              }
            } catch (failure) {
              setActionError(
                errorMessage(failure, "Couldn't record attendance."),
              )
            }
          }}
        />
      )}
      {correction && (
        <AdjustmentDialog
          session={correction.session}
          onClose={() => setCorrection(null)}
          onSaved={() => {
            history.retry()
            void clock.refresh()
          }}
        />
      )}
    </AttendanceShell>
  )
}
