"use client"

import { useRef, useState, type CSSProperties, type PointerEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowUpRight, Sparkles } from "lucide-react"
import { useAsyncResource } from "@/lib/use-async-resource"
import { listPublicServices } from "@/features/public-services/api/public-services-api"
import type { PublicService } from "@/features/public-services/model/types"

function ServiceImage({ service }: { service: PublicService }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative grid aspect-[4/3] w-full max-w-[360px] place-items-center overflow-hidden bg-(--landing-ink)/5 text-(color:--landing-blue)">
      {service.imageUrl && !failed ? (
        <Image
          src={service.imageUrl}
          alt={service.imageAltText || service.name}
          fill
          sizes="(max-width: 761px) 100vw, 360px"
          unoptimized
          onError={() => setFailed(true)}
          className="object-cover"
        />
      ) : (
        <Sparkles size={56} strokeWidth={1} aria-hidden="true" />
      )}
    </div>
  )
}

export function LandingServices() {
  const reduceMotion = useReducedMotion()
  const resource = useAsyncResource(
    (signal) => listPublicServices("", 1, signal),
    [],
    {
      fallbackError: "Services are temporarily unavailable.",
    },
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const pointerPosition = useRef<{ x: number; y: number } | null>(null)
  const services = resource.data?.services.slice(0, 5) ?? []
  const selected = services[selectedIndex]

  function previewOnPointerMove(
    event: PointerEvent<HTMLAnchorElement>,
    index: number,
  ) {
    const { clientX: x, clientY: y } = event
    const previous = pointerPosition.current
    // Rows can move under a stationary pointer during scrolling.
    if (previous?.x === x && previous.y === y) return
    pointerPosition.current = { x, y }
    if (index !== selectedIndex) setSelectedIndex(index)
  }

  if (resource.loading)
    return (
      <p className="py-10 text-(color:--landing-muted)" role="status">
        Loading services…
      </p>
    )
  if (resource.error)
    return (
      <div className="py-10" role="alert">
        <p>{resource.error}</p>
        <button
          type="button"
          onClick={resource.retry}
          className="mt-3 underline"
        >
          Try again
        </button>
      </div>
    )
  if (!selected)
    return (
      <p className="py-10 text-(color:--landing-muted)">
        No services are available right now.
      </p>
    )

  return (
    <div className="grid min-h-[100vh] grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] max-[761px]:grid-cols-1">
      <div
        className="flex flex-col items-start justify-center border-r border-(--landing-line) py-10 pr-10 max-[761px]:order-2 max-[761px]:border-r-0 max-[761px]:py-7 max-[761px]:pr-0"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className="w-full translate-y-(--service-offset) transition-[translate] duration-500 ease-out max-[761px]:translate-y-0 motion-reduce:translate-y-0 motion-reduce:transition-none"
          style={
            {
              "--service-offset": `${(selectedIndex - (services.length - 1) / 2) * 18}px`,
            } as CSSProperties
          }
        >
          <ServiceImage key={selected.id} service={selected} />
          <p className="mt-7 text-sm text-(color:--landing-muted)">
            {selected.name}
          </p>
          <p className="mt-2 max-w-[360px] text-[clamp(17px,1.6vw,21px)] leading-[1.5] tracking-[-0.02em]">
            {selected.description}
          </p>
          <Link
            href={`/explore/services/${encodeURIComponent(selected.id)}`}
            className="mt-6 inline-flex items-center gap-3 text-sm font-medium hover:text-(color:--landing-blue)"
          >
            View service <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <motion.div
        className="flex flex-col justify-center gap-3 py-10 pl-12 max-[761px]:order-1 max-[761px]:gap-2 max-[761px]:py-7 max-[761px]:pl-0"
        role="group"
        aria-label="Choose a service"
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? "visible" : "hidden"}
        whileInView="visible"
        viewport={{ amount: 0.15 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.12 } },
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold tracking-[0.12em] text-[#203f8c]">
            1. SERVICES
          </p>
          <Link
            href="/explore/services"
            className="inline-flex shrink-0 items-center gap-3 text-sm font-medium hover:text-(color:--landing-blue)"
          >
            View all services <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {services.map((service, index) => (
          <motion.div
            key={service.id}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1 },
            }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
          >
            <Link
              href={`/explore/services/${encodeURIComponent(service.id)}`}
              onPointerMove={(event) => previewOnPointerMove(event, index)}
              onFocus={() => setSelectedIndex(index)}
              className="group flex w-full cursor-pointer items-start gap-4 text-left"
            >
              <span
                className={`pointer-events-none pt-[0.45em] text-xs font-semibold transition-transform duration-500 ease-out group-hover:translate-x-4 group-focus-visible:translate-x-4 motion-reduce:translate-x-0 motion-reduce:transition-none ${selectedIndex === index ? "text-[#203f8c]" : "text-(color:--landing-muted)"}`}
              >
                [{String(index + 1).padStart(2, "0")}]
              </span>
              <span
                className={`pointer-events-none text-[clamp(28px,5vw,68px)] leading-[1.12] font-medium tracking-[-0.055em] transition-[color,translate] duration-500 ease-out group-hover:translate-x-2 group-focus-visible:translate-x-2 motion-reduce:translate-x-0 motion-reduce:transition-none ${selectedIndex === index ? "text-[#203f8c]" : "text-(color:--landing-muted) group-hover:text-(color:--landing-ink)"}`}
              >
                {service.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
