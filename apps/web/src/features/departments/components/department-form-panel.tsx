import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { formFieldClass } from "@/components/ui/form-control-styles"
import { Form } from "@/components/ui/form"
import { useState } from "react"
import { focusRing } from "@/components/layout/styles"
import {
  autoDepartmentColor,
  DepartmentColorPicker,
  getDepartmentColorValue,
  resolveDepartmentColor,
} from "@/components/ui/department-pill"
import { Pill } from "@/components/ui/pill"
import { RequiredMark } from "@/components/ui/required-mark"
import {
  SidePanel,
  SidePanelAlert,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Skeleton } from "@/components/ui/skeleton"
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
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"

const noHeads: EligibleHead[] = []

const fieldClass = formFieldClass
const labelClass = "text-xs font-semibold"
const inputClass = `w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm text-foreground placeholder:text-[#9aa8bb] ${focusRing}`

export function DepartmentFormPanel({
  department,
  onClose,
  onSaved,
}: {
  department?: Department | null
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useSidePanel(onClose)
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
  const departmentId = department?.id ?? null
  // Scoped to this department (or to unassigned staff when creating), so the
  // picker only offers people the API will accept as head.
  const heads = useAsyncResource<EligibleHead[]>(
    (signal) => listEligibleHeads(departmentId, signal),
    [departmentId],
  )
  const eligibleHeads = heads.data ?? noHeads
  const loadingHeads = heads.loading
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
      panel.close(onSaved)
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save department"))
    } finally {
      setSubmitting(false)
    }
  }

  const previewColor = resolveDepartmentColor(color, name)

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      dismissible={false}
      busy={submitting}
    >
      <SidePanelHeader
        title={isEditing ? "Edit Department" : "Create Department"}
        description={
          isEditing
            ? "Update the department details and assigned head."
            : "Add a department and assign its head."
        }
        closeDisabled={submitting}
      />
      <Form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <SidePanelBody>
          {error && <SidePanelAlert>{error}</SidePanelAlert>}
          <fieldset
            disabled={submitting}
            className="m-0 grid min-w-0 gap-4 border-0 p-0 disabled:opacity-60"
          >
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
                Department Name <RequiredMark />
              </label>
              <FormInput
                id="dept-name"
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
              <FormInput
                id="dept-code"
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
              <FormTextarea
                id="dept-desc"
                placeholder="Briefly describe what this department manages..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </fieldset>
        </SidePanelBody>
        <SidePanelFooter>
          <SidePanelButton
            variant="secondary"
            onClick={() => panel.close()}
            disabled={submitting}
          >
            Cancel
          </SidePanelButton>
          <SidePanelButton type="submit" disabled={submitting}>
            {submitting
              ? "Saving..."
              : isEditing
                ? "Update Department"
                : "Create Department"}
          </SidePanelButton>
        </SidePanelFooter>
      </Form>
    </SidePanel>
  )
}
