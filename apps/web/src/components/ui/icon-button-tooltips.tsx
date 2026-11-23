"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { hoverTooltipClass } from "@/components/ui/hover-tooltip"

// A stable client snapshot keeps the body portal out of server rendering.
function subscribe() {
  return () => undefined
}

/** Reuse button names across pages, including buttons in portaled panels. */
export function IconButtonTooltips() {
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

  useEffect(() => {
    if (!mounted) return

    let active: HTMLButtonElement | null = null
    let originalTitle: string | null = null

    function hide() {
      if (active && originalTitle !== null) {
        active.setAttribute("title", originalTitle)
      }
      active = null
      originalTitle = null
      if (tooltipRef.current) tooltipRef.current.hidden = true
    }

    function hasVisibleText(button: HTMLButtonElement) {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const parent = node.parentElement
        if (
          node.textContent?.trim() &&
          parent &&
          !parent.closest(
            "svg, .sr-only, [aria-hidden='true'], [data-hover-tooltip]",
          ) &&
          getComputedStyle(parent).visibility === "visible"
        ) {
          const range = document.createRange()
          range.selectNodeContents(node)
          if (
            Array.from(range.getClientRects()).some(
              (rect) => rect.width > 0 && rect.height > 0,
            )
          ) {
            return true
          }
        }
        node = walker.nextNode()
      }
      return false
    }

    function show(target: EventTarget | null) {
      const button = target instanceof Element ? target.closest("button") : null
      if (button === active) return
      hide()
      if (
        !button ||
        button.disabled ||
        button.getAttribute("aria-disabled") === "true" ||
        button.getAttribute("aria-expanded") === "true" ||
        button.hasAttribute("aria-describedby") ||
        !button.querySelector("svg, [data-icon]") ||
        button.querySelector("[data-hover-tooltip], [role='tooltip']") ||
        Array.from(button.parentElement?.children ?? []).some((child) =>
          child.matches("[data-hover-tooltip], [role='tooltip']"),
        ) ||
        hasVisibleText(button)
      )
        return

      const labelledBy = button
        .getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(" ")
      const label =
        button.getAttribute("title") ||
        button.getAttribute("aria-label") ||
        labelledBy
      if (!label) return

      active = button
      originalTitle = button.getAttribute("title")
      button.removeAttribute("title")
      const tooltip = tooltipRef.current
      if (!tooltip || !button.isConnected) return hide()
      tooltip.textContent = label
      tooltip.hidden = false
      const rect = button.getBoundingClientRect()
      const bounds = tooltip.getBoundingClientRect()
      const viewport = window.visualViewport
      const left = (viewport?.offsetLeft ?? 0) + 8
      const top = (viewport?.offsetTop ?? 0) + 8
      const right = left + (viewport?.width ?? window.innerWidth) - 16
      const bottom = top + (viewport?.height ?? window.innerHeight) - 16
      tooltip.style.left = `${Math.max(left, Math.min(rect.left + (rect.width - bounds.width) / 2, right - bounds.width))}px`
      const y =
        rect.top - bounds.height - 8 >= top
          ? rect.top - bounds.height - 8
          : rect.bottom + 8
      tooltip.style.top = `${Math.max(top, Math.min(y, bottom - bounds.height))}px`
    }

    function onPointerOver(event: PointerEvent) {
      if (event.pointerType !== "touch") show(event.target)
    }
    function onPointerOut(event: PointerEvent) {
      if (
        active &&
        !(
          event.relatedTarget instanceof Node &&
          active.contains(event.relatedTarget)
        )
      )
        hide()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide()
    }

    // Dismiss stale labels after an action, navigation, or a button state change.
    const observer = new MutationObserver((records) => {
      if (
        active &&
        (!active.isConnected ||
          active.disabled ||
          active.getAttribute("aria-expanded") === "true" ||
          records.some(
            (record) =>
              record.target === active && record.attributeName === "aria-label",
          ))
      )
        hide()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-expanded", "aria-label"],
    })
    document.addEventListener("pointerover", onPointerOver)
    document.addEventListener("pointerout", onPointerOut)
    document.addEventListener("pointerdown", hide, true)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("scroll", hide, true)
    window.addEventListener("resize", hide)
    window.addEventListener("blur", hide)
    window.visualViewport?.addEventListener("resize", hide)
    window.visualViewport?.addEventListener("scroll", hide)
    return () => {
      hide()
      observer.disconnect()
      document.removeEventListener("pointerover", onPointerOver)
      document.removeEventListener("pointerout", onPointerOut)
      document.removeEventListener("pointerdown", hide, true)
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("scroll", hide, true)
      window.removeEventListener("resize", hide)
      window.removeEventListener("blur", hide)
      window.visualViewport?.removeEventListener("resize", hide)
      window.visualViewport?.removeEventListener("scroll", hide)
    }
  }, [mounted])

  return mounted
    ? createPortal(
        <span
          ref={tooltipRef}
          hidden
          aria-hidden="true"
          className={`${hoverTooltipClass} fixed z-[300] w-max max-w-[min(14rem,calc(100vw-16px))] break-words`}
        />,
        document.body,
      )
    : null
}
