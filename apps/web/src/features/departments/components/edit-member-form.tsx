import type { FormEvent } from "react"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MemberIdentity } from "@/components/ui/member-identity"
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
        <div className="min-w-0 rounded-lg border border-[#e8ebef] p-3">
          <MemberIdentity member={member} />
        </div>
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
