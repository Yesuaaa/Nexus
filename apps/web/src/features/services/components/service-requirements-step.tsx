"use client"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
} from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import type { Service } from "../api/services-api"
import {
  projectRequirementsLimits,
  validateProjectRequirements,
  type ProjectRequirementsDraft,
} from "../model/project-requirements"
import type { ServicePricingOption } from "../model/service-pricing"

const fields: {
  name: keyof ProjectRequirementsDraft
  label: string
  hint: string
  placeholder: string
  required: boolean
  rows?: number
}[] = [
  {
    name: "goals",
    label: "Project goals",
    hint: "What would you like to achieve? Tell us what success looks like for your business.",
    placeholder:
      "e.g. Increase brand awareness and generate more qualified leads.",
    required: true,
    rows: 4,
  },
  {
    name: "requirements",
    label: "Project requirements",
    hint: "Describe the deliverables, features, scope, or support you need.",
    placeholder:
      "e.g. A monthly content calendar, 12 social posts, and performance reporting.",
    required: true,
    rows: 5,
  },
  {
    name: "expectedTimeline",
    label: "Expected timeline",
    hint: "Include a target start date, deadline, or duration. If you are flexible, let us know.",
    placeholder:
      "e.g. Launch within 6 weeks, or flexible based on your recommendation.",
    required: true,
  },
  {
    name: "additionalDetails",
    label: "Additional details",
    hint: "Share your audience, brand guidelines, reference links, or anything else we should know.",
    placeholder:
      "Add relevant background, preferences, constraints, or links here.",
    required: false,
    rows: 4,
  },
]

export function ServiceRequirementsStep({
  service,
  selectedPackage,
  value,
  saved,
  onChange,
  onSave,
  onContinue,
  onBack,
}: {
  service: Service
  selectedPackage: ServicePricingOption
  value: ProjectRequirementsDraft
  saved: boolean
  onChange: (draft: ProjectRequirementsDraft) => void
  onSave: () => void
  onContinue: () => void
  onBack: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateProjectRequirements(value) : {}

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    const validationErrors = validateProjectRequirements(value)
    const firstInvalidField = Object.keys(validationErrors)[0]
    if (firstInvalidField) {
      const field = event.currentTarget.elements.namedItem(firstInvalidField)
      if (field instanceof HTMLElement) field.focus()
      return
    }
    onSave()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    if (
      submitter instanceof HTMLButtonElement &&
      submitter.value === "continue"
    )
      onContinue()
  }

  return (
    <section className="mt-5" aria-labelledby="project-requirements-heading">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "mb-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold text-[#294c96] hover:bg-[#eef3ff]",
          focusRing,
        )}
      >
        <ArrowLeft size={17} aria-hidden="true" /> Back to packages
      </button>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6 max-[1000px]:grid-cols-1">
        <form
          noValidate
          onSubmit={handleSubmit}
          className="min-w-0 rounded-2xl border border-[#dce3ee] bg-white p-6 max-[560px]:p-5"
        >
          <h2
            ref={headingRef}
            id="project-requirements-heading"
            tabIndex={-1}
            className="m-0 rounded text-lg font-bold tracking-[-0.025em] text-[#101d35] outline-none"
          >
            Tell us about your project
          </h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-[#587095]">
            Help us understand what you need so we can shape the right solution.
            Fields marked with an asterisk are required.
          </p>

          <div className="grid gap-6">
            {fields.map((field) => {
              const id = `project-${field.name}`
              const error = errors[field.name]
              const inputProps = {
                id,
                name: field.name,
                value: value[field.name],
                required: field.required,
                maxLength: projectRequirementsLimits[field.name],
                placeholder: field.placeholder,
                "aria-invalid": error ? true : undefined,
                "aria-describedby": `${id}-hint${error ? ` ${id}-error` : ""}`,
                onChange: (
                  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                ) => onChange({ ...value, [field.name]: event.target.value }),
                className: cn(
                  "w-full rounded-xl border bg-white px-3.5 py-3 text-sm leading-6 text-[#17233a] placeholder:text-[#8da0bd]",
                  error ? "border-[#b4234d]" : "border-[#dce3ee]",
                  focusRing,
                ),
              }
              return (
                <div key={field.name} className="min-w-0">
                  <label
                    htmlFor={id}
                    className="text-sm font-semibold text-[#243c69]"
                  >
                    {field.label}{" "}
                    {field.required ? (
                      <span aria-hidden="true" className="text-[#b4234d]">
                        *
                      </span>
                    ) : (
                      <span className="text-xs font-normal text-[#738096]">
                        (optional)
                      </span>
                    )}
                  </label>
                  <p
                    id={`${id}-hint`}
                    className="mt-1 mb-2 text-xs leading-5 text-[#687e9e]"
                  >
                    {field.hint}
                  </p>
                  {field.rows ? (
                    <textarea
                      {...inputProps}
                      rows={field.rows}
                      className={cn(inputProps.className, "block resize-y")}
                    />
                  ) : (
                    <input {...inputProps} type="text" />
                  )}
                  <div className="mt-1.5 flex items-start justify-between gap-3">
                    {error && (
                      <p
                        id={`${id}-error`}
                        role="alert"
                        className="m-0 text-xs leading-5 text-[#b4234d]"
                      >
                        {error}
                      </p>
                    )}
                    <span
                      className="ml-auto shrink-0 text-[10px] leading-5 text-[#738096]"
                      aria-hidden="true"
                    >
                      {value[field.name].length.toLocaleString("en")} /{" "}
                      {projectRequirementsLimits[field.name].toLocaleString(
                        "en",
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e8edf5] pt-5">
            <p className="m-0 max-w-[360px] text-xs leading-5 text-[#687e9e]">
              Your details stay in this draft while you move between steps.
            </p>
            <div className="flex flex-wrap gap-3 max-[560px]:w-full">
              <button
                type="submit"
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#dce3ee] bg-white px-5 text-sm font-bold text-[#294c96] transition-colors hover:bg-[#eef3ff] motion-reduce:transition-none max-[560px]:w-full",
                  focusRing,
                )}
              >
                Save requirements
              </button>
              <button
                type="submit"
                name="intent"
                value="continue"
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#294c96] px-5 text-sm font-bold text-white hover:bg-[#203f80] max-[560px]:w-full",
                  focusRing,
                )}
              >
                Continue to preferred specialist{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </footer>
          {saved && (
            <p
              role="status"
              className="mt-4 mb-0 flex items-start gap-2 rounded-xl bg-[#edf7f1] p-3 text-sm leading-5 text-[#19703a]"
            >
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Project requirements saved in this draft.
            </p>
          )}
        </form>

        <aside className="grid min-w-0 gap-4" aria-label="Project context">
          <div className="overflow-hidden rounded-2xl border border-[#dce3ee] bg-white">
            <h3 className="m-0 bg-[#294c96] px-5 py-4 text-sm font-bold text-white">
              Your selection
            </h3>
            <dl className="m-0 grid gap-5 p-5">
              <div>
                <dt className="text-[10px] font-bold tracking-[0.12em] text-[#687e9e] uppercase">
                  Service
                </dt>
                <dd className="mt-1 ml-0 text-sm font-semibold text-[#243c69]">
                  {service.name}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-[0.12em] text-[#687e9e] uppercase">
                  Package
                </dt>
                <dd className="mt-1 ml-0 text-sm font-semibold text-[#243c69]">
                  {selectedPackage.name}
                </dd>
              </div>
              <div className="border-t border-[#e8edf5] pt-4">
                <dt className="text-[10px] font-bold tracking-[0.12em] text-[#687e9e] uppercase">
                  Pricing
                </dt>
                <dd className="mt-1 ml-0 text-lg font-bold text-[#173d8d]">
                  {selectedPackage.price.label === "Starting at" &&
                    "Starting at "}
                  {selectedPackage.price.amount}
                  {selectedPackage.price.suffix && (
                    <span className="mt-1 block text-xs font-medium text-[#587095]">
                      {selectedPackage.price.suffix}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          {service.clientRequirements.length > 0 && (
            <div className="rounded-2xl border border-[#dce3ee] bg-[#f5f8fd] p-5">
              <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-[#243c69]">
                <ClipboardList size={18} aria-hidden="true" /> What we’ll need
              </h3>
              <p className="mt-2 mb-3 text-xs leading-5 text-[#587095]">
                Keep these service requirements in mind when describing your
                project.
              </p>
              <ul className="m-0 list-disc space-y-2 pl-4 text-xs leading-5 text-[#405b80]">
                {service.clientRequirements.map((requirement, index) => (
                  <li key={`${requirement}-${index}`}>{requirement}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
