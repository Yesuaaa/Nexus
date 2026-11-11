import { Form } from "@/components/ui/form"
import { useEffect, useRef, useState } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import {
  autoDepartmentColor,
  DepartmentColorPicker,
  getDepartmentColorValue,
  resolveDepartmentColor,
} from "@/components/ui/department-pill"
import { EdgeSheetContent } from "@/components/ui/edge-sheet"
import { Pill } from "@/components/ui/pill"
import { Sheet, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
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

export function DepartmentFormPanel({
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
  const { open, closeAfterTransition } = useAnimatedPanelClose(onClose)
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
      closeAfterTransition(onSaved)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save department")
    } finally {
      setSubmitting(false)
    }
  }

  const previewColor = resolveDepartmentColor(color, name)

  return (
    <Sheet open={open}>
      <EdgeSheetContent
        open={open}
        overlayClassName="bg-[rgb(13_28_57_/_18%)]"
        className="overflow-hidden"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
        // Unsaved form: close only through Cancel or the close button.
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              {isEditing ? "Edit Department" : "Create Department"}
            </SheetTitle>
            <SheetDescription className="mt-1 mb-0 text-xs leading-relaxed text-[#738096]">
              {isEditing
                ? "Update the department details and assigned head."
                : "Add a department and assign its head."}
            </SheetDescription>
          </div>
          <button
            type="button"
            className={cn(
              "grid size-8 flex-none cursor-pointer place-items-center rounded-[7px] border-0 bg-background text-[#65718a] hover:enabled:bg-[#f1f5fc] disabled:cursor-not-allowed disabled:opacity-50",
              focusRing,
            )}
            onClick={() => closeAfterTransition()}
            aria-label="Close panel"
            disabled={submitting}
          >
            <CloseIcon />
          </button>
        </header>

        <Form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <fieldset
            disabled={submitting}
            className="m-0 grid min-h-0 min-w-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain border-0 px-6 py-5 disabled:opacity-60 max-[560px]:px-5"
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
              {loadingHeads ? (
                <>
                  <span role="status" className="sr-only">
                    Loading eligible department heads…
                  </span>
                  <Skeleton className="h-10 w-full rounded-lg" />
                </>
              ) : (
                <Select
                  value={headId || "unassigned"}
                  onValueChange={(value) =>
                    setHeadId(value === "unassigned" ? "" : value)
                  }
                  disabled={submitting}
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
              )}
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

          <footer className="flex flex-none justify-end gap-2 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
            <button
              type="button"
              className={cn(
                buttonClass,
                "border-[#d7e0ee] bg-background text-[#24437e] hover:enabled:bg-[#f1f5fc]",
              )}
              onClick={() => closeAfterTransition()}
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
        </Form>
      </EdgeSheetContent>
    </Sheet>
  )
}
