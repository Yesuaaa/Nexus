"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ShieldCheck, UsersRound } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import {
  listServiceSpecialists,
  type Service,
  type ServiceSpecialist,
} from "../api/services-api"
import type { ServicePricingOption } from "../model/service-pricing"

export function ServiceSpecialistStep({
  service,
  selectedPackage,
  timeline,
  value,
  submitting,
  submissionError,
  onChange,
  onSubmit,
  onBack,
}: {
  service: Service
  selectedPackage: ServicePricingOption
  timeline: string
  value: ServiceSpecialist | null
  submitting: boolean
  submissionError: string
  onChange: (specialist: ServiceSpecialist | null) => void
  onSubmit: () => void
  onBack: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [specialists, setSpecialists] = useState<ServiceSpecialist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    let active = true
    listServiceSpecialists(service.id)
      .then((items) => {
        if (active) setSpecialists(items)
      })
      .catch(() => {
        if (active)
          setError(
            "We couldn’t load the specialists. Try again, or let the department assign one.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [service.id, revision])

  const selectionValid =
    value === null ||
    (!loading && !error && specialists.some((item) => item.id === value.id))
  const optionClass =
    "flex cursor-pointer items-start gap-3 rounded-xl border p-5 transition-colors has-[:checked]:border-[#294c96] has-[:checked]:bg-[#eef3ff] motion-reduce:transition-none"

  return (
    <section className="mt-5" aria-labelledby="preferred-specialist-heading">
      <button
        type="button"
        disabled={submitting}
        onClick={onBack}
        className={cn(
          "mb-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold text-[#294c96] hover:bg-[#eef3ff]",
          focusRing,
        )}
      >
        <ArrowLeft size={17} aria-hidden="true" /> Back to project requirements
      </button>
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6 max-[1000px]:grid-cols-1">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (selectionValid && !submitting) onSubmit()
          }}
          className="min-w-0 rounded-2xl border border-[#dce3ee] bg-white p-6 max-[560px]:p-5"
        >
          <h2
            ref={headingRef}
            id="preferred-specialist-heading"
            tabIndex={-1}
            className="m-0 rounded text-lg font-bold tracking-[-0.025em] text-[#101d35] outline-none"
          >
            Who would you like to work with?
          </h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-[#587095]">
            Choose a preferred specialist from this service’s departments, or
            let us find the right person for your project.
          </p>
          <fieldset
            disabled={submitting}
            className="m-0 min-w-0 border-0 p-0"
            aria-describedby="specialist-approval-note"
          >
            <legend className="mb-3 text-sm font-semibold text-[#243c69]">
              Specialist preference (optional)
            </legend>
            <label className={cn(optionClass, "border-[#dce3ee]")}>
              <input
                type="radio"
                name="specialist"
                value="automatic"
                checked={value === null}
                onChange={() => onChange(null)}
                className={cn(
                  "mt-1 size-4 shrink-0 accent-[#294c96]",
                  focusRing,
                )}
              />
              <UsersRound
                size={24}
                className="shrink-0 text-[#294c96]"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#243c69]">
                  Let the department assign a specialist
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#587095]">
                  No preference. The Department Manager will match your project
                  with a suitable staff member.
                </span>
              </span>
            </label>
            {loading ? (
              <p role="status" className="mt-5 text-sm text-[#587095]">
                Loading specialists…
              </p>
            ) : error ? (
              <div className="mt-5 rounded-xl border border-[#efd1d9] p-4">
                <p
                  role="alert"
                  className="m-0 text-sm leading-6 text-[#9b2244]"
                >
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setLoading(true)
                    setRevision((current) => current + 1)
                  }}
                  className={cn(
                    "mt-2 min-h-10 cursor-pointer rounded-lg border border-[#dce3ee] bg-white px-4 text-sm font-semibold text-[#294c96]",
                    focusRing,
                  )}
                >
                  Retry specialists
                </button>
              </div>
            ) : specialists.length === 0 ? (
              <p className="mt-5 rounded-xl bg-[#f5f8fd] p-4 text-sm leading-6 text-[#587095]">
                No specialists are currently listed for this service. The
                Department Manager can assign a suitable staff member after
                reviewing your requirements.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
                {specialists.map((specialist) => (
                  <label
                    key={specialist.id}
                    className={cn(optionClass, "min-w-0 border-[#dce3ee]")}
                  >
                    <input
                      type="radio"
                      name="specialist"
                      value={specialist.id}
                      aria-label={`Prefer ${specialist.fullName}`}
                      checked={value?.id === specialist.id}
                      onChange={() => onChange(specialist)}
                      className={cn(
                        "mt-1 size-4 shrink-0 accent-[#294c96]",
                        focusRing,
                      )}
                    />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block text-sm font-bold text-[#243c69]">
                        {specialist.fullName}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#587095]">
                        {specialist.position || "Specialist"}
                      </span>
                      {specialist.department && (
                        <span className="mt-2 inline-block rounded-full bg-[#eaf0fa] px-2.5 py-1 text-[10px] font-semibold text-[#294c96]">
                          {specialist.department.name}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          {!selectionValid && !loading && (
            <p role="alert" className="mt-4 text-sm text-[#9b2244]">
              Your preferred specialist could not be confirmed. Choose another
              option or retry loading the list.
            </p>
          )}
          <div
            id="specialist-approval-note"
            className="mt-6 flex items-start gap-3 rounded-xl border border-[#dce3ee] bg-[#f5f8fd] p-4"
          >
            <ShieldCheck
              size={22}
              className="mt-0.5 shrink-0 text-[#294c96]"
              aria-hidden="true"
            />
            <div>
              <p className="m-0 text-sm font-semibold text-[#243c69]">
                Subject to availability and Department Manager approval
              </p>
              <p className="mt-1 mb-0 text-xs leading-5 text-[#587095]">
                Your preference does not reserve or assign a staff member. The
                Department Manager will confirm availability against your
                project scope and timeline, and may recommend another
                specialist.
              </p>
            </div>
          </div>
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e8edf5] pt-5">
            <p className="m-0 text-xs leading-5 text-[#687e9e]">
              Submit your service request for review. Your specialist preference
              will be considered during review.
            </p>
            <button
              type="submit"
              disabled={!selectionValid || submitting}
              aria-busy={submitting}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-[#294c96] px-5 text-sm font-bold text-white hover:enabled:bg-[#203f80] disabled:cursor-not-allowed disabled:opacity-45 max-[560px]:w-full",
                focusRing,
              )}
            >
              {submitting
                ? "Submitting request…"
                : "Submit service request for review"}
            </button>
          </footer>
          {submissionError && (
            <p
              role="alert"
              className="mt-4 mb-0 rounded-xl border border-[#efd1d9] bg-[#fff5f7] p-3 text-sm leading-5 text-[#9b2244]"
            >
              {submissionError}
            </p>
          )}
        </form>
        <aside
          aria-label="Specialist selection summary"
          className="overflow-hidden rounded-2xl border border-[#dce3ee] bg-white"
        >
          <h3 className="m-0 bg-[#294c96] px-5 py-4 text-sm font-bold text-white">
            Your project
          </h3>
          <dl className="m-0 grid gap-5 p-5">
            {[
              ["Service", service.name],
              ["Package", selectedPackage.name],
              ["Expected timeline", timeline],
              [
                "Preferred specialist",
                value?.fullName || "Department to assign",
              ],
            ].map(([label, text]) => (
              <div key={label}>
                <dt className="text-[10px] font-bold tracking-[0.12em] text-[#687e9e] uppercase">
                  {label}
                </dt>
                <dd className="mt-1 ml-0 text-sm leading-6 font-semibold text-[#243c69] [overflow-wrap:anywhere]">
                  {text}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  )
}
