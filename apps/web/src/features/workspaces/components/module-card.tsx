"use client"

import Link from "next/link"
import {
  BriefcaseBusiness,
  Clock3,
  FolderKanban,
  ShieldCheck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import { useRadialHoverFill } from "@/components/ui/use-radial-hover-fill"
import { useHoverLabel } from "@/components/ui/use-hover-label"
import type { WorkspaceModule } from "../../dashboard/model/workspace-modules"
import { moduleRegistry } from "../model/module-registry"

const moduleIcons: Record<string, LucideIcon> = {
  services: BriefcaseBusiness,
  projects: FolderKanban,
  people: UsersRound,
  attendance: Clock3,
  administration: ShieldCheck,
  finance: WalletCards,
}

export function ModuleCard({ module }: { module: WorkspaceModule }) {
  const { cardRef, fillRef, contentRef, showFill, hideFill } =
    useRadialHoverFill<HTMLSpanElement>()
  const {
    labelRef,
    show: showHoverLabel,
    restore: restoreHoverLabel,
  } = useHoverLabel(module.title, "Coming Soon")
  const appearance = moduleRegistry[module.id]
  const Icon = moduleIcons[appearance.icon] ?? FolderKanban
  const cardClassName =
    "group flex w-full max-w-[280px] flex-none flex-col text-center no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"

  const cardContent = (
    <>
      <span
        ref={cardRef}
        className="relative flex aspect-square w-full flex-col overflow-hidden rounded-2xl border-0 p-8 text-white max-[560px]:p-6"
        style={{ backgroundColor: appearance.color }}
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
          className="relative z-20 flex h-full min-w-0 items-center justify-center text-white"
        >
          <Icon
            className="size-20 sm:size-24"
            strokeWidth={1.35}
            aria-hidden="true"
          />
        </span>
      </span>
      <h2 className="mt-4 min-h-[65px] min-w-0 text-[clamp(20px,1.7vw,26px)] leading-[1.25] font-bold tracking-[-0.03em] text-[#294c96]">
        <span ref={labelRef}>{module.title}</span>
      </h2>
    </>
  )

  if (module.placeholder) {
    return (
      <div
        aria-label={`${module.title} module coming soon`}
        aria-disabled="true"
        tabIndex={0}
        className={`${cardClassName} cursor-default`}
        onMouseEnter={(event) => {
          showFill(event.clientX, event.clientY)
          showHoverLabel()
        }}
        onMouseLeave={() => {
          hideFill()
          restoreHoverLabel()
        }}
        onFocus={() => {
          showFill()
          showHoverLabel()
        }}
        onBlur={() => {
          hideFill()
          restoreHoverLabel()
        }}
      >
        {cardContent}
      </div>
    )
  }

  return (
    <Link
      href={module.href ?? "/module"}
      aria-label={`Open ${module.title} workspace`}
      className={cardClassName}
      onMouseEnter={(event) => showFill(event.clientX, event.clientY)}
      onMouseLeave={() => {
        hideFill()
        restoreHoverLabel()
      }}
      onFocus={() => showFill()}
      onBlur={() => {
        hideFill()
        restoreHoverLabel()
      }}
    >
      {cardContent}
    </Link>
  )
}
