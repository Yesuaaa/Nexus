import { useEffect, useState } from "react"
import { CloseIcon } from "@/components/layout/icons"
import {
  COMPANY_DEPARTMENT_PRESETS,
  createDepartment,
  listEligibleHeads,
  updateDepartment,
  type Department,
  type EligibleHead,
} from "./api"

export function CreateEditDepartmentDialog({
  department,
  onClose,
  onSaved,
  onDelete,
}: {
  department?: Department | null
  onClose: () => void
  onSaved: () => void
  onDelete?: (id: string, name: string) => void
}) {
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

  function handlePresetChange(presetName: string) {
    setSelectedPreset(presetName)
    if (!presetName) {
      setName("")
      setCode("")
      setDescription("")
      return
    }
    if (presetName === "CUSTOM") {
      setName("")
      setCode("")
      setDescription("")
      return
    }
    const matched = COMPANY_DEPARTMENT_PRESETS.find(
      (p) => p.name === presetName,
    )
    if (matched) {
      setName(matched.name)
      setCode(matched.code)
      setDescription(matched.description)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
          code: code.trim() || null,
          description: description.trim() || null,
          headId: headId || null,
        })
      } else {
        await createDepartment({
          name: name.trim(),
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

  return (
    <div className="dept-modal-backdrop" onClick={onClose}>
      <div
        className="dept-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dept-modal-header">
          <h2 className="dept-modal-title">
            {isEditing ? "Edit Department" : "Create Department"}
          </h2>
          <button
            type="button"
            className="dept-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dept-modal-body">
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                }}
              >
                {error}
              </div>
            )}

            {!isEditing && (
              <div className="dept-field">
                <label className="dept-label" htmlFor="dept-preset">
                  Company Department Preset
                </label>
                <select
                  id="dept-preset"
                  className="dept-select"
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                >
                  <option value="">
                    -- Select from Company Departments --
                  </option>
                  {COMPANY_DEPARTMENT_PRESETS.map((preset) => (
                    <option key={preset.code} value={preset.name}>
                      {preset.name} ({preset.code})
                    </option>
                  ))}
                  <option value="CUSTOM">Custom Department Name...</option>
                </select>
              </div>
            )}

            <div className="dept-field">
              <label className="dept-label" htmlFor="dept-name">
                Department Name *
              </label>
              <input
                id="dept-name"
                className="dept-input"
                placeholder="e.g. Information Technology"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (selectedPreset !== "CUSTOM") setSelectedPreset("CUSTOM")
                }}
                required
              />
            </div>

            <div className="dept-field">
              <label className="dept-label" htmlFor="dept-code">
                Department Code
              </label>
              <input
                id="dept-code"
                className="dept-input"
                placeholder="e.g. IT, HR, FIN"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </div>

            <div className="dept-field">
              <label className="dept-label" htmlFor="dept-head">
                Department Head
              </label>
              <select
                id="dept-head"
                className="dept-select"
                value={headId}
                onChange={(e) => setHeadId(e.target.value)}
                disabled={loadingHeads}
              >
                <option value="">-- No Department Head Assigned --</option>
                {eligibleHeads.map((head) => (
                  <option key={head.id} value={head.id}>
                    {head.fullName || head.email} ({head.role})
                    {head.headOf && head.headOf.id !== department?.id
                      ? ` [Heads ${head.headOf.name}]`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="dept-field">
              <label className="dept-label" htmlFor="dept-desc">
                Description
              </label>
              <textarea
                id="dept-desc"
                className="dept-textarea"
                placeholder="Briefly describe what this department manages..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="dept-modal-footer">
            {isEditing && onDelete && department && (
              <button
                type="button"
                className="dept-btn-danger-icon"
                style={{
                  width: "auto",
                  padding: "8px 12px",
                  marginRight: "auto",
                }}
                onClick={() => {
                  onClose()
                  onDelete(department.id, department.name)
                }}
                disabled={submitting}
              >
                Delete Department
              </button>
            )}
            <button
              type="button"
              className="dept-btn-outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dept-btn-primary"
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : isEditing
                  ? "Update Department"
                  : "Create Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
