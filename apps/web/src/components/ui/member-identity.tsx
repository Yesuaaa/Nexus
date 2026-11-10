import { HoverTooltip } from "@/components/ui/hover-tooltip"

export type MemberIdentityData = {
  fullName: string | null
  email?: string | null
  user?: { fullName: string | null; email: string } | null
}

export function MemberIdentity({
  member,
  secondaryText,
}: {
  member: MemberIdentityData
  secondaryText?: string | null
}) {
  const email = member.email || member.user?.email || null
  const name = member.fullName || email || "Employee"
  const secondary =
    secondaryText === undefined ? email || "No account linked" : secondaryText

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="grid size-8 flex-none place-items-center rounded-full bg-[#eef0f3] text-xs font-medium text-[#65718a]"
        aria-hidden="true"
      >
        {(name[0] || "E").toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="m-0 truncate text-xs font-medium">
          {name}
          <HoverTooltip>{name}</HoverTooltip>
        </p>
        {secondary && (
          <p className="mt-0.5 mb-0 truncate text-[11px] leading-[1.5] text-[#738096]">
            {secondary}
            <HoverTooltip>{secondary}</HoverTooltip>
          </p>
        )}
      </div>
    </div>
  )
}
