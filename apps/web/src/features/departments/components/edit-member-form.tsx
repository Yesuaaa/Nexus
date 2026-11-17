import { FormInput } from "@/components/ui/form-input"
import { Avatar } from "@/components/ui/avatar"
import type { FormEvent } from "react"
import { CalendarDays, Mail, Phone } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Form } from "@/components/ui/form"
import { pillToneClass } from "@/components/ui/pill"
import { SidePanelButton, SidePanelFooter } from "@/components/ui/side-panel"
import { roleLabels } from "@/features/auth/model/roles"
import {
  employmentStatusLabels,
  employmentStatusTones,
} from "@/features/employees/model/employment"
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
import { panelField, panelSelectTrigger } from "@/components/ui/panel-styles"

const badge =
  "rounded px-1.5 py-px text-[10px] leading-4 font-semibold whitespace-nowrap"

function MemberProfileCard({ member }: { member: DepartmentMember }) {
  const { formatDate } = useDatePreferences()
  const email = member.email || member.user?.email || null
  const name = member.fullName || email || "Employee"
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
        <Avatar
          name={name}
          fallback="E"
          className="-mt-7 size-14 bg-[#203f8c] text-base text-white ring-4 ring-background"
        />
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
          <span
            className={cn(
              badge,
              pillToneClass(employmentStatusTones[member.status]),
            )}
          >
            {employmentStatusLabels[member.status]}
          </span>
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
        {error && <Alert>{error}</Alert>}
        <label className={panelField} htmlFor="mem-pos">
          Job title / position
          <FormInput
            id="mem-pos"
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
      <SidePanelFooter>
        <SidePanelButton
          variant="secondary"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </SidePanelButton>
        <SidePanelButton type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save details"}
        </SidePanelButton>
      </SidePanelFooter>
    </Form>
  )
}
