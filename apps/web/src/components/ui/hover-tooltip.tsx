"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

type TooltipSide = "top" | "right"
type TooltipAlign = "start" | "center" | "end"

type TooltipPosition = {
  left: number
  top: number
}

const viewportPadding = 8

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

export function HoverTooltip({
  children,
  side = "top",
  align = "center",
  className,
}: {
  children: ReactNode
  side?: TooltipSide
  align?: TooltipAlign
  className?: string
}) {
  const markerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    let left: number
    let top: number

    if (side === "right") {
      left = triggerRect.right + 10
      if (left + tooltipRect.width > window.innerWidth - viewportPadding) {
        left = triggerRect.left - tooltipRect.width - 10
      }
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
    } else {
      left =
        align === "start"
          ? triggerRect.left
          : align === "end"
            ? triggerRect.right - tooltipRect.width
            : triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
      top = triggerRect.top - tooltipRect.height - 8
    }

    setPosition({
      left: clamp(
        left,
        viewportPadding,
        window.innerWidth - tooltipRect.width - viewportPadding,
      ),
      top: clamp(
        top,
        viewportPadding,
        window.innerHeight - tooltipRect.height - viewportPadding,
      ),
    })
  }, [align, side])

  useEffect(() => {
    const marker = markerRef.current
    const trigger = marker?.parentElement
    if (!trigger) return

    triggerRef.current = trigger

    const show = () => {
      setPosition(null)
      setVisible(true)
    }
    const hide = () => setVisible(false)
    const handleFocusOut = (event: FocusEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        trigger.contains(event.relatedTarget)
      ) {
        return
      }
      hide()
    }

    trigger.addEventListener("mouseenter", show)
    trigger.addEventListener("mouseleave", hide)
    trigger.addEventListener("focusin", show)
    trigger.addEventListener("focusout", handleFocusOut)

    return () => {
      triggerRef.current = null
      trigger.removeEventListener("mouseenter", show)
      trigger.removeEventListener("mouseleave", hide)
      trigger.removeEventListener("focusin", show)
      trigger.removeEventListener("focusout", handleFocusOut)
    }
  }, [])

  useLayoutEffect(() => {
    if (!visible) return

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [updatePosition, visible])

  return (
    <>
      <span ref={markerRef} className="hidden" aria-hidden="true" />
      {visible &&
        createPortal(
          <span
            ref={tooltipRef}
            className={cn(
              "pointer-events-none fixed z-[200] w-max max-w-56 rounded-md border border-[#242d3d] bg-[#070f1f] px-2.5 py-1.5 text-center text-[11px] leading-none font-medium tracking-[0.01em] whitespace-nowrap text-[#fafafa] shadow-[0_6px_18px_rgb(7_15_31_/_18%)] max-[767px]:hidden",
              position ? "visible opacity-100" : "invisible opacity-0",
              className,
            )}
            style={position ?? undefined}
            aria-hidden="true"
          >
            {children}
          </span>,
          document.body,
        )}
    </>
  )
}
