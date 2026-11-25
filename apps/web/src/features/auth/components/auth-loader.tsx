import { useCallback, useId, useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ConverynLogoReveal } from "./converyn-logo-reveal"

type AuthRouteLoaderProps = {
  destinationReady: boolean
  onNavigate: () => void
  onExited: () => void
  ariaLabel?: string
}

export function AuthRouteLoader({
  destinationReady,
  onNavigate,
  onExited,
  ariaLabel = "Loading",
}: AuthRouteLoaderProps) {
  const coverRef = useRef<HTMLDivElement>(null)
  const openingRef = useRef<SVGRectElement>(null)
  const maskId = useId()
  const onNavigateRef = useRef(onNavigate)
  const onExitedRef = useRef(onExited)
  const [sequenceComplete, setSequenceComplete] = useState(false)

  useLayoutEffect(() => {
    onNavigateRef.current = onNavigate
    onExitedRef.current = onExited
  }, [onNavigate, onExited])

  const finishReveal = useCallback(() => {
    setSequenceComplete(true)
    onNavigateRef.current()
  }, [])

  useLayoutEffect(() => {
    if (!destinationReady || !sequenceComplete) return

    const cover = coverRef.current
    const opening = openingRef.current
    const artwork = cover?.querySelector("[data-logo-fill]")
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!cover || !opening || !artwork || motion.matches) {
      onExitedRef.current()
      return
    }

    const reveal = { progress: 0 }
    let x = 0
    let y = 0
    let radius = 0

    const setClipPath = gsap.quickSetter(opening, "clipPath")
    const renderOpening = () => {
      setClipPath(`circle(${radius * reveal.progress}px at ${x}px ${y}px)`)
    }
    const measure = () => {
      const bounds = cover.getBoundingClientRect()
      const logo = artwork.getBoundingClientRect()
      x = logo.left + logo.width / 2 - bounds.left
      y = logo.top + logo.height / 2 - bounds.top
      radius =
        Math.ceil(
          Math.hypot(
            Math.max(x, bounds.width - x),
            Math.max(y, bounds.height - y),
          ),
        ) + 1
      renderOpening()
    }

    measure()
    cover.style.maskImage = `url("#${maskId}")`
    const animation = gsap.to(reveal, {
      progress: 1,
      duration: 1.1,
      ease: "power2.inOut",
      onUpdate: renderOpening,
      onComplete: () => onExitedRef.current(),
    })

    const observer = new ResizeObserver(measure)
    observer.observe(cover)
    observer.observe(artwork)
    window.addEventListener("resize", measure)
    const finishWithoutMotion = () => {
      if (motion.matches && animation.progress() < 1) animation.progress(1)
    }
    motion.addEventListener("change", finishWithoutMotion)

    return () => {
      motion.removeEventListener("change", finishWithoutMotion)
      window.removeEventListener("resize", measure)
      observer.disconnect()
      animation.kill()
      opening.style.removeProperty("clip-path")
      cover.style.removeProperty("mask-image")
    }
  }, [destinationReady, maskId, sequenceComplete])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[100] touch-none overflow-hidden overscroll-none"
    >
      {/* The mask removes the cover inside the circle while this overlay blocks input. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <defs>
          <mask id={maskId} x="0" y="0" width="100%" height="100%">
            <rect width="100%" height="100%" fill="white" />
            <rect ref={openingRef} width="100%" height="100%" fill="black" />
          </mask>
        </defs>
      </svg>
      <div
        ref={coverRef}
        className="absolute inset-0 flex items-center justify-center bg-background"
      >
        <ConverynLogoReveal onComplete={finishReveal} />
      </div>
    </div>
  )
}
