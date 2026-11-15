"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkspaceModule } from "../../dashboard/model/workspace-modules"
import { ModuleCard } from "./module-card"

export function ModuleCarousel({ modules }: { modules: WorkspaceModule[] }) {
  const [selectedIndex, setSelectedIndex] = useState(
    Math.floor((modules.length - 1) / 2),
  )
  const touchStart = useRef<number | null>(null)
  const swiped = useRef(false)
  const moduleCount = modules.length
  const activeIndex = Math.min(selectedIndex, moduleCount - 1)
  const previewCount = 3

  function move(direction: number) {
    if (moduleCount > 1)
      setSelectedIndex((current) =>
        Math.max(0, Math.min(moduleCount - 1, current + direction)),
      )
  }

  return (
    <section
      aria-label="Available workspaces"
      aria-roledescription="carousel"
      className="relative mx-auto min-h-[400px] w-full max-w-[1616px] flex-1 overflow-clip"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault()
          move(event.key === "ArrowLeft" ? -1 : 1)
        }
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null
        swiped.current = false
      }}
      onTouchEnd={(event) => {
        const end = event.changedTouches[0]?.clientX
        if (touchStart.current !== null && end !== undefined) {
          const distance = touchStart.current - end
          if (Math.abs(distance) > 40) {
            swiped.current = true
            move(distance > 0 ? 1 : -1)
          }
        }
        touchStart.current = null
      }}
      onClickCapture={(event) => {
        if (swiped.current) {
          event.preventDefault()
          event.stopPropagation()
          swiped.current = false
        }
      }}
    >
      {/* Clipping must not create a scroll container: focusing a distant card
          would otherwise scroll the track independently of activeIndex. */}
      <div className="absolute inset-y-0 inset-x-14 overflow-clip [container-type:inline-size]">
        {modules.map((module, position) => {
          const offset = position - activeIndex
          const distance = Math.abs(offset)

          return (
            <div
              key={`${module.id}-${position}`}
              className="absolute top-1/2 w-[min(280px,100cqw)] transition-[left,transform] duration-500 ease-out motion-reduce:transition-none"
              style={{
                left: `calc(50% + ${offset} * (min(280px, 100cqw) + 20px))`,
                transform: "translate(-50%, -50%)",
                zIndex: previewCount + 1 - distance,
              }}
              onFocusCapture={(event) => {
                // Keep pointer targets stationary between pointer-down and click.
                if (
                  event.target instanceof HTMLElement &&
                  event.target.matches(":focus-visible")
                )
                  setSelectedIndex(position)
              }}
            >
              <ModuleCard module={module} />
            </div>
          )
        })}
      </div>
      {[
        { direction: -1, label: "Previous module", Icon: ChevronLeft },
        { direction: 1, label: "Next module", Icon: ChevronRight },
      ].map(({ direction, label, Icon }) => (
        <Button
          key={label}
          type="button"
          variant="brandOutline"
          size="sm"
          aria-label={label}
          disabled={
            direction < 0 ? activeIndex === 0 : activeIndex === moduleCount - 1
          }
          onClick={() => move(direction)}
          className="absolute z-50 size-11 -translate-y-1/2 rounded-full !border-0 p-0 text-[#294c96] hover:!border-0 disabled:opacity-0"
          style={{
            // Exclude half of the title's 16px gap + 65px height.
            top: "calc(50% - 40.5px)",
            [direction < 0 ? "left" : "right"]: 0,
          }}
        >
          <Icon className="size-5" />
        </Button>
      ))}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {modules[activeIndex]?.title}, module {activeIndex + 1} of{" "}
        {modules.length}
      </span>
    </section>
  )
}
