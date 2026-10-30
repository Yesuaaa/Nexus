"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { Plus } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
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
  const cardRef = useRef<HTMLButtonElement>(null)
  const imageRevealRef = useRef<HTMLSpanElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const nameRef = useRef<HTMLSpanElement>(null)
  const typeTweenRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    const media = gsap.matchMedia()
    const imageReveal = imageRevealRef.current
    const fill = fillRef.current
    const content = contentRef.current

    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(iconRef.current, {
        y: -6,
        duration: 1.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      })
    })

    return () => {
      media.revert()
      typeTweenRef.current?.kill()
      gsap.killTweensOf([imageReveal, fill, content])
    }
  }, [])

  function typeServiceName() {
    const target = "EXPlore"
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    const name = nameRef.current

    typeTweenRef.current?.kill()

    if (!name || reduceMotion) {
      if (name) name.textContent = target
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

  function showFill(clientX?: number, clientY?: number) {
    const card = cardRef.current
    const imageReveal = imageRevealRef.current
    const fill = fillRef.current
    const content = contentRef.current
    if (!card || !fill || !content) return

    const bounds = card.getBoundingClientRect()
    const localX = (clientX ?? bounds.left + bounds.width / 2) - bounds.left
    const localY = (clientY ?? bounds.top + bounds.height / 2) - bounds.top
    const diameter = Math.hypot(bounds.width, bounds.height) * 2
    const durationScale = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1

    gsap.killTweensOf([imageReveal, fill, content])

    if (service.imageUrl && imageReveal) {
      gsap.set(fill, { scale: 0 })
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
      typeServiceName()
      return
    }

    gsap.set(fill, {
      width: diameter,
      height: diameter,
      left: localX,
      top: localY,
      xPercent: -50,
      yPercent: -50,
      scale: 0,
    })
    gsap.to(fill, {
      scale: 1,
      duration: 0.55 * durationScale,
      ease: "power3.out",
    })
    gsap.to(content, {
      color: "#294c96",
      duration: 0.22 * durationScale,
      delay: 0.12 * durationScale,
    })
    typeServiceName()
  }

  function hideFill() {
    const imageReveal = imageRevealRef.current
    const fill = fillRef.current
    const content = contentRef.current
    if (!fill || !content) return

    const durationScale = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1

    gsap.killTweensOf([imageReveal, fill, content])

    if (service.imageUrl && imageReveal) {
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
      return
    }

    gsap.to(fill, {
      scale: 0,
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
            unoptimized
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
          ref={iconRef}
          className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-current bg-[rgb(22_48_105_/_10%)] max-[560px]:size-12"
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
