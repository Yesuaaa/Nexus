"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { Plus } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { useRadialHoverFill } from "@/components/ui/use-radial-hover-fill"
import { useHoverLabel } from "@/components/ui/use-hover-label"
import { cn } from "@/lib/utils"
import type { Service } from "../api/services-api"
import { ServiceIcon } from "./service-icon"

export function ServiceCard({
  service,
  onSelect,
}: {
  service: Service
  onSelect: (service: Service) => void
}) {
  const imageRevealRef = useRef<HTMLSpanElement>(null)
  const {
    cardRef,
    fillRef,
    contentRef,
    showFill: showRadialFill,
    hideFill: hideRadialFill,
  } = useRadialHoverFill<HTMLButtonElement>()
  const {
    labelRef: nameRef,
    show: showServiceName,
    restore: restoreServiceName,
  } = useHoverLabel(service.name)

  useEffect(() => {
    const imageReveal = imageRevealRef.current

    return () => {
      gsap.killTweensOf(imageReveal)
    }
  }, [])

  function showFill(clientX?: number, clientY?: number) {
    const card = cardRef.current
    const imageReveal = imageRevealRef.current
    const content = contentRef.current
    if (!service.imageUrl || !imageReveal) {
      showRadialFill(clientX, clientY)
      showServiceName()
      return
    }
    if (!card || !content) return

    const bounds = card.getBoundingClientRect()
    const localX = (clientX ?? bounds.left + bounds.width / 2) - bounds.left
    const localY = (clientY ?? bounds.top + bounds.height / 2) - bounds.top
    const diameter = Math.hypot(bounds.width, bounds.height) * 2
    const durationScale = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1

    gsap.killTweensOf([imageReveal, content])
    gsap.set(imageReveal, {
      clipPath: `circle(0px at ${localX}px ${localY}px)`,
      scale: 1,
    })
    gsap.to(imageReveal, {
      clipPath: `circle(${diameter / 2}px at ${localX}px ${localY}px)`,
      scale: 1.03,
      duration: 0.55 * durationScale,
      ease: "power3.out",
    })
    gsap.to(content, {
      color: "#ffffff",
      duration: 0.2 * durationScale,
    })
    showServiceName()
  }

  function hideFill() {
    const imageReveal = imageRevealRef.current
    const content = contentRef.current
    if (!service.imageUrl || !imageReveal) {
      hideRadialFill()
      restoreServiceName()
      return
    }
    if (!content) return

    const durationScale = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1

    gsap.killTweensOf([imageReveal, content])
    gsap.to(imageReveal, {
      clipPath: "circle(0px at 50% 50%)",
      scale: 1,
      duration: 0.4 * durationScale,
      ease: "power3.inOut",
    })
    gsap.to(content, {
      color: "#ffffff",
      duration: 0.2 * durationScale,
    })
    restoreServiceName()
  }

  return (
    <button
      ref={cardRef}
      type="button"
      className={cn(
        "group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border-0 bg-[#294c96] p-0 text-left text-white shadow-[0_8px_24px_rgb(26_58_128_/_10%)] transition-shadow duration-300 hover:shadow-[0_14px_34px_rgb(26_58_128_/_22%)] motion-reduce:transition-none",
        focusRing,
      )}
      onClick={() => onSelect(service)}
      onMouseEnter={(event) => showFill(event.clientX, event.clientY)}
      onMouseLeave={hideFill}
      onFocus={() => showFill()}
      onBlur={hideFill}
      aria-label={`Explore ${service.name}`}
    >
      {service.imageUrl ? (
        <span
          ref={imageRevealRef}
          className="pointer-events-none absolute inset-0 origin-center [clip-path:circle(0px_at_50%_50%)]"
          aria-hidden="true"
        >
          <Image
            src={service.imageUrl}
            alt=""
            fill
            sizes="(max-width: 560px) 100vw, (max-width: 1080px) 50vw, 25vw"
            className="object-cover"
          />
          <span className="absolute inset-0 bg-[rgb(12_31_76_/_45%)]" />
        </span>
      ) : (
        <span
          className="absolute inset-0 bg-[linear-gradient(145deg,transparent_40%,rgb(20_54_129_/_42%))]"
          aria-hidden="true"
        />
      )}

      <span
        ref={fillRef}
        className="pointer-events-none absolute z-10 rounded-full bg-white"
        aria-hidden="true"
      />

      <span
        ref={contentRef}
        className="relative z-20 flex h-full min-w-0 flex-col p-6 text-white max-[560px]:p-5"
      >
        <span
          className="service-icon-float grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-current bg-[rgb(22_48_105_/_10%)] max-[560px]:size-12"
          aria-hidden="true"
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
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-current bg-[rgb(22_48_105_/_10%)]"
            aria-hidden="true"
          >
            <Plus size={22} strokeWidth={1.8} />
          </span>
        </span>
      </span>
    </button>
  )
}
