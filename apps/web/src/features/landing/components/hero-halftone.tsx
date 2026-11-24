"use client"

import { useEffect, useRef } from "react"

const STEP_PX = 6
const TARGET_MAX_GRID_POINTS = 10_000
const EDGE_OVERFLOW_PX = 36
const FRAME_INTERVAL_MS = 1000 / 30
const INDICATOR_LOOP_MS = 1900
const FIELD_LOOP_MS = 8 * INDICATOR_LOOP_MS
const TURN = 2 * Math.PI

const blues = ["#203F8C", "#234DA4", "#285AB9", "#326ACD"]
const opacities = [0.5, 0.62, 0.73, 0.83, 0.93, 1]
const edgeOpacities = [0.05, 0.1, 0.18, 0.29, 0.4]
const opacityStops = [...edgeOpacities, ...opacities]

// Group dots by paint so each frame needs only a few canvas fill calls.
const paints = blues.flatMap((color) =>
  opacityStops.map((opacity, index) => ({
    color,
    opacity,
    radius: 1.2 + (index - edgeOpacities.length) * 0.14,
  })),
)

type Dot = {
  x: number
  y: number
  ribbon: number
  fold: number
  shimmer: number
  edge: number
  edgePhase: number
  centerFade: number
  backdropFade: number
}

function makeGrid(width: number, height: number, wideLayout: boolean) {
  const dots: Dot[] = []
  const centerX = width * (wideLayout ? 0.57 : 0.5)
  const centerY = height / 2
  const radiusX = centerX - 24
  const radiusY = centerY - 24
  const edgeScale = Math.min(radiusX, radiusY)
  const step = Math.max(
    STEP_PX,
    Math.ceil(Math.sqrt((width * height) / TARGET_MAX_GRID_POINTS)),
  )

  for (let y = (height % step) / 2; y < height; y += step) {
    const v = y / height
    // Follow the sketch's inward curve in the middle and wider ends.
    const leftEdge =
      0.13 +
      Math.sin(v * Math.PI) * 0.18 +
      Math.sin(v * TURN * 2 + 0.6) * 0.049 +
      Math.sin(v * TURN * 5 - 0.85) * 0.022
    const rimFade = Math.min(1, y / 24, (height - y) / 26)

    for (let x = (width % step) / 2; x < width; x += step) {
      const u = x / width
      const offsetX = (x - centerX) / radiusX
      const offsetY = (y - centerY) / radiusY
      const angle = Math.atan2(offsetY, offsetX)
      // Overlapping curves give the fixed dot grid an asymmetric silhouette.
      const contour =
        0.79 +
        Math.cos(angle * 2 + 0.8) * 0.09 +
        Math.sin(angle * 3 - 0.7) * 0.1 +
        Math.cos(angle * 5 + 0.4) * 0.055
      const edge = wideLayout
        ? (leftEdge - u) * width
        : Math.max(0, (Math.hypot(offsetX, offsetY) - contour) * edgeScale)
      if (edge > EDGE_OVERFLOW_PX) continue

      const distanceFromIndicator = Math.hypot(
        (x - centerX) / 64,
        (y - centerY) / 38,
      )

      dots.push({
        x,
        y,
        ribbon: u * 8 + v * 11 + Math.sin(u * 7 - v * 3) * 1.6,
        fold: u * 14 - v * 5 + Math.cos(v * 9 + u * 2) * 1.8,
        shimmer: u * 6 - v * 12,
        edge,
        edgePhase: wideLayout ? v * TURN * 4 : angle * 9,
        centerFade: Math.min(1, 0.3 + distanceFromIndicator * 0.62),
        backdropFade: wideLayout
          ? rimFade * Math.min(1, Math.max(0.15, (u - 0.1) / 0.32))
          : 1,
      })
    }
  }
  return { dots, centerX, centerY, wideLayout }
}

function paintFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  { dots, centerX, centerY, wideLayout }: ReturnType<typeof makeGrid>,
  elapsed: number,
  animateIndicator: boolean,
  showIndicator: boolean,
) {
  const phase = (elapsed / FIELD_LOOP_MS) * TURN
  const ribbonPhase = phase * (wideLayout ? 3 : 2)
  const paths = paints.map(() => new Path2D())

  for (const dot of dots) {
    const fold = Math.sin(dot.fold + phase)
    const ribbon = Math.sin(
      dot.ribbon - ribbonPhase + (wideLayout ? fold * 0.8 : 0),
    )
    const shimmer = Math.cos(dot.shimmer - phase * 3)
    const field = 0.5 + ribbon * 0.26 + fold * 0.16 + shimmer * 0.08
    const wave = (ribbon + 1) / 2
    const contrast = wideLayout
      ? Math.max(0.3, Math.min(1, 0.3 + wave * 0.64 + fold * 0.08))
      : 0.19 + field * 0.81
    let strength = contrast * dot.centerFade
    let fade = dot.backdropFade

    if (wideLayout && dot.edge > -34) {
      const drift = Math.sin(dot.edgePhase - phase) * 10
      fade *= Math.min(1, Math.max(0, (18 + drift - dot.edge) / 48))
    } else if (dot.edge > 0) {
      // The grid stays fixed. Light fades into irregular lobes at each edge.
      const reach =
        14 +
        Math.sin(dot.edgePhase - phase) * 8 +
        Math.cos(dot.edgePhase * 2 + phase * 2) * 4
      strength *= Math.max(0, 1 - dot.edge / reach)
      if (strength < 0.11) continue
    }
    if (fade < 0.04) continue

    const hue = Math.min(blues.length - 1, Math.floor(field * blues.length))
    const paintLevel = wideLayout
      ? Math.min(
          opacityStops.length - 1,
          Math.floor(strength * fade * opacityStops.length),
        )
      : edgeOpacities.length +
        Math.min(opacities.length - 1, Math.floor(strength * opacities.length))
    const index = hue * opacityStops.length + paintLevel
    const { radius } = paints[index]
    paths[index].moveTo(dot.x + radius, dot.y)
    paths[index].arc(dot.x, dot.y, radius, 0, TURN)
  }

  context.clearRect(0, 0, width, height)
  for (const [index, paint] of paints.entries()) {
    context.globalAlpha = paint.opacity
    context.fillStyle = paint.color
    context.fill(paths[index])
  }

  if (!showIndicator) return
  context.globalAlpha = 1
  context.fillStyle = blues[0]
  context.beginPath()
  for (let index = 0; index < 3; index++) {
    const localTime = (elapsed % INDICATOR_LOOP_MS) - 250 - index * 240
    const progress = Math.min(1, Math.max(0, localTime / 460))
    const lift = animateIndicator ? Math.sin(progress * Math.PI) ** 2 : 0
    const x = centerX + (index - 1) * 26
    const y = centerY - lift * 13
    context.moveTo(x + 6, y)
    context.arc(x, y, 6, 0, TURN)
  }
  context.fill()
}

export function HeroHalftone({ background = false }: { background?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const wideLayout = window.matchMedia("(min-width: 761px)")
    let width = 0
    let height = 0
    let grid: ReturnType<typeof makeGrid> | undefined
    let visible = false
    let frame = 0
    let lastPaint = 0
    let elapsed = 0

    function paint() {
      if (!context || !grid) return
      paintFrame(
        context,
        width,
        height,
        grid,
        elapsed,
        !reducedMotion.matches,
        !background,
      )
    }

    function tick(now: number) {
      if (!lastPaint) lastPaint = now
      const delta = now - lastPaint
      if (delta >= FRAME_INTERVAL_MS - 1) {
        elapsed = (elapsed + delta) % FIELD_LOOP_MS
        lastPaint = now
        paint()
      }
      frame = window.requestAnimationFrame(tick)
    }

    function updatePlayback() {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      lastPaint = 0
      paint()
      if (visible && !document.hidden && !reducedMotion.matches) {
        frame = window.requestAnimationFrame(tick)
      }
    }

    function resize() {
      if (!canvas || !context) return
      width = canvas.clientWidth
      height = canvas.clientHeight
      if (width <= 60 || height <= 60) {
        grid = undefined
        return
      }
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(
        canvas.width / width,
        0,
        0,
        canvas.height / height,
        0,
        0,
      )
      grid = makeGrid(width, height, wideLayout.matches)
      paint()
    }

    const sizeObserver = new ResizeObserver(resize)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updatePlayback()
    })
    resize()
    sizeObserver.observe(canvas)
    visibilityObserver.observe(canvas)
    reducedMotion.addEventListener("change", updatePlayback)
    document.addEventListener("visibilitychange", updatePlayback)

    return () => {
      window.cancelAnimationFrame(frame)
      sizeObserver.disconnect()
      visibilityObserver.disconnect()
      reducedMotion.removeEventListener("change", updatePlayback)
      document.removeEventListener("visibilitychange", updatePlayback)
    }
  }, [background])

  return (
    <div
      className={
        background
          ? "pointer-events-none absolute inset-0 opacity-20"
          : "relative max-[761px]:aspect-[4/3] max-[761px]:w-full max-[761px]:max-w-[290px] max-[761px]:justify-self-center min-[761px]:absolute min-[761px]:top-[calc(-1px_-_var(--landing-header-height))] min-[761px]:right-[calc(-1_*_var(--landing-frame-inset))] min-[761px]:bottom-0 min-[761px]:left-[40%]"
      }
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={
          background
            ? "pointer-events-none absolute inset-0 block size-full"
            : "pointer-events-none absolute inset-0 block size-full min-[761px]:[mask-image:linear-gradient(to_left,#000_0_max(0px,calc(var(--landing-frame-inset)_-_8px)),transparent_max(0px,calc(var(--landing-frame-inset)_-_8px))_calc(var(--landing-frame-inset)_+_8px),#000_calc(var(--landing-frame-inset)_+_8px))]"
        }
      />
    </div>
  )
}
