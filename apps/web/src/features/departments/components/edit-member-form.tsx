import type { FormEvent } from "react"
import { CalendarDays, Mail, Phone } from "lucide-react"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DepartmentMember, DepartmentTeam } from "../api/departments-api"
import {
  panelField,
  panelInput,
  panelPrimaryButton,
  panelSecondaryButton,
  panelSelectTrigger,
} from "../styles/member-panel-styles"

const roleLabels = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "Client",
} as const

const statusStyles = {
  ACTIVE: { label: "Active", className: "bg-[#e7f6ee] text-[#1f7a4d]" },
  ON_LEAVE: { label: "On leave", className: "bg-[#fff4e0] text-[#9a5b00]" },
  INACTIVE: { label: "Inactive", className: "bg-[#eef0f3] text-[#5b6577]" },
} as const

const badge =
  "rounded px-1.5 py-px text-[10px] leading-4 font-semibold whitespace-nowrap"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.slice(0, 2) ?? "")
  return letters.toUpperCase() || "E"
}

function MemberProfileCard({ member }: { member: DepartmentMember }) {
  const { formatDate } = useDatePreferences()
  const email = member.email || member.user?.email || null
  const name = member.fullName || email || "Employee"
  const status = statusStyles[member.status]
  const details = [
    { icon: Mail, label: "Email", value: email ?? "No account linked" },
    { icon: Phone, label: "Phone", value: member.contactNumber ?? "Not set" },
    {
      icon: CalendarDays,
      label: "Member since",
      value: formatDate(member.createdAt),
    },
  ]

  return (
    <section
      aria-label={`${name} profile`}
      className="min-w-0 overflow-hidden rounded-xl border border-[#e8ebef]"
    >
      <div
        className="h-14 bg-gradient-to-r from-[#dfe7f6] to-[#f2f5fb]"
        aria-hidden="true"
      />
      <div className="px-4 pb-4">
        <span
          className="-mt-7 grid size-14 place-items-center rounded-full bg-[#203f8c] text-base font-semibold text-white ring-4 ring-background"
          aria-hidden="true"
        >
          {initials(name)}
        </span>
        <h3 className="mt-2 mb-0 truncate text-[15px] font-[650] tracking-[-0.02em]">
          {name}
        </h3>
        <p className="mt-0.5 mb-0 truncate text-xs text-[#738096]">
          {member.position || "No position set"}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={cn(badge, "bg-[#e8eef8] text-[#294a9b]")}>
            {member.user ? roleLabels[member.user.role] : "No account"}
          </span>
          {member.team && (
            <span
              className={cn(
                badge,
                "max-w-full truncate bg-[#e8eef8] text-[#294a9b]",
              )}
            >
              {member.team.name}
            </span>
          )}
          <span className={cn(badge, status.className)}>{status.label}</span>
        </div>
        <dl className="mt-4 mb-0 grid gap-2.5 border-t border-[#eceef1] pt-4">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex min-w-0 items-center gap-2.5">
              <Icon
                size={14}
                className="flex-none text-[#8a9ab1]"
                aria-hidden="true"
              />
              <dt className="sr-only">{label}</dt>
              <dd className="m-0 min-w-0 truncate text-xs text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/** Body of the "Edit member details" screen inside the department panel. */
export function EditMemberForm({
  member,
  teams,
  position,
  teamId,
  error,
  submitting,
  onPositionChange,
  onTeamChange,
  onCancel,
  onSubmit,
}: {
  member: DepartmentMember
  teams: DepartmentTeam[]
  position: string
  teamId: string
  error: string
  submitting: boolean
  onPositionChange: (value: string) => void
  onTeamChange: (value: string) => void
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6 py-5 max-[560px]:px-5">
        <MemberProfileCard member={member} />
        {error && (
          <p
            className="m-0 rounded-lg border border-[#f4d6db] bg-[#fff6f7] p-3 text-xs text-[#bc3649]"
            role="alert"
          >
            {error}
          </p>
        )}
        <label className={panelField} htmlFor="mem-pos">
          Job title / position
          <Input
            id="mem-pos"
            className={panelInput}
            placeholder="e.g. Specialist, Analyst, Coordinator"
            value={position}
            onChange={(event) => onPositionChange(event.target.value)}
            disabled={submitting}
          />
        </label>
        <div className={panelField}>
          <span>Assigned team</span>
          <Select
            value={teamId || "unassigned"}
            onValueChange={(value) =>
              onTeamChange(value === "unassigned" ? "" : value)
            }
            disabled={submitting}
          >
            <SelectTrigger
              aria-label="Assigned team"
              className={panelSelectTrigger}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent collisionPadding={24}>
              <SelectItem value="unassigned">No specific team</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <footer className="flex flex-none justify-end gap-2 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
        <Button
          type="button"
          variant="outline"
          className={panelSecondaryButton}
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className={panelPrimaryButton}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Save details"}
        </Button>
      </footer>
    </Form>
  )
}
