import { useRef, type FormEvent } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { DepartmentMember, DepartmentTeam } from "../api/departments-api"
import {
  panelField,
  panelIconButton,
  panelInput,
  panelMuted,
  panelPrimaryButton,
  panelSecondaryButton,
  panelSelectTrigger,
} from "../styles/member-panel-styles"

export function EditMemberDialog({
  member,
  teams,
  position,
  teamId,
  error,
  submitting,
  onPositionChange,
  onTeamChange,
  onClose,
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
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const positionRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(13_28_57_/_48%)]"
        className="max-h-[90dvh] w-[min(420px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          positionRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <form onSubmit={onSubmit}>
          <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5">
            <div className="min-w-0">
              <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
                Edit member details
              </DialogTitle>
              <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
                Update position and team assignment.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className={panelIconButton}
                aria-label="Close member details"
              >
                <CloseIcon width="16" height="16" />
              </button>
            </DialogClose>
          </header>
          <div className="grid gap-4 p-5">
            <div className="min-w-0 rounded-lg border border-[#e8ebef] p-3">
              <p className="m-0 truncate text-xs font-medium">
                {member.fullName || member.email}
              </p>
              <p className={`${panelMuted} mt-1 mb-0 break-all`}>
                {member.email}
              </p>
            </div>
            {error && (
              <p className="m-0 text-xs text-[#bc3649]" role="alert">
                {error}
              </p>
            )}
            <label className={panelField} htmlFor="mem-pos">
              Job title / position
              <Input
                id="mem-pos"
                ref={positionRef}
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
          <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className={panelSecondaryButton}
                disabled={submitting}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className={panelPrimaryButton}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save details"}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
