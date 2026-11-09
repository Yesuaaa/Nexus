import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type KpiMetric = {
  label: string
  value: number
  formattedValue?: string
  description: string
  icon: LucideIcon
  iconClassName: string
  chartValues?: number[]
  chartLabel?: string
  chartColor?: string
  chart?: ReactNode
}

export type KpiCardVariant = "default" | "blue"

function MiniGraph({
  values,
  label,
  color,
  inline = false,
}: {
  values: number[]
  label: string
  color: string
  inline?: boolean
}) {
  const series = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]
  const width = 240
  const top = 4
  const bottom = 38
  const maxValue = Math.max(...series, 1)
  const points = series.map((value, index) => ({
    x: (index / (series.length - 1)) * width,
    y: bottom - (value / maxValue) * (bottom - top),
  }))
  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ")
  const lastPoint = points[points.length - 1]
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${bottom} L 0 ${bottom} Z`

  return (
    <svg
      className={cn("w-full overflow-visible", inline ? "h-8" : "mt-3 h-10")}
      viewBox={`0 0 ${width} 42`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path d={`M 0 ${bottom} H ${width}`} stroke="#dfe6eb" />
      <path d={areaPath} fill={color} fillOpacity="0.1" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="2.5"
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function KpiCards({
  metrics,
  label,
  pending,
  unavailable,
  showCharts = true,
  variant = "default",
  className,
}: {
  metrics: KpiMetric[]
  label: string
  pending: boolean
  unavailable: boolean
  showCharts?: boolean
  variant?: KpiCardVariant
  className?: string
}) {
  const isBlue = variant === "blue"

  return (
    <section
      className={cn("grid min-w-0 gap-3.5 @container", className)}
      aria-label={label}
      aria-busy={pending}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon
        const hasMiniGraph = Boolean(
          metric.chartValues && metric.chartLabel && metric.chartColor,
        )
        const hasChart = Boolean(metric.chart || hasMiniGraph)

        return (
          <article
            key={metric.label}
            className={cn(
              "relative min-w-0 rounded-xl border border-[#dfe6eb] bg-[#f8fafb] p-4 shadow-[0_2px_8px_rgb(30_55_80_/_5%)]",
              isBlue &&
                "overflow-hidden rounded-2xl border-0 bg-[#294c96] p-5 text-white shadow-[0_8px_24px_rgb(26_58_128_/_10%)] transition-shadow duration-300 hover:shadow-[0_14px_34px_rgb(26_58_128_/_22%)] motion-reduce:transition-none",
            )}
          >
            {isBlue && (
              <span
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,transparent_40%,rgb(20_54_129_/_42%))]"
                aria-hidden="true"
              />
            )}
            <div className="relative z-20 flex min-w-0 items-center gap-2.5">
              {isBlue ? (
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-current bg-[rgb(22_48_105_/_10%)]">
                  <Icon
                    className="text-white"
                    size={17}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </span>
              ) : (
                <Icon
                  className={metric.iconClassName}
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
              <h2
                className={cn(
                  "m-0 truncate text-xs font-medium",
                  isBlue ? "text-white/85" : "text-[#65718a]",
                )}
              >
                {metric.label}
              </h2>
            </div>
            {pending ? (
              <>
                <div
                  className={cn(
                    "mt-3 h-7 w-16 animate-pulse rounded-md motion-reduce:animate-none",
                    isBlue ? "bg-[rgb(255_255_255_/_18%)]" : "bg-[#dfe6eb]",
                  )}
                >
                  <span className="sr-only">Loading {metric.label}</span>
                </div>
                {showCharts && (
                  <div
                    className={cn(
                      "animate-pulse rounded-md motion-reduce:animate-none",
                      isBlue ? "bg-[rgb(255_255_255_/_12%)]" : "bg-[#edf1f4]",
                      hasChart
                        ? "absolute top-[41px] right-4 h-8 w-[72px]"
                        : "mt-3 h-10",
                    )}
                  />
                )}
              </>
            ) : (
              <>
                <p
                  className={cn(
                    "mt-3 mb-0 text-2xl leading-none font-semibold tracking-[-0.025em] tabular-nums",
                    isBlue ? "text-white" : "text-foreground",
                    showCharts && hasChart && "pr-[84px]",
                  )}
                >
                  {unavailable
                    ? "—"
                    : (metric.formattedValue ??
                      metric.value.toLocaleString("en-US"))}
                </p>
                <p
                  className={cn(
                    "mt-1.5 mb-0 truncate text-[11px]",
                    isBlue ? "text-white/70" : "text-[#738096]",
                  )}
                >
                  {unavailable ? "Data unavailable" : metric.description}
                </p>
                {showCharts && metric.chart && (
                  <div className="absolute top-[41px] right-4 h-8 w-[72px]">
                    {unavailable ? (
                      <p className="m-0 text-[10px] text-[#738096]">
                        Unavailable
                      </p>
                    ) : (
                      metric.chart
                    )}
                  </div>
                )}
                {showCharts && !metric.chart && hasMiniGraph && (
                  <div className="absolute top-[41px] right-4 h-8 w-[72px]">
                    <MiniGraph
                      values={unavailable ? [] : (metric.chartValues ?? [])}
                      label={
                        unavailable
                          ? "Chart data unavailable"
                          : (metric.chartLabel ?? "KPI trend")
                      }
                      color={metric.chartColor ?? "#4169bd"}
                      inline
                    />
                  </div>
                )}
              </>
            )}
          </article>
        )
      })}
    </section>
  )
}
