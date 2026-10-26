import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type KpiMetric = {
  label: string
  value: number
  description: string
  icon: LucideIcon
  iconClassName: string
  chartValues?: number[]
  chartLabel?: string
  chartColor?: string
}

function MiniGraph({
  values,
  label,
  color,
}: {
  values: number[]
  label: string
  color: string
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
      className="mt-3 h-10 w-full overflow-visible"
      viewBox={`0 0 ${width} 42`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
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
  className,
}: {
  metrics: KpiMetric[]
  label: string
  pending: boolean
  unavailable: boolean
  showCharts?: boolean
  className?: string
}) {
  return (
    <section
      className={cn("grid min-w-0 gap-3.5 @container", className)}
      aria-label={label}
      aria-busy={pending}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon

        return (
          <article
            key={metric.label}
            className="min-w-0 rounded-xl border border-[#dfe6eb] bg-[#f8fafb] p-4 shadow-[0_2px_8px_rgb(30_55_80_/_5%)]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon
                className={metric.iconClassName}
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <h2 className="m-0 truncate text-xs font-medium text-[#65718a]">
                {metric.label}
              </h2>
            </div>
            {pending ? (
              <>
                <div className="mt-3 h-7 w-16 animate-pulse rounded-md bg-[#dfe6eb] motion-reduce:animate-none">
                  <span className="sr-only">Loading {metric.label}</span>
                </div>
                {showCharts && (
                  <div className="mt-3 h-10 animate-pulse rounded-md bg-[#edf1f4] motion-reduce:animate-none" />
                )}
              </>
            ) : (
              <>
                <p className="mt-3 mb-0 text-2xl leading-none font-semibold tracking-[-0.025em] text-foreground tabular-nums">
                  {unavailable ? "—" : metric.value.toLocaleString("en-US")}
                </p>
                <p className="mt-1.5 mb-0 truncate text-[11px] text-[#738096]">
                  {unavailable ? "Data unavailable" : metric.description}
                </p>
                {showCharts &&
                  metric.chartValues &&
                  metric.chartLabel &&
                  metric.chartColor && (
                    <MiniGraph
                      values={unavailable ? [] : metric.chartValues}
                      label={
                        unavailable
                          ? "Chart data unavailable"
                          : metric.chartLabel
                      }
                      color={metric.chartColor}
                    />
                  )}
              </>
            )}
          </article>
        )
      })}
    </section>
  )
}
