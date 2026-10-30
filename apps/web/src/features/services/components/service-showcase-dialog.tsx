"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ArrowRight, ChevronDown, Plus } from "lucide-react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"
import type { Service } from "../api/services-api"
import { ServiceIcon } from "./service-icon"

export function ServiceShowcaseDialog({
  service,
  onClose,
  onExplore,
}: {
  service: Service
  onClose: () => void
  onExplore: (service: Service) => void
}) {
  const { open, handleOpenChange, closeAfterTransition } =
    useAnimatedPanelClose(onClose)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const nameRef = useRef<HTMLSpanElement>(null)
  const typeTweenRef = useRef<gsap.core.Tween | null>(null)
  const departmentLabel =
    service.departments.map((department) => department.name).join(" · ") ||
    "EXP Service"

  const animateIcon = useCallback((icon: HTMLSpanElement | null) => {
    if (!icon) return
    const media = gsap.matchMedia()
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(icon, {
        y: -6,
        duration: 1.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      })
    })

    return () => media.revert()
  }, [])

  useEffect(
    () => () => {
      typeTweenRef.current?.kill()
    },
    [],
  )

  function showExplore() {
    const name = nameRef.current
    if (!name) return
    typeTweenRef.current?.kill()

    const target = "EXPlore"
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      name.textContent = target
      return
    }

    const progress = { characters: 0 }
    name.textContent = ""
    typeTweenRef.current = gsap.to(progress, {
      characters: target.length,
      duration: 0.5,
      ease: "none",
      onUpdate: () => {
        name.textContent = target.slice(0, Math.ceil(progress.characters))
      },
    })
  }

  function restoreServiceName() {
    typeTweenRef.current?.kill()
    if (nameRef.current) nameRef.current.textContent = service.name
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay z-[110] bg-[rgb(13_28_57_/_58%)]"
        className="nexus-detail-dialog z-[110] grid aspect-[896/492] max-h-[calc(100dvh-28px)] w-[min(896px,calc(100vw-28px),calc(182.1138dvh-51px))] max-w-[896px] grid-cols-[40%_60%] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 text-[#111827] shadow-[0_24px_80px_rgb(7_20_48_/_28%)] max-[700px]:aspect-auto max-[700px]:w-[calc(100vw-28px)] max-[700px]:grid-cols-1"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
      >
        <div
          className="relative h-full min-h-0 overflow-hidden bg-[#294c96] max-[700px]:h-auto max-[700px]:aspect-[16/8]"
          onMouseEnter={showExplore}
          onMouseLeave={restoreServiceName}
        >
          {service.imageUrl && (
            <Image
              src={service.imageUrl}
              alt={service.imageAltText ?? service.name}
              fill
              unoptimized
              sizes="(max-width: 700px) calc(100vw - 28px), 360px"
              className="object-cover"
              priority
            />
          )}
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(12_31_76_/_30%),transparent_40%,rgb(12_31_76_/_75%))]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 flex min-w-0 flex-col p-6 text-white max-[560px]:p-5"
            aria-hidden="true"
          >
            <span
              ref={animateIcon}
              className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-current bg-[rgb(22_48_105_/_10%)] max-[560px]:size-12"
            >
              <ServiceIcon iconKey={service.iconKey} />
            </span>
            <span className="mt-auto flex min-w-0 items-end justify-between gap-4">
              <span
                ref={nameRef}
                className="line-clamp-3 min-w-0 text-[clamp(17px,1.35vw,21px)] leading-[1.3] font-bold tracking-[-0.025em]"
              >
                {service.name}
              </span>
              <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-current bg-[rgb(22_48_105_/_10%)]">
                <Plus size={22} strokeWidth={1.8} />
              </span>
            </span>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-col overflow-y-auto px-8 py-8 max-[560px]:px-5 max-[560px]:py-6">
          <button
            type="button"
            className={cn(
              "absolute top-3 right-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full border border-[#dfe4ec] bg-white text-[#64748b] shadow-sm transition-colors hover:bg-[#f4f6f9] hover:text-[#1f2937] motion-reduce:transition-none",
              focusRing,
            )}
            onClick={() => closeAfterTransition()}
            aria-label="Close service details"
          >
            <CloseIcon />
          </button>

          <div className="pr-8">
            <p className="m-0 text-[11px] font-bold tracking-[0.2em] text-[#203f8c] uppercase">
              {departmentLabel}
            </p>
            <DialogTitle className="mt-2 mb-0 text-[clamp(24px,3vw,32px)] leading-[1.12] font-bold tracking-[-0.04em] text-black">
              {service.name}
            </DialogTitle>
            <DialogDescription className="mt-5 mb-0 text-base leading-6 text-[#40516b]">
              {service.description}
            </DialogDescription>
          </div>

          {service.keyBenefits.length > 0 && (
            <section className="mt-7" aria-labelledby="service-benefits-title">
              <h3
                id="service-benefits-title"
                className="m-0 text-xs font-bold tracking-[0.16em] text-[#111827] uppercase"
              >
                Benefits
              </h3>
              <div className="mt-3 divide-y divide-[#e6eaf0]">
                {service.keyBenefits.map((benefit) => (
                  <details key={benefit.id} className="group py-1">
                    <summary
                      className={cn(
                        "flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#34445e] marker:hidden [&::-webkit-details-marker]:hidden",
                        focusRing,
                      )}
                    >
                      <span>{benefit.title}</span>
                      <ChevronDown
                        size={17}
                        className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-0 mb-3 pr-8 text-sm leading-5 text-[#66758d]">
                      {benefit.description}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            className={cn(
              "mt-auto flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-0 bg-black px-5 text-sm font-bold text-white transition-colors hover:bg-[#1d1d1d] motion-reduce:transition-none",
              focusRing,
            )}
            onClick={() => closeAfterTransition(() => onExplore(service))}
          >
            <span>
              <span className="font-bold">EXP</span>
              <span className="font-medium">lore</span>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
