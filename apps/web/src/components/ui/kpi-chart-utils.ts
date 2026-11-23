type KpiSegment = {
  value: number
  color: string
}

export function kpiSegmentGradient(segments: readonly KpiSegment[]) {
  const visibleSegments = segments.filter((segment) => segment.value > 0)
  const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0)
  if (!total) return "#e3e9ef"

  let offset = 0
  const gradient = visibleSegments
    .map((segment) => {
      const start = offset
      offset += (segment.value / total) * 100
      return `${segment.color} ${start}% ${offset}%`
    })
    .join(", ")

  return `conic-gradient(${gradient})`
}
