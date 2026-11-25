import type { ComponentType } from "react"
import Link from "next/link"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { cn } from "@/lib/utils"
import { focusRing } from "./styles"

export type SidebarIcon = ComponentType<{
  className?: string
  strokeWidth?: number
}>

export const sidebarRowClass =
  "flex h-9 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left text-[13px] font-medium whitespace-nowrap text-[#3b4658] no-underline transition-colors duration-150 hover:bg-[#f3f5f8] hover:text-[#182235] motion-reduce:transition-none"
export const sidebarActiveRowClass =
  "bg-[#eef2f9] font-semibold text-[#203f8c] hover:bg-[#eef2f9] hover:text-[#203f8c]"
/** Icon-only square on desktop and a full row in the mobile drawer. */
export const sidebarCollapsedRowClass =
  "size-10 justify-center justify-self-center gap-0 p-0 max-[767px]:h-9 max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-2.5 max-[767px]:px-2.5"

export function SidebarTooltip({ children }: { children: string }) {
  return <HoverTooltip side="right">{children}</HoverTooltip>
}

export function SidebarRowIcon({
  icon: Icon,
  active,
}: {
  icon: SidebarIcon
  active: boolean
}) {
  return (
    <Icon
      className={cn(
        "size-[18px] flex-none",
        active ? "text-[#203f8c]" : "text-[#6b778c]",
      )}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  )
}

export function SidebarLink({
  href,
  transitionTypes,
  label,
  icon,
  active = false,
  collapsed,
  onNavigate,
}: {
  href: string
  transitionTypes?: string[]
  label: string
  icon?: SidebarIcon
  active?: boolean
  collapsed: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      transitionTypes={transitionTypes}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative",
        sidebarRowClass,
        focusRing,
        collapsed && sidebarCollapsedRowClass,
        active && sidebarActiveRowClass,
      )}
      onClick={onNavigate}
    >
      {icon && <SidebarRowIcon icon={icon} active={active} />}
      <span
        className={cn(
          "min-w-0 truncate",
          collapsed && "sr-only max-[767px]:not-sr-only",
        )}
      >
        {label}
      </span>
      {collapsed && <SidebarTooltip>{label}</SidebarTooltip>}
    </Link>
  )
}
