"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DialogStepProgress } from "@/components/ui/dialog-step-progress"
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { PlanEditor, emptyPlan } from "../components/plan-editor"
import type { ProjectWorkPlan } from "../api/project-workspace-api"
import {
  createProjectWorkspaces,
  listApprovedProjectBookings,
  listProjectWorkspaceTemplates,
  notifyProjectWorkspaceListChanged,
  type ProjectWorkspaceBooking,
  type ProjectWorkspaceTemplate,
} from "../api/project-workspace-api"
import { errorMessage } from "@/lib/error-message"

const steps = [
  {
    label: "Bookings",
    description: "Choose the client-approved bookings for this workspace.",
  },
  {
    label: "Structure",
    description: "Decide whether the bookings should be separate or combined.",
  },
  {
    label: "Templates",
    description: "Choose a delivery plan for each selected service.",
  },
  {
    label: "Review",
    description: "Check the bookings and plans before creating the workspace.",
  },
] as const

export function NewWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const router = useRouter()
  const [bookings, setBookings] = useState<ProjectWorkspaceBooking[]>([])
  const [templates, setTemplates] = useState<ProjectWorkspaceTemplate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [customPlans, setCustomPlans] = useState<
    Record<string, ProjectWorkPlan>
  >({})
  const [structure, setStructure] = useState<"SEPARATE" | "MULTI_WORKSTREAM">(
    "SEPARATE",
  )
  const [name, setName] = useState("")
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    Promise.all([
      listApprovedProjectBookings(controller.signal),
      listProjectWorkspaceTemplates(controller.signal),
    ])
      .then(([rows, catalog]) => {
        if (!controller.signal.aborted) {
          setBookings(rows)
          setTemplates(catalog)
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(errorMessage(reason, "Couldn't load bookings"))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [open])

  function resetWizard() {
    setBookings([])
    setTemplates([])
    setStep(0)
    setSelected([])
    setKeys({})
    setCustomPlans({})
    setStructure("SEPARATE")
    setName("")
    setError("")
    setLoading(true)
  }

  const selectedBookings = useMemo(
    () => bookings.filter(({ requestId }) => selected.includes(requestId)),
    [bookings, selected],
  )
  const selectedClientId = selectedBookings[0]?.client.id
  const allTemplatesSelected = selected.every((id) => Boolean(keys[id]))

  function validateStep(index: number) {
    if (index === 0 && !selected.length)
      return "Choose at least one approved booking to continue."
    if (index === 1 && structure === "MULTI_WORKSTREAM") {
      if (name.trim().length < 2)
        return "Enter a project name with at least 2 characters."
    }
    if (index === 2) {
      for (const booking of selectedBookings) {
        if (!keys[booking.requestId])
          return `Choose a template for ${booking.serviceName}.`
        if (keys[booking.requestId] === "blank-custom") {
          const plan = customPlans[booking.requestId]
          if (!plan?.phases.length)
            return `Add a phase to the custom plan for ${booking.serviceName}.`
          for (const phase of plan.phases) {
            if (!phase.title.trim())
              return `Name every phase in the custom plan for ${booking.serviceName}.`
            if (phase.tasks.some((task) => !task.title.trim()))
              return `Finish or remove every blank task in ${booking.serviceName}.`
          }
        }
      }
      if (!allTemplatesSelected)
        return "Choose a delivery plan for every selected booking."
    }
    return ""
  }

  async function create() {
    if (busy) return
    for (let index = 0; index < steps.length - 1; index++) {
      const validationError = validateStep(index)
      if (validationError) {
        setStep(index)
        setError(validationError)
        return
      }
    }
    setBusy(true)
    setError("")
    try {
      const result = await createProjectWorkspaces({
        requestIds: selected,
        structure,
        name: name.trim(),
        templateKeys: keys,
        customPlans,
      })
      notifyProjectWorkspaceListChanged()
      onCreated()
      resetWizard()
      onOpenChange(false)
      router.push(`/project-workspace/${result.workspaces[0].id}`)
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't create workspace"))
    } finally {
      setBusy(false)
    }
  }

  function next() {
    if (busy) return
    const validationError = validateStep(step)
    if (validationError) {
      setError(validationError)
      return
    }
    setError("")
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  function back() {
    if (busy) return
    setError("")
    setStep((current) => Math.max(current - 1, 0))
  }

  function close() {
    if (busy) return
    resetWizard()
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      busy={busy}
      closeOnEscape={false}
      size="xl"
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader
        title="Start project from approved booking"
        description={steps[step].description}
        closeLabel="Close dialog"
        closeDisabled={busy}
      />

      <DialogStepProgress
        steps={steps}
        currentStep={step}
        label="Project setup progress"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-[#738096]">
            Loading approved bookings…
          </p>
        ) : error && !bookings.length ? (
          <Alert as="div" className="p-4 text-sm">
            {error}
          </Alert>
        ) : step === 0 ? (
          <BookingStep
            bookings={bookings}
            selected={selected}
            selectedClientId={selectedClientId}
            onSelectionChange={setSelected}
          />
        ) : step === 1 ? (
          <StructureStep
            structure={structure}
            name={name}
            onStructureChange={setStructure}
            onNameChange={setName}
          />
        ) : step === 2 ? (
          <TemplateStep
            bookings={selectedBookings}
            templates={templates}
            keys={keys}
            customPlans={customPlans}
            disabled={busy}
            onTemplateChange={(requestId, key) => {
              if (key === "blank-custom" && !customPlans[requestId])
                setCustomPlans((current) => ({
                  ...current,
                  [requestId]: emptyPlan(),
                }))
              setKeys((current) => ({ ...current, [requestId]: key }))
            }}
            onCustomPlanChange={(requestId, plan) =>
              setCustomPlans((current) => ({ ...current, [requestId]: plan }))
            }
          />
        ) : (
          <ReviewStep
            bookings={selectedBookings}
            structure={structure}
            projectName={name}
            templates={templates}
            keys={keys}
            customPlans={customPlans}
          />
        )}
        {error && bookings.length > 0 && (
          <Alert variant="text" className="mt-4">
            {error}
          </Alert>
        )}
      </div>

      <ModalFooter className="items-center justify-between gap-3">
        <div>
          {step > 0 && (
            <Button
              type="button"
              variant="brandOutline"
              disabled={busy}
              onClick={back}
              className="min-h-9 gap-1 text-xs"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back
            </Button>
          )}
        </div>
        <Button
          type="button"
          disabled={busy || loading || (step === 0 && !bookings.length)}
          variant="brand"
          onClick={() => (step < steps.length - 1 ? next() : void create())}
          className="min-h-9 gap-1 text-xs"
        >
          {busy
            ? "Creating…"
            : step === steps.length - 1
              ? "Create workspace"
              : step === steps.length - 2
                ? "Review"
                : "Continue"}
          {step < steps.length - 1 && (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function BookingStep({
  bookings,
  selected,
  selectedClientId,
  onSelectionChange,
}: {
  bookings: ProjectWorkspaceBooking[]
  selected: string[]
  selectedClientId?: string
  onSelectionChange: (ids: string[]) => void
}) {
  if (!bookings.length)
    return (
      <section className="py-10 text-center">
        <h2 className="m-0 text-sm font-semibold text-[#263750]">
          No bookings ready for setup
        </h2>
        <p className="mt-2 mb-0 text-xs text-[#738096]">
          A client must formally accept the quotation before a project can be
          created.
        </p>
      </section>
    )

  return (
    <section aria-labelledby="booking-step-title">
      <div className="mb-4">
        <h2
          id="booking-step-title"
          className="m-0 text-sm font-semibold text-[#17243b]"
        >
          Choose approved bookings
        </h2>
        <p className="mt-1 mb-0 text-xs text-[#738096]">
          Select one or more bookings for the same client, up to eight.
        </p>
      </div>
      <div className="grid gap-2">
        {bookings.map((booking) => {
          const checked = selected.includes(booking.requestId)
          const differentClient =
            Boolean(selectedClientId) && booking.client.id !== selectedClientId
          const atLimit = selected.length >= 8 && !checked
          return (
            <label
              key={booking.requestId}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3.5 text-xs transition-colors ${checked ? "border-[#294c96] bg-[#294c96] text-white" : "border-[#dfe4ec] bg-background hover:border-[#aebcce]"} ${differentClient || atLimit ? "cursor-not-allowed opacity-45" : ""}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[#294c96]"
                checked={checked}
                disabled={!checked && (differentClient || atLimit)}
                onChange={(event) =>
                  onSelectionChange(
                    event.target.checked
                      ? [...selected, booking.requestId]
                      : selected.filter((id) => id !== booking.requestId),
                  )
                }
              />
              <span className="min-w-0">
                <strong
                  className={`block text-[13px] ${checked ? "text-white" : "text-[#17243b]"}`}
                >
                  {booking.name}
                </strong>
                <span
                  className={`mt-1 block leading-5 ${checked ? "text-white/80" : "text-[#738096]"}`}
                >
                  {booking.serviceName} · {booking.client.fullName || "Client"}
                  {booking.referenceNumber
                    ? ` · ${booking.referenceNumber}`
                    : ""}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

function StructureStep({
  structure,
  name,
  onStructureChange,
  onNameChange,
}: {
  structure: "SEPARATE" | "MULTI_WORKSTREAM"
  name: string
  onStructureChange: (value: "SEPARATE" | "MULTI_WORKSTREAM") => void
  onNameChange: (value: string) => void
}) {
  return (
    <section aria-labelledby="structure-step-title">
      <div className="mb-4">
        <h2
          id="structure-step-title"
          className="m-0 text-sm font-semibold text-[#17243b]"
        >
          Choose the project structure
        </h2>
        <p className="mt-1 mb-0 text-xs text-[#738096]">
          Decide whether each booking gets a workspace of its own.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(["SEPARATE", "MULTI_WORKSTREAM"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={structure === value}
            onClick={() => onStructureChange(value)}
            className={`min-h-28 rounded-xl border p-5 text-left transition-colors ${structure === value ? "border-[#294c96] bg-[#294c96] text-white shadow-[0_0_0_1px_#294c96]" : "border-[#dfe4ec] bg-background hover:border-[#aebcce]"}`}
          >
            <strong className="block text-sm">
              {value === "SEPARATE"
                ? "Separate projects"
                : "One project, multiple services"}
            </strong>
            <span
              className={`mt-2 block text-xs leading-5 ${structure === value ? "text-white/85" : "text-[#738096]"}`}
            >
              {value === "SEPARATE"
                ? "Create one workspace and plan for each selected booking."
                : "Combine the related services under one project and name it here."}
            </span>
          </button>
        ))}
      </div>
      {structure === "MULTI_WORKSTREAM" && (
        <label className="mt-5 block max-w-lg text-xs font-medium">
          Project name
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            minLength={2}
            maxLength={120}
            placeholder="e.g. Summer campaign"
            className="mt-1.5 text-sm"
          />
        </label>
      )}
    </section>
  )
}

function TemplateStep({
  bookings,
  templates,
  keys,
  customPlans,
  disabled,
  onTemplateChange,
  onCustomPlanChange,
}: {
  bookings: ProjectWorkspaceBooking[]
  templates: ProjectWorkspaceTemplate[]
  keys: Record<string, string>
  customPlans: Record<string, ProjectWorkPlan>
  disabled: boolean
  onTemplateChange: (requestId: string, key: string) => void
  onCustomPlanChange: (requestId: string, plan: ProjectWorkPlan) => void
}) {
  return (
    <section aria-labelledby="template-step-title">
      <div className="mb-5">
        <h2
          id="template-step-title"
          className="m-0 text-sm font-semibold text-[#17243b]"
        >
          Pick a delivery plan for each service
        </h2>
        <p className="mt-1 mb-0 text-xs text-[#738096]">
          You can use a starter plan or build a custom one from scratch.
        </p>
      </div>
      <div className="space-y-7">
        {bookings.map((booking) => (
          <section key={booking.requestId}>
            <h3 className="mb-3 text-xs font-semibold text-[#263750]">
              {booking.serviceName}
              <span className="ml-2 font-normal text-[#738096]">
                · {booking.name}
              </span>
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              {templates.map((template) => {
                const active = keys[booking.requestId] === template.key
                return (
                  <button
                    key={template.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onTemplateChange(booking.requestId, template.key)
                    }
                    className={`min-h-32 rounded-xl border p-4 text-left transition-colors ${active ? "border-[#294c96] bg-[#294c96] text-white shadow-[0_0_0_1px_#294c96]" : "border-[#dfe4ec] bg-background hover:border-[#aebcce]"}`}
                  >
                    <strong className="block text-xs">{template.name}</strong>
                    <span
                      className={`mt-2 block text-[11px] leading-5 ${active ? "text-white/85" : "text-[#738096]"}`}
                    >
                      {template.description}
                    </span>
                    <span
                      className={`mt-3 block text-[10px] ${active ? "text-white/75" : "text-[#536b91]"}`}
                    >
                      {template.type} · {template.phases.length} phases
                    </span>
                  </button>
                )
              })}
            </div>
            {keys[booking.requestId] === "blank-custom" &&
              customPlans[booking.requestId] && (
                <div className="mt-4 rounded-xl border border-[#dfe4ec] p-4">
                  <h4 className="mb-3 text-xs font-semibold text-[#263750]">
                    Build your custom plan
                  </h4>
                  <PlanEditor
                    plan={customPlans[booking.requestId]}
                    onChange={(plan) =>
                      onCustomPlanChange(booking.requestId, plan)
                    }
                    disabled={disabled}
                  />
                </div>
              )}
          </section>
        ))}
      </div>
    </section>
  )
}

function ReviewStep({
  bookings,
  structure,
  projectName,
  templates,
  keys,
  customPlans,
}: {
  bookings: ProjectWorkspaceBooking[]
  structure: "SEPARATE" | "MULTI_WORKSTREAM"
  projectName: string
  templates: ProjectWorkspaceTemplate[]
  keys: Record<string, string>
  customPlans: Record<string, ProjectWorkPlan>
}) {
  return (
    <section aria-labelledby="review-step-title">
      <div className="mb-5">
        <h2
          id="review-step-title"
          className="m-0 text-sm font-semibold text-[#17243b]"
        >
          Review project setup
        </h2>
        <p className="mt-1 mb-0 text-xs text-[#738096]">
          Confirm the bookings and plans before creating the workspace.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[#dfe4ec] p-4">
          <h3 className="m-0 text-xs font-semibold text-[#263750]">
            Structure
          </h3>
          <p className="mt-2 mb-0 text-xs text-[#516681]">
            {structure === "SEPARATE"
              ? `${bookings.length} separate ${bookings.length === 1 ? "project" : "projects"}`
              : `One project · ${projectName.trim()}`}
          </p>
        </section>
        <section className="rounded-xl border border-[#dfe4ec] p-4">
          <h3 className="m-0 text-xs font-semibold text-[#263750]">Client</h3>
          <p className="mt-2 mb-0 text-xs text-[#516681]">
            {bookings[0]?.client.fullName || "Client"}
          </p>
        </section>
      </div>
      <div className="mt-4 divide-y divide-[#e9edf1] rounded-xl border border-[#dfe4ec]">
        {bookings.map((booking) => {
          const template = templates.find(
            ({ key }) => key === keys[booking.requestId],
          )
          const plan = customPlans[booking.requestId]
          const tasks = plan?.phases.reduce(
            (total, phase) => total + phase.tasks.length,
            0,
          )
          return (
            <article
              key={booking.requestId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <h3 className="m-0 text-xs font-semibold text-[#263750]">
                  {structure === "SEPARATE"
                    ? booking.name
                    : booking.serviceName}
                </h3>
                <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                  {booking.serviceName} · {booking.client.fullName || "Client"}
                </p>
              </div>
              <div className="text-right">
                <p className="m-0 text-xs font-medium text-[#263750]">
                  {template?.name || "Custom plan"}
                </p>
                <p className="mt-1 mb-0 text-[10px] text-[#738096]">
                  {plan
                    ? `${plan.phases.length} phases · ${tasks} tasks`
                    : `${template?.phases.length ?? 0} phases`}
                </p>
              </div>
            </article>
          )
        })}
      </div>
      <p className="mt-4 mb-0 text-[11px] leading-5 text-[#738096]">
        Templates suggest roles, not people. You can assign staff after the
        workspace is created.
      </p>
    </section>
  )
}
