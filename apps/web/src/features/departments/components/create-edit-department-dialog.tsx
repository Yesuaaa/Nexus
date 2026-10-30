import { useEffect, useRef, useState } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import {
  autoDepartmentColor,
  DepartmentColorPicker,
  getDepartmentColorValue,
  resolveDepartmentColor,
} from "@/components/ui/department-pill"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COMPANY_DEPARTMENT_PRESETS,
  createDepartment,
  listEligibleHeads,
  updateDepartment,
  type Department,
  type EligibleHead,
} from "../api/departments-api"
import type { DepartmentColor } from "../model/department-color"

const fieldClass = "grid min-w-0 gap-1.5"
const labelClass = "text-xs font-semibold"
const inputClass = `w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm text-foreground placeholder:text-[#9aa8bb] ${focusRing}`
const buttonClass = `inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-transparent px-[15px] text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusRing}`

export function CreateEditDepartmentDialog({
  department,
  onClose,
  onSaved,
}: {
  department?: Department | null
  onClose: () => void
  onSaved: () => void
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const isEditing = Boolean(department)
  const [selectedPreset, setSelectedPreset] = useState<string>(
    department
      ? COMPANY_DEPARTMENT_PRESETS.some((p) => p.name === department.name)
        ? department.name
        : "CUSTOM"
      : "",
  )
  const [name, setName] = useState(department?.name ?? "")
  const [code, setCode] = useState(department?.code ?? "")
  const [description, setDescription] = useState(department?.description ?? "")
  const [headId, setHeadId] = useState(department?.headId ?? "")
  const [color, setColor] = useState<DepartmentColor>(
    department ? getDepartmentColorValue(department) : autoDepartmentColor(""),
  )
  // Once the user picks a color manually, stop following the name.
  const [colorTouched, setColorTouched] = useState(isEditing)
  const [eligibleHeads, setEligibleHeads] = useState<EligibleHead[]>([])
  const [loadingHeads, setLoadingHeads] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listEligibleHeads()
      .then(setEligibleHeads)
      .catch(() => {})
      .finally(() => setLoadingHeads(false))
  }, [])

  function syncColor(nextName: string) {
    if (!colorTouched) setColor(autoDepartmentColor(nextName))
  }

  function handlePresetChange(presetName: string) {
    setSelectedPreset(presetName)
    if (!presetName || presetName === "CUSTOM") {
      setName("")
      setCode("")
      setDescription("")
      syncColor("")
      return
    }
    const matched = COMPANY_DEPARTMENT_PRESETS.find(
      (p) => p.name === presetName,
    )
    if (matched) {
      setName(matched.name)
      setCode(matched.code)
      setDescription(matched.description)
      syncColor(matched.name)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) {
      setError("Please enter a department name")
      return
    }

    try {
      setSubmitting(true)
      setError("")
      if (isEditing && department) {
        await updateDepartment(department.id, {
          name: name.trim(),
          color,
          code: code.trim() || null,
          description: description.trim() || null,
          headId: headId || null,
        })
      } else {
        await createDepartment({
          name: name.trim(),
          color,
          code: code.trim() || undefined,
          description: description.trim() || undefined,
          headId: headId || null,
        })
      }
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save department")
    } finally {
      setSubmitting(false)
    }
  }

  const previewColor = resolveDepartmentColor(color, name)

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
        className="z-[110] max-h-[calc(100dvh-28px)] w-[min(440px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
              {isEditing ? "Edit Department" : "Create Department"}
            </DialogTitle>
            <DialogDescription className="mt-2 mb-0 text-xs leading-relaxed text-[#738096]">
              {isEditing
                ? "Update the department details and assigned head."
                : "Add a department and assign its head."}
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
              <p className="m-0 text-xs text-[#bc3649]" role="alert">
                {error}
              </p>
            )}

            {!isEditing && (
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="dept-preset">
                  Company Department Preset
                </label>
                <Select
                  value={selectedPreset}
                  onValueChange={handlePresetChange}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="dept-preset"
                    className={cn(inputClass, "h-10 shadow-none")}
                  >
                    <SelectValue placeholder="Select from Company Departments" />
                  </SelectTrigger>
                  <SelectContent
                    collisionPadding={24}
                    className="z-[120] border-[#cbd5e1] bg-white shadow-[0_12px_32px_rgb(20_45_97_/_13%)]"
                  >
                    {COMPANY_DEPARTMENT_PRESETS.map((preset) => (
                      <SelectItem key={preset.code} value={preset.name}>
                        {preset.name} ({preset.code})
                      </SelectItem>
                    ))}
                    <SelectItem value="CUSTOM">
                      Custom Department Name...
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="dept-name">
                Department Name *
              </label>
              <input
                id="dept-name"
                className={cn(inputClass, "h-10")}
                autoFocus
                placeholder="e.g. Information Technology"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  syncColor(e.target.value)
                  if (selectedPreset !== "CUSTOM") setSelectedPreset("CUSTOM")
                }}
                required
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="dept-code">
                Department Code
              </label>
              <input
                id="dept-code"
                className={cn(inputClass, "h-10")}
                placeholder="e.g. IT, HR, FIN"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </div>

            {/* Color picker: directly below Department Code */}
            <div className={fieldClass}>
              <span className={labelClass}>Department Color</span>
              <DepartmentColorPicker
                value={color}
                onChange={(value) => {
                  setColor(value)
                  setColorTouched(true)
                }}
                disabled={submitting}
              />
              <div className="mt-1 flex items-center gap-2 text-xs text-[#738096]">
                <span>Table preview:</span>
                <Pill className={previewColor.pill}>
                  {name.trim() || "Department"}
                </Pill>
              </div>
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="dept-head">
                Department Head
              </label>
              <Select
                value={headId || "unassigned"}
                onValueChange={(value) =>
                  setHeadId(value === "unassigned" ? "" : value)
                }
                disabled={loadingHeads || submitting}
              >
                <SelectTrigger
                  id="dept-head"
                  className={cn(inputClass, "h-10 shadow-none")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  collisionPadding={24}
                  className="z-[120] border-[#cbd5e1] bg-white shadow-[0_12px_32px_rgb(20_45_97_/_13%)]"
                >
                  <SelectItem value="unassigned">
                    No Department Head Assigned
                  </SelectItem>
                  {eligibleHeads.map((head) => (
                    <SelectItem key={head.id} value={head.id}>
                      {head.fullName || head.email}
                      {head.headOf && head.headOf.id !== department?.id
                        ? ` [Heads ${head.headOf.name}]`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="dept-desc">
                Description
              </label>
              <textarea
                id="dept-desc"
                className={cn(inputClass, "min-h-20 resize-y py-2.5")}
                placeholder="Briefly describe what this department manages..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
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
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : isEditing
                  ? "Update Department"
                  : "Create Department"}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
