import type { ReactNode } from "react"
import { getInitials } from "@/lib/initials"

export type MemberIdentityData = {
  fullName: string | null
  email?: string | null
  user?: { fullName: string | null; email: string } | null
}

export function MemberIdentity({
  member,
  secondaryText,
  nameAdornment,
}: {
  member: MemberIdentityData
  secondaryText?: string | null
  /** Small inline element shown after the name, e.g. a "Head" tag. */
  nameAdornment?: ReactNode
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
        {getInitials(name) || "E"}
      </span>
      <div className="min-w-0">
        <p className="m-0 flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <span className="min-w-0 truncate">{name}</span>
          {nameAdornment}
        </p>
        {secondary && (
          <p className="mt-0.5 mb-0 truncate text-[11px] leading-[1.5] text-[#738096]">
            {secondary}
          </p>
        )}
      </div>
    </div>
  )
}
