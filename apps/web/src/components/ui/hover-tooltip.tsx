"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export const hoverTooltipClass =
  "pointer-events-none rounded-md border border-[#242d3d] bg-[#070f1f] px-2.5 py-1.5 text-center text-[11px] leading-snug font-medium tracking-[0.01em] text-[#fafafa] shadow-[0_6px_18px_rgb(7_15_31_/_18%)]"

type TooltipSide = "top" | "bottom" | "right"

export function HoverTooltip({
  children,
  side = "top",
  className,
}: {
  children: ReactNode
  side?: TooltipSide
  className?: string
}) {
  const markerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const trigger = markerRef.current?.parentElement
    if (!trigger) return

    function show(event: PointerEvent) {
      if (event.pointerType !== "touch") setOpen(true)
    }
    function hide() {
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide()
    }

    trigger.addEventListener("pointerenter", show)
    trigger.addEventListener("pointerleave", hide)
    trigger.addEventListener("pointercancel", hide)
    document.addEventListener("scroll", hide, true)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("resize", hide)
    window.addEventListener("blur", hide)
    window.visualViewport?.addEventListener("resize", hide)
    window.visualViewport?.addEventListener("scroll", hide)
    return () => {
      trigger.removeEventListener("pointerenter", show)
      trigger.removeEventListener("pointerleave", hide)
      trigger.removeEventListener("pointercancel", hide)
      document.removeEventListener("scroll", hide, true)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("resize", hide)
      window.removeEventListener("blur", hide)
      window.visualViewport?.removeEventListener("resize", hide)
      window.visualViewport?.removeEventListener("scroll", hide)
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const trigger = markerRef.current?.parentElement
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    function position() {
      if (!trigger || !tooltip) return
      const viewport = window.visualViewport
      const margin = 8
      const gap = side === "right" ? 10 : 8
      const leftEdge = (viewport?.offsetLeft ?? 0) + margin
      const topEdge = (viewport?.offsetTop ?? 0) + margin
      const viewportWidth = viewport?.width ?? window.innerWidth
      const rightEdge = leftEdge + viewportWidth - margin * 2
      const bottomEdge =
        topEdge + (viewport?.height ?? window.innerHeight) - margin * 2
      tooltip.style.maxWidth = `${Math.min(224, Math.max(0, viewportWidth - margin * 2))}px`
      const anchor = trigger.getBoundingClientRect()
      const bounds = tooltip.getBoundingClientRect()
      let left = anchor.left + (anchor.width - bounds.width) / 2
      let top = anchor.top - bounds.height - gap

      if (side === "right") {
        left = anchor.right + gap
        if (left + bounds.width > rightEdge)
          left = anchor.left - bounds.width - gap
        top = anchor.top + (anchor.height - bounds.height) / 2
      } else if (side === "bottom") {
        top = anchor.bottom + gap
        if (top + bounds.height > bottomEdge)
          top = anchor.top - bounds.height - gap
      } else if (top < topEdge) {
        top = anchor.bottom + gap
      }

      tooltip.style.left = `${Math.max(leftEdge, Math.min(left, rightEdge - bounds.width))}px`
      tooltip.style.top = `${Math.max(topEdge, Math.min(top, bottomEdge - bounds.height))}px`
      tooltip.style.visibility = "visible"
    }

    position()
    const observer = new ResizeObserver(position)
    observer.observe(trigger)
    observer.observe(tooltip)
    return () => observer.disconnect()
  }, [open, side, children])

  return (
    <>
      <span
        ref={markerRef}
        hidden
        data-hover-tooltip="true"
        aria-hidden="true"
      />
      {open &&
        createPortal(
          <span
            ref={tooltipRef}
            className={cn(
              hoverTooltipClass,
              "fixed z-[300] w-max max-w-56 break-words max-[767px]:hidden",
              className,
            )}
            style={{ top: 0, left: 0, visibility: "hidden" }}
            data-hover-tooltip="true"
            aria-hidden="true"
          >
            {children}
          </span>,
          document.body,
        )}
    </>
  )
}
