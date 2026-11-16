"use client"
import { Activity, Database, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import { Pill, type PillTone } from "@/components/ui/pill"
import { DetailList, DetailItem } from "@/components/ui/side-panel"
import { useAsyncResource } from "@/lib/use-async-resource"
import { formatDateTime } from "@/lib/format"
import { loadSystemHealth } from "../api/system-health-api"
import type { HealthStatus } from "../model/system-health"
const tones: Record<HealthStatus, PillTone> = {
  Healthy: "success",
  Degraded: "warning",
  Unavailable: "danger",
  Unknown: "neutral",
}
const statusStyles: Record<HealthStatus, string> = {
  Healthy: "text-[#19703a]",
  Degraded: "text-[#805316]",
  Unavailable: "text-[#b4234d]",
  Unknown: "text-[#596579]",
}
const meanings: Record<HealthStatus, string> = {
  Healthy: "Observed success",
  Degraded: "Observed concern",
  Unavailable: "Probe failed",
  Unknown: "Insufficient observation",
}
const stamp = (value: string | null) =>
  value ? `${formatDateTime(value, "UTC")} UTC` : "No observation recorded"
export function SystemHealthView() {
  const result = useAsyncResource(loadSystemHealth, [], {
    fallbackError: "System Health observation is unavailable.",
  })
  const data = !result.loading && !result.error ? result.data : undefined
  const values: {
    label: string
    status: HealthStatus
    description: string
    icon: KpiMetric["icon"]
  }[] = [
    {
      label: "API availability",
      status: data?.api.status ?? "Unknown",
      description: data
        ? `${data.api.uptimeSeconds} seconds process uptime`
        : "No current observation",
      icon: Activity,
    },
    {
      label: "Database readiness",
      status: data?.database.status ?? "Unknown",
      description: "Existing bounded readiness probe",
      icon: Database,
    },
    {
      label: "Message-expiry job",
      status: data?.messageExpiry.status ?? "Unknown",
      description: data?.messageExpiry.running
        ? "Execution in progress"
        : "Last known execution only",
      icon: Clock,
    },
    {
      label: "Recent error observations",
      status: data?.recentErrors.status ?? "Unknown",
      description:
        data?.recentErrors.retainedCount == null
          ? "No buffer observation"
          : `${data.recentErrors.retainedCount} retained errors in 15 minutes`,
      icon: AlertTriangle,
    },
  ]
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">System Health</h2>
        <Button
          variant="outline"
          onClick={result.retry}
          disabled={result.loading}
        >
          Refresh health
        </Button>
      </div>
      <div
        role="note"
        className="mb-4 rounded-lg border border-[#e1e4ea] bg-[#f6f8fb] p-4 text-xs leading-relaxed"
      >
        <strong>Instance-local observations only.</strong> This snapshot covers
        the API process answering this request. Other replicas, deployment-wide
        availability and historical uptime are unknown. Refresh manually; no
        polling runs. Database probe observations may be reused for 10 seconds.
      </div>
      {result.error && (
        <div role="alert" className="mb-4 text-xs">
          <p>{result.error}</p>
          <Button variant="outline" className="mt-2" onClick={result.retry}>
            Retry health
          </Button>
        </div>
      )}
      <KpiCards
        label="System Health observations"
        pending={result.loading}
        unavailable={false}
        showCharts={false}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        metrics={values.map((value) => ({
          label: value.label,
          value: 0,
          formattedValue: value.status,
          description: value.description,
          icon: value.icon,
          iconClassName: statusStyles[value.status],
        }))}
      />
      {data && (
        <div className="mt-5 space-y-4 text-xs" aria-live="polite">
          <div
            className="flex flex-wrap gap-2"
            aria-label="Health status meanings"
            role="note"
          >
            <span className="font-medium text-[#52627a]">Status key</span>
            {(["Healthy", "Degraded", "Unavailable", "Unknown"] as const).map(
              (status) => (
                <span key={status} className="flex items-center gap-1.5">
                  <Pill tone={tones[status]}>{status}</Pill>
                  <span className="text-[#65718a]">{meanings[status]}</span>
                </span>
              ),
            )}
          </div>
          <DetailList layout="stacked">
            <DetailItem label="Observation time">
              {stamp(data.observedAt)}
            </DetailItem>
            <DetailItem label="Last successful readiness check">
              {stamp(data.lastSuccessfulCheckAt)}
            </DetailItem>
            <DetailItem label="Database probe time">
              {stamp(data.database.checkedAt)}
            </DetailItem>
            <DetailItem label="Job started">
              {stamp(data.messageExpiry.startedAt)}
            </DetailItem>
            <DetailItem label="Job completed">
              {stamp(data.messageExpiry.completedAt)}
            </DetailItem>
            <DetailItem label="Last known job result">
              {data.messageExpiry.lastResult ??
                "Unknown — no execution observed"}
              {data.messageExpiry.stale
                ? " · Observation missing or older than 75 minutes; health is unknown."
                : ""}
            </DetailItem>
            <DetailItem label="Error buffer coverage">
              {data.recentErrors.retainedCount === null
                ? "Buffer unavailable; error count unknown."
                : `${data.recentErrors.retainedCount} retained observations in the last 15 minutes; ${data.recentErrors.evictedCount ?? "unknown"} lifetime evictions, ${data.recentErrors.droppedCount ?? "unknown"} lifetime drops.`}
            </DetailItem>
          </DetailList>
          <p>
            Last successful readiness means this process was not draining and
            its database probe succeeded; it does not certify jobs or other
            components. Job checks observe the existing hourly expiry job
            without triggering it. A running or stale job observation is
            Unknown.
          </p>
          <p>
            Recent errors summarize only the existing 1,000-record, 24-hour
            memory buffer. Restart loss, expiry, evictions and dropped records
            limit coverage. An empty or unavailable buffer is Unknown, not proof
            of health. Degraded error observations indicate recent captured
            failures, not a live outage. See Errors &amp; Exceptions for
            retained details.
          </p>
        </div>
      )}
    </>
  )
}
