"use client"

import { useEffect, useRef } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MessagesSquare,
  Check,
} from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import type { Service } from "../api/services-api"
import { getServicePricingOptions } from "../model/service-pricing"
import { ServiceIcon } from "./service-icon"

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
  const recommendedId = options.find((option) => option.isRecommended)?.id

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
          <p className="m-0 text-xs font-semibold tracking-[0.1em] text-white/85 uppercase">
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
          <p className="mt-1.5 mb-0 text-sm text-white/85">
            {service.departments
              .map((department) => department.name)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onViewDetails}
          className={cn(
            "min-h-11 shrink-0 cursor-pointer rounded-lg border border-white/50 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 motion-reduce:transition-none max-[560px]:w-full",
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
              const recommended = option.id === recommendedId
              return (
                <article
                  key={option.id}
                  className={cn(
                    "flex min-h-[420px] min-w-0 max-w-[330px] basis-full flex-col rounded-2xl border-2 p-5 transition-[border-color,background-color] duration-150 motion-reduce:transition-none @[540px]:basis-[calc((100%_-_20px)/2)] @[820px]:basis-[calc((100%_-_40px)/3)]",
                    isSelected
                      ? "border-[#203f80] bg-[#294c96] text-white"
                      : "border-[#e1e7f0] bg-[#fafbfd]",
                  )}
                  aria-labelledby={`package-${option.id}-name`}
                >
                  <div className="mb-3 flex h-10 items-start justify-between gap-2">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl",
                        isSelected
                          ? "bg-white/15 text-white"
                          : "bg-[#edf2fc] text-[#294c96]",
                      )}
                      aria-hidden="true"
                    >
                      <ServiceIcon iconKey={service.iconKey} size={22} />
                    </span>
                    {recommended && (
                      <span
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-xs font-semibold",
                          isSelected
                            ? "bg-white text-[#234488]"
                            : "bg-[#eaf0ff] text-[#234488]",
                        )}
                      >
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="min-h-[88px]">
                    <h3
                      id={`package-${option.id}-name`}
                      className={cn(
                        "m-0 text-xl leading-7 font-bold tracking-[-0.025em] [overflow-wrap:anywhere]",
                        isSelected ? "text-white" : "text-[#101d35]",
                      )}
                    >
                      {option.name}
                    </h3>
                    <p
                      className={cn(
                        "mt-1.5 mb-0 line-clamp-2 text-sm leading-6",
                        isSelected ? "text-white/85" : "text-[#526584]",
                      )}
                    >
                      {option.description || service.description}
                    </p>
                  </div>
                  <div
                    id={`package-${option.id}-price`}
                    className={cn(
                      "mt-4 flex min-h-[96px] flex-col justify-center",
                      isSelected ? "text-white" : "text-[#101d35]",
                    )}
                  >
                    {option.price.label === "Starting at" && (
                      <p className="mt-0 mb-1 text-xs font-semibold">
                        Starting at
                      </p>
                    )}
                    <p className="m-0 text-[30px] leading-[1.15] font-bold tracking-[-0.035em] [overflow-wrap:anywhere]">
                      {option.price.amount}
                    </p>
                    {option.price.suffix && (
                      <p
                        className={cn(
                          "mt-1.5 mb-0 text-sm",
                          isSelected ? "text-white/85" : "text-[#526584]",
                        )}
                      >
                        {option.price.suffix}
                      </p>
                    )}
                    {option.price.label === "Custom quotation" && (
                      <p
                        className={cn(
                          "mt-1.5 mb-0 text-sm",
                          isSelected ? "text-white/85" : "text-[#526584]",
                        )}
                      >
                        Custom quotation
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(option.id)}
                    aria-label={`Select ${option.name}`}
                    aria-pressed={isSelected}
                    aria-describedby={`package-${option.id}-price`}
                    className={cn(
                      "mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold transition-colors motion-reduce:transition-none",
                      isSelected
                        ? "border-white bg-white text-[#294c96] hover:bg-[#eaf0ff]"
                        : "border-[#294c96] bg-white text-[#294c96] hover:bg-[#eef3ff]",
                      focusRing,
                    )}
                  >
                    {isSelected && (
                      <CheckCircle2 size={16} aria-hidden="true" />
                    )}
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {isSelected ? "Selected" : `Select ${option.name}`}
                    </span>
                  </button>
                  <div
                    className={cn(
                      "mt-5 border-t pt-4",
                      isSelected ? "border-white/25" : "border-[#dce3ee]",
                    )}
                  >
                    <p
                      className={cn(
                        "m-0 text-sm font-semibold",
                        isSelected ? "text-white" : "text-[#243c69]",
                      )}
                    >
                      {option.includedFeatures.length > 0
                        ? "What’s included"
                        : "About this option"}
                    </p>
                    {option.includedFeatures.length > 0 ? (
                      <ul className="mt-3 mb-0 grid list-none gap-3 p-0">
                        {option.includedFeatures.map((feature, index) => (
                          <li
                            key={`${feature}-${index}`}
                            className={cn(
                              "flex items-start gap-2.5 text-sm leading-[22px]",
                              isSelected ? "text-white/90" : "text-[#405b80]",
                            )}
                          >
                            <Check
                              size={17}
                              strokeWidth={2.2}
                              className={cn(
                                "mt-0.5 shrink-0",
                                isSelected ? "text-white" : "text-[#294c96]",
                              )}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        className={cn(
                          "mt-3 mb-0 text-sm leading-6",
                          isSelected ? "text-white/90" : "text-[#405b80]",
                        )}
                      >
                        {option.price.label === "Custom quotation"
                          ? "Share your project requirements so we can confirm the scope and prepare a quote."
                          : "Continue to share your requirements and preferred timeline."}
                      </p>
                    )}
                  </div>
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
          Continue <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
