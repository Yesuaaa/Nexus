import { useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Pill } from "@/components/ui/pill"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Department } from "@/features/departments/api/departments-api"
import { cn } from "@/lib/utils"
import { createService, updateService, type Service } from "../api/services-api"

const fieldClass = "grid min-w-0 gap-1.5"
const labelClass = "text-xs font-semibold"
const inputClass = `w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm text-foreground placeholder:text-[#9aa8bb] ${focusRing}`
const buttonClass = `inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-transparent px-[15px] text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusRing}`

export function ServiceFormDialog({
  service,
  departments,
  onClose,
  onSaved,
}: {
  service: Service | null
  departments: Department[]
  onClose: () => void
  onSaved: (service: Service) => void
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [name, setName] = useState(service?.name ?? "")
  const [description, setDescription] = useState(service?.description ?? "")
  const [departmentIds, setDepartmentIds] = useState(
    service?.departments.map((department) => department.id) ?? [],
  )
  const [isActive, setIsActive] = useState(service?.isActive ?? true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const isEditing = Boolean(service)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    const cleanName = name.trim()
    const cleanDescription = description.trim()
    if (cleanName.length < 2) {
      setError("Service name must contain at least 2 characters")
      return
    }
    if (cleanDescription.length < 2) {
      setError("Please enter a brief service description")
      return
    }
    if (departmentIds.length === 0) {
      setError("Please select at least one responsible department")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const input = {
        name: cleanName,
        description: cleanDescription,
        departmentIds,
        isActive,
      }
      const saved = service
        ? await updateService(service.id, input)
        : await createService(input)
      onSaved(saved)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't save the service. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[110] bg-[rgb(13_28_57_/_48%)]"
        className="z-[110] max-h-[calc(100dvh-28px)] w-[min(500px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
              {isEditing ? "Edit Service" : "Create Service"}
            </DialogTitle>
            <DialogDescription className="mt-2 mb-0 text-xs leading-relaxed text-[#738096]">
              {isEditing
                ? "Update the service details and responsible departments."
                : "Add a service and assign the departments responsible for it."}
            </DialogDescription>
          </div>
          <button
            type="button"
            className={cn(
              "grid size-7 flex-none cursor-pointer place-items-center rounded-[7px] border-0 bg-background text-[#65718a] hover:enabled:bg-[#f1f5fc] disabled:cursor-not-allowed disabled:opacity-50",
              focusRing,
            )}
            onClick={onClose}
            aria-label="Close dialog"
            disabled={submitting}
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={submitting}
            className="m-0 grid min-w-0 gap-4 border-0 p-5 disabled:opacity-60"
          >
            {error && (
              <p
                className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="service-name">
                Service Name <strong className="text-[#d04b56]">*</strong>
              </label>
              <input
                id="service-name"
                className={cn(inputClass, "h-10")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter service name"
                minLength={2}
                maxLength={100}
                required
                autoFocus
              />
            </div>
            <div className={fieldClass}>
              <div className="flex items-center justify-between gap-3">
                <label className={labelClass} htmlFor="service-description">
                  Description <strong className="text-[#d04b56]">*</strong>
                </label>
                <span className="text-[10px] text-[#8290a5] tabular-nums">
                  {description.length}/500
                </span>
              </div>
              <textarea
                id="service-description"
                className={cn(inputClass, "min-h-24 resize-y py-2.5")}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Enter a brief description of the service..."
                minLength={2}
                maxLength={500}
                required
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="service-departments">
                Responsible Departments{" "}
                <strong className="text-[#d04b56]">*</strong>
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="service-departments"
                    type="button"
                    className={cn(
                      inputClass,
                      "flex h-10 cursor-pointer items-center justify-between gap-2 text-left shadow-none",
                    )}
                    aria-label="Select responsible departments"
                  >
                    <span
                      className={cn(
                        "truncate",
                        departmentIds.length === 0 && "text-[#9aa8bb]",
                      )}
                    >
                      {departmentIds.length === 0
                        ? "Select departments"
                        : `${departmentIds.length} department${departmentIds.length === 1 ? "" : "s"} selected`}
                    </span>
                    <ChevronDown
                      size={15}
                      className="flex-none text-[#65718a]"
                      aria-hidden="true"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={4}
                  className="z-[120] w-[var(--radix-dropdown-menu-trigger-width)] border-[#cbd5e1] bg-white shadow-[0_12px_32px_rgb(20_45_97_/_13%)]"
                >
                  {departments.map((department) => (
                    <DropdownMenuCheckboxItem
                      key={department.id}
                      checked={departmentIds.includes(department.id)}
                      onCheckedChange={(checked) =>
                        setDepartmentIds((current) =>
                          checked
                            ? [...current, department.id]
                            : current.filter((id) => id !== department.id),
                        )
                      }
                      onSelect={(event) => event.preventDefault()}
                      className="text-xs"
                    >
                      {department.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {departmentIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-live="polite">
                  {departments
                    .filter((department) =>
                      departmentIds.includes(department.id),
                    )
                    .map((department) => (
                      <Pill key={department.id}>{department.name}</Pill>
                    ))}
                </div>
              )}
              {departments.length === 0 && (
                <p className="m-0 text-[11px] text-[#bc3649]">
                  Create a department before creating a service.
                </p>
              )}
            </div>
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="service-status">
                Status <strong className="text-[#d04b56]">*</strong>
              </label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(value) => setIsActive(value === "active")}
              >
                <SelectTrigger
                  id="service-status"
                  className={cn(inputClass, "h-10 shadow-none")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[120] border-[#cbd5e1] bg-white">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <p className="m-0 text-[10px] text-[#8290a5]">
                {isActive
                  ? "Available for new client requests"
                  : "Unavailable for new client requests"}
              </p>
            </div>
          </fieldset>
          <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4">
            <button
              type="button"
              className={cn(
                buttonClass,
                "border-[#d7e0ee] bg-background text-[#24437e] hover:enabled:bg-[#f1f5fc]",
              )}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={cn(
                buttonClass,
                "bg-[#203f8c] text-white hover:enabled:bg-[#172f70]",
              )}
              disabled={submitting || departments.length === 0}
            >
              {submitting
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Service"}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
