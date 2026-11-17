"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useRadialHoverFill } from "@/components/ui/use-radial-hover-fill"
import type { WorkspaceModule } from "../../dashboard/model/workspace-modules"

export function ModuleCard({ module }: { module: WorkspaceModule }) {
  const { cardRef, fillRef, contentRef, showFill, hideFill } =
    useRadialHoverFill<HTMLAnchorElement>()

  return (
    <Link
      ref={cardRef}
      href={module.href}
      aria-label={`Open ${module.title} workspace`}
      className="group relative flex min-h-[140px] w-full flex-col overflow-hidden rounded-2xl border-0 bg-[#294c96] p-6 text-white no-underline shadow-[0_8px_24px_rgb(26_58_128_/_10%)] transition-shadow duration-300 hover:shadow-[0_14px_34px_rgb(26_58_128_/_22%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b] motion-reduce:transition-none max-[560px]:min-h-[124px] max-[560px]:p-5"
      onMouseEnter={(event) => showFill(event.clientX, event.clientY)}
      onMouseLeave={hideFill}
      onFocus={() => showFill()}
      onBlur={hideFill}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,transparent_40%,rgb(20_54_129_/_42%))]"
        aria-hidden="true"
      />
      <span
        ref={fillRef}
        className="pointer-events-none absolute z-10 rounded-full bg-white"
        aria-hidden="true"
      />
      <span
        ref={contentRef}
        className="relative z-20 flex h-full min-w-0 items-center justify-between gap-4 text-white"
      >
        <span className="min-w-0">
          <h2 className="min-w-0 text-[clamp(20px,1.7vw,26px)] leading-[1.25] font-bold tracking-[-0.03em]">
            {module.title}
          </h2>
          <span className="mt-2 block text-xs leading-5 opacity-80">
            {module.description}
          </span>
        </span>
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-current bg-[rgb(22_48_105_/_10%)]"
          aria-hidden="true"
        >
          <ArrowRight size={22} strokeWidth={1.8} />
        </span>
      </span>
    </Link>
  )
}
