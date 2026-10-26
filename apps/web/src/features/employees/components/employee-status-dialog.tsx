import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
import { cn } from "@/lib/utils"
import {
  updateEmployee,
  type Employee,
  type EmploymentStatus,
} from "../api/employees-api"

const statusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
}

export function EmployeeStatusDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<EmploymentStatus>(employee.status)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (pending || status === employee.status) return
    setPending(true)
    setError("")
    try {
      await updateEmployee(employee.id, { status })
      onSaved()
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't change the employee status.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(13_28_57_/_48%)]"
        className="w-[min(440px,calc(100vw-28px))] gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <header className="p-5">
          <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
            Change employee status
          </DialogTitle>
          <DialogDescription className="mt-2 mb-0 text-xs leading-relaxed text-[#738096]">
            Choose the employment status for {employee.fullName}. This does not
            change their account access.
          </DialogDescription>
        </header>
        <div className="grid gap-3 px-5 pb-5">
          <label
            className="grid gap-1.5 text-xs font-semibold"
            htmlFor="employee-status-select"
          >
            Status
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as EmploymentStatus)}
              disabled={pending}
            >
              <SelectTrigger
                id="employee-status-select"
                className="h-10 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {error && (
            <p
              className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4">
          <Button
            variant="outline"
            type="button"
            className={cn(
              "h-auto min-h-[38px] cursor-pointer rounded-[9px] border-[#d7e0ee] bg-background px-[15px] text-xs font-semibold text-[#24437e] shadow-none transition-colors hover:enabled:bg-[#f1f5fc]",
            )}
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(
              "h-auto min-h-[38px] cursor-pointer rounded-[9px] border border-transparent bg-[#203f8c] px-[15px] text-xs font-semibold text-white shadow-none transition-colors hover:enabled:bg-[#172f70]",
            )}
            disabled={pending || status === employee.status}
            onClick={() => void submit()}
          >
            {pending ? "Saving…" : "Confirm status"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
