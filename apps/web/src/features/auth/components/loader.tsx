import { useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"

gsap.registerPlugin(DrawSVGPlugin)

type AuthRouteLoaderProps = {
  destinationReady: boolean
  onNavigate: () => void
  onExited: () => void
  label?: string | null
  ariaLabel?: string
  labelClassName?: string
  labelTextIndent?: string
}

export function AuthRouteLoader({
  destinationReady,
  onNavigate,
  onExited,
  // Optional: with no label the overlay is the animated mark alone, and only
  // the aria-label describes the wait.
  label = null,
  ariaLabel = "Loading",
  labelClassName = "text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400",
  labelTextIndent = "0.22em",
}: AuthRouteLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<SVGSVGElement>(null)
  const labelRef = useRef<HTMLParagraphElement>(null)
  const onNavigateRef = useRef(onNavigate)
  const onExitedRef = useRef(onExited)
  const [sequenceComplete, setSequenceComplete] = useState(false)

  useLayoutEffect(() => {
    onNavigateRef.current = onNavigate
    onExitedRef.current = onExited
  }, [onNavigate, onExited])

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const paths = markRef.current?.querySelectorAll("[data-draw]") || []
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches

      const labelNode = labelRef.current

      gsap.set(paths, { drawSVG: "0%", opacity: 1 })

      if (labelNode) {
        gsap.set(labelNode, { opacity: 0, y: 5 })
      }

      const timeline = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => {
          setSequenceComplete(true)
          onNavigateRef.current?.()
        },
      })

      if (reduceMotion) {
        timeline.set(paths, { drawSVG: "100%" })

        if (labelNode) {
          timeline.set(labelNode, { opacity: 1, y: 0 })
        }

        timeline.to({}, { duration: 0.8 })
        return
      }

      timeline.to(paths, {
        drawSVG: "100%",
        duration: 0.62,
        stagger: 0.045,
      })

      if (labelNode) {
        timeline.to(labelNode, { opacity: 1, y: 0, duration: 0.18 }, "-=0.3")
      }

      timeline.to({}, { duration: 0.8 })
    }, overlayRef)

    return () => context.revert()
  }, [])

  useLayoutEffect(() => {
    if (!destinationReady || !sequenceComplete) return undefined

    const context = gsap.context(() => {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.24,
        delay: 0.06,
        ease: "power2.out",
        onComplete: () => onExitedRef.current?.(),
      })
    }, overlayRef)

    return () => context.revert()
  }, [destinationReady, sequenceComplete])

  return (
    <div
      ref={overlayRef}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-[72px] w-[198px]">
          <svg
            ref={markRef}
            viewBox="0 0 176 64"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            className="h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient
                id="exp-loader-accent"
                gradientUnits="userSpaceOnUse"
                x1="87.9"
                y1="26.7"
                x2="87.9"
                y2="60.4"
              >
                <stop offset="0%" stopColor="#32E2F5" />
                <stop offset="48%" stopColor="#2C91B7" />
                <stop offset="100%" stopColor="#34306E" />
              </linearGradient>
            </defs>

            {/* The source mark uses three floating bars rather than a stemmed E. */}
            <g
              fill="none"
              stroke="#262626"
              strokeLinecap="butt"
              strokeWidth="7.4"
            >
              <path data-draw d="M4 7 H50" />
              <path data-draw d="M4 32 H50" />
              <path data-draw d="M4 57 H50" />
            </g>

            <defs>
              <mask
                id="exp-loader-x-left-reveal"
                maskUnits="userSpaceOnUse"
                x="54"
                y="-4"
                width="32"
                height="34"
              >
                <path
                  data-draw
                  d="M61 1.5 L79 25.5"
                  fill="none"
                  stroke="white"
                  strokeLinecap="square"
                  strokeWidth="14"
                />
              </mask>
              <mask
                id="exp-loader-x-right-reveal"
                maskUnits="userSpaceOnUse"
                x="92"
                y="-4"
                width="32"
                height="34"
              >
                <path
                  data-draw
                  d="M116 1.5 L98 25.5"
                  fill="none"
                  stroke="white"
                  strokeLinecap="square"
                  strokeWidth="14"
                />
              </mask>
              <mask
                id="exp-loader-x-outer-ribbon-reveal"
                maskUnits="userSpaceOnUse"
                x="52"
                y="21"
                width="72"
                height="44"
              >
                <path
                  data-draw
                  d="M60.3 60.4 L87.9 28.6 L115.5 60.4"
                  fill="none"
                  stroke="white"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  strokeWidth="8"
                />
              </mask>
              <mask
                id="exp-loader-x-inner-ribbon-reveal"
                maskUnits="userSpaceOnUse"
                x="59"
                y="26"
                width="58"
                height="39"
              >
                <path
                  data-draw
                  d="M66.5 60.4 L87.9 35.1 L109.3 60.4"
                  fill="none"
                  stroke="white"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  strokeWidth="8"
                />
              </mask>
              <mask
                id="exp-loader-p-reveal"
                maskUnits="userSpaceOnUse"
                x="120"
                y="-1"
                width="58"
                height="67"
              >
                <path
                  data-draw
                  d="M130 7 H151.5 C161.5 7 167.8 14.2 167.8 23.5 C167.8 32.8 161.5 40 151.5 40 H130 V56.3"
                  fill="none"
                  stroke="white"
                  strokeLinecap="square"
                  strokeLinejoin="round"
                  strokeWidth="12"
                />
              </mask>
            </defs>

            {/* The upper X arms taper to the pointed ends in the source mark. */}
            <g fill="#262626">
              <path
                d="M58.5 3.3 H69 L81 18 L76 23.8 Z"
                mask="url(#exp-loader-x-left-reveal)"
              />
              <path
                d="M108 3.3 H118 L100.8 23.8 L95.8 18 Z"
                mask="url(#exp-loader-x-right-reveal)"
              />
            </g>

            {/* Custom ribbon silhouettes preserve the sharp tips and white channel. */}
            <g fill="url(#exp-loader-accent)">
              <path
                d="M57.8 60.4 L87.9 26.7 L118 60.4 H113 L87.9 30.5 L62.8 60.4 Z"
                mask="url(#exp-loader-x-outer-ribbon-reveal)"
              />
              <path
                d="M64.2 60.4 L87.9 31.8 L111.6 60.4 H107 L87.9 38.3 L68.8 60.4 Z"
                mask="url(#exp-loader-x-inner-ribbon-reveal)"
              />
            </g>

            {/* A single silhouette keeps the P rail, bowl, and square foot exact. */}
            <path
              d="M125.7 3.3 H151.7 C163.2 3.3 171.9 12.1 171.9 23.5 C171.9 34.9 163.2 43.8 151.7 43.8 H134.5 V60.4 H125.7 V36.2 H151.1 C158.6 36.2 163.6 30.8 163.6 23.5 C163.6 16.3 158.6 10.7 151.1 10.7 H125.7 Z"
              fill="#262626"
              mask="url(#exp-loader-p-reveal)"
            />
          </svg>
        </div>

        {label ? (
          <p
            ref={labelRef}
            className={`w-max max-w-[calc(100vw-2rem)] whitespace-nowrap text-center ${labelClassName}`}
            style={{ paddingLeft: labelTextIndent }}
          >
            {label}
          </p>
        ) : null}
      </div>
    </div>
  )
}
