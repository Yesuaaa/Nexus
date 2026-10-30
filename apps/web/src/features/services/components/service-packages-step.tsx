"use client"

import { useEffect, useRef } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MessagesSquare,
  Star,
} from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import type { BillingInterval, Service } from "../api/services-api"
import { getServicePricingOptions } from "../model/service-pricing"
import { ServiceIcon } from "./service-icon"

const billingSelectionLabels: Record<BillingInterval, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
}

export function ServicePackagesStep({
  service,
  onBack,
  onViewDetails,
  selectedId,
  onSelect,
  onContinue,
}: {
  service: Service
  onBack: () => void
  onViewDetails: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  onContinue: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const options = getServicePricingOptions(service)
  const selected = options.find((option) => option.id === selectedId)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className="mt-5" aria-labelledby="service-packages-title">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "mb-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold text-[#294c96] hover:bg-[#eef3ff]",
          focusRing,
        )}
      >
        <ArrowLeft size={17} aria-hidden="true" /> Back to services
      </button>

      <div className="flex items-center gap-4 rounded-2xl bg-[#294c96] p-6 text-white max-[560px]:flex-wrap max-[560px]:p-5">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/50"
          aria-hidden="true"
        >
          <ServiceIcon iconKey={service.iconKey} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[10px] font-bold tracking-[0.15em] text-white/75 uppercase">
            Selected service
          </p>
          <h2
            ref={headingRef}
            id="service-packages-title"
            tabIndex={-1}
            className="mt-1 mb-0 rounded text-xl leading-tight font-bold tracking-[-0.025em] outline-none"
          >
            {service.name}
          </h2>
          <p className="mt-1.5 mb-0 text-xs text-white/80">
            {service.departments
              .map((department) => department.name)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onViewDetails}
          className={cn(
            "min-h-10 shrink-0 cursor-pointer rounded-lg border border-white/40 bg-white/10 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/20 motion-reduce:transition-none max-[560px]:w-full",
            focusRing,
          )}
        >
          View service details
        </button>
      </div>

      <fieldset className="mt-7 min-w-0 border-0 p-0">
        <legend className="text-lg font-bold tracking-[-0.025em] text-[#101d35]">
          Packages & pricing
        </legend>
        <p className="mt-1 mb-5 text-sm text-[#587095]">
          Compare what’s included and select the option that fits your needs.
        </p>
        <div
          className={cn(
            "@container mx-auto max-w-[1030px]",
            options.length === 1 && "max-w-[330px]",
            options.length === 2 && "max-w-[680px]",
          )}
        >
          <div className="flex flex-wrap justify-center gap-5">
            {options.map((option) => {
              const isSelected = option.id === selectedId
              const selectionLabel = option.billingInterval
                ? billingSelectionLabels[option.billingInterval]
                : option.name
              return (
                <article
                  key={option.id}
                  className="flex min-h-[390px] min-w-0 max-w-[330px] basis-full flex-col rounded-[18px] bg-white shadow-[0_14px_24px_rgb(15_23_42_/_15%)] @[540px]:basis-[calc((100%_-_20px)/2)] @[820px]:basis-[calc((100%_-_40px)/3)]"
                  aria-labelledby={`package-${option.id}-name`}
                >
                  <div
                    className={cn(
                      "rounded-[18px] border-2 bg-white p-3.5 shadow-[0_12px_22px_rgb(15_23_42_/_15%)] transition-[border-color] duration-200 motion-reduce:transition-none",
                      isSelected
                        ? "border-[#294c96]"
                        : option.isRecommended
                          ? "border-[#a8b6d7]"
                          : "border-transparent",
                    )}
                  >
                    <div
                      className={cn(
                        "flex min-h-[172px] flex-col items-start rounded-2xl p-4",
                        option.isRecommended
                          ? "bg-[#294c96] text-white"
                          : "bg-[#d9d9d9] text-black",
                      )}
                    >
                      <h3
                        id={`package-${option.id}-name`}
                        className="m-0 max-w-full rounded-full bg-white px-3 py-1 text-[11px] leading-4 font-extrabold text-black uppercase"
                      >
                        {option.name}
                      </h3>
                      <span
                        aria-hidden={!option.isRecommended}
                        className="mt-2 flex min-h-4 items-center gap-1 text-[10px] leading-4 font-extrabold uppercase"
                      >
                        {option.isRecommended && (
                          <>
                            <Star
                              size={11}
                              fill="currentColor"
                              aria-hidden="true"
                            />
                            Most popular
                          </>
                        )}
                      </span>
                      <div
                        id={`package-${option.id}-price`}
                        className="mt-auto pt-5"
                      >
                        {option.price.label === "Starting at" && (
                          <p className="mt-0 mb-1 text-xs font-semibold">
                            Starting at
                          </p>
                        )}
                        <p className="m-0 max-w-[220px] text-[clamp(26px,2.5vw,32px)] leading-[1.12] font-bold tracking-[-0.04em] [overflow-wrap:anywhere]">
                          {option.price.amount}
                        </p>
                        {option.price.suffix && (
                          <p className="mt-1 mb-0 text-xs font-medium">
                            {option.price.suffix}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelect(option.id)}
                      aria-label={`Select ${option.name}`}
                      aria-pressed={isSelected}
                      aria-describedby={`package-${option.id}-price`}
                      className={cn(
                        "mt-4 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-black px-4 py-2 text-sm leading-5 font-bold text-white transition-colors hover:bg-[#242424] motion-reduce:transition-none",
                        focusRing,
                      )}
                    >
                      {isSelected && (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      )}
                      <span className="min-w-0 truncate">
                        {isSelected ? "Selected" : `Select ${selectionLabel}`}
                      </span>
                    </button>
                  </div>
                  {option.includedFeatures.length > 0 ? (
                    <ul className="m-0 grid list-none gap-1 px-6 pt-7 pb-8">
                      {option.includedFeatures.map((feature, index) => (
                        <li
                          key={`${feature}-${index}`}
                          className="text-sm leading-[22px] text-[#405b80]"
                        >
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 px-6 pt-7 pb-8 text-sm leading-[22px] text-[#405b80]">
                      {option.description}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      </fieldset>

      {service.requiresConsultation && (
        <aside className="mt-5 flex items-start gap-3 rounded-xl border border-[#dce3ee] bg-[#f5f8fd] p-4">
          <MessagesSquare
            size={20}
            className="mt-0.5 shrink-0 text-[#294c96]"
            aria-hidden="true"
          />
          <div>
            <p className="m-0 text-sm font-semibold text-[#243c69]">
              Consultation required
            </p>
            <p className="mt-1 mb-0 text-sm leading-5 text-[#587095]">
              {service.consultationNotes ||
                "This service requires a consultation to confirm your needs and scope."}
            </p>
          </div>
        </aside>
      )}

      <div
        role="status"
        aria-atomic="true"
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce3ee] bg-white px-5 py-4"
      >
        {selected ? (
          <>
            <div>
              <p className="m-0 text-[10px] font-bold tracking-[0.12em] text-[#687e9e] uppercase">
                Selected package
              </p>
              <p className="mt-1 mb-0 text-sm font-bold text-[#243c69]">
                {selected.name}
              </p>
            </div>
            <p className="m-0 text-base font-bold text-[#173d8d]">
              {selected.price.label === "Starting at" && "Starting at "}
              {selected.price.amount}{" "}
              <span className="text-xs font-medium text-[#587095]">
                {selected.price.suffix}
              </span>
            </p>
          </>
        ) : (
          <p className="m-0 text-sm text-[#587095]">
            Select a package to see your pricing summary.
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={!selected}
          onClick={onContinue}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#294c96] px-5 text-sm font-bold text-white transition-colors hover:enabled:bg-[#203f80] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none max-[560px]:w-full",
            focusRing,
          )}
        >
          Continue to project requirements{" "}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
