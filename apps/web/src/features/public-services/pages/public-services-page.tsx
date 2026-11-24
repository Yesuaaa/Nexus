"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { useHoverLabel } from "@/components/ui/use-hover-label"
import { SearchField } from "@/components/ui/search-field"
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Search,
  Sparkles,
  Check,
  Code2,
  Palette,
  Target,
  Megaphone,
  Video,
  Mail,
  Headphones,
} from "lucide-react"
import { useAsyncResource } from "@/lib/use-async-resource"
import {
  getPublicService,
  listPublicServices,
} from "../api/public-services-api"
import { priceLabel, type PublicService } from "../model/types"
import styles from "../components/public-services.module.css"

const icons = {
  social: Megaphone,
  advertising: Target,
  business: Headphones,
  video: Video,
  code: Code2,
  search: Search,
  email: Mail,
  design: Palette,
  sparkles: Sparkles,
}

export function ServiceVisual({
  service,
  large = false,
  iconOnly = false,
}: {
  service: PublicService
  large?: boolean
  iconOnly?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const Icon = icons[service.iconKey as keyof typeof icons] ?? Sparkles

  return (
    <div className={large ? styles.detailVisual : styles.serviceVisual}>
      {service.imageUrl && !failed && !iconOnly ? (
        <Image
          src={service.imageUrl}
          alt={service.imageAltText || service.name}
          fill
          loading={large ? "eager" : undefined}
          sizes={
            large
              ? "(max-width: 760px) 100vw, 50vw"
              : "(max-width: 760px) 100vw, 33vw"
          }
          unoptimized
          onError={() => setFailed(true)}
          className={styles.coverImage}
        />
      ) : (
        <Icon size={large ? 110 : 64} strokeWidth={1} aria-hidden="true" />
      )}
    </div>
  )
}

export function PublicState({
  message,
  loading,
  onRetry,
}: {
  message: string
  loading?: boolean
  onRetry?: () => void
}) {
  return (
    <div className={styles.state} role={onRetry ? "alert" : "status"}>
      {loading && <span className={styles.loadingMark} aria-hidden="true" />}
      <p>{message}</p>
      {onRetry && (
        <button type="button" className={styles.secondary} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

function PublicServiceCard({
  service,
  index,
}: {
  service: PublicService
  index: number
}) {
  const cardRef = useRef<HTMLElement>(null)
  const revealRef = useRef<HTMLSpanElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const { labelRef, show, restore } = useHoverLabel(service.name)

  useEffect(() => {
    const reveal = revealRef.current
    return () => gsap.killTweensOf(reveal)
  }, [])

  function showReveal(clientX?: number, clientY?: number) {
    const card = cardRef.current
    const reveal = revealRef.current
    if (!card || !reveal) return
    const bounds = card.getBoundingClientRect()
    const x = (clientX ?? bounds.left + bounds.width / 2) - bounds.left
    const y = (clientY ?? bounds.top + bounds.height / 2) - bounds.top
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    gsap.killTweensOf(reveal)
    gsap.set(reveal, { clipPath: `circle(0px at ${x}px ${y}px)`, scale: 1 })
    gsap.to(reveal, {
      clipPath: `circle(${Math.hypot(bounds.width, bounds.height)}px at ${x}px ${y}px)`,
      scale: 1,
      duration: reduced ? 0 : 0.55,
      ease: "power3.out",
    })
    show()
  }

  function hideReveal() {
    const reveal = revealRef.current
    if (!reveal) return
    gsap.killTweensOf(reveal)
    gsap.to(reveal, {
      clipPath: "circle(0px at 50% 50%)",
      scale: 1,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 0.4,
      ease: "power3.inOut",
    })
    restore()
  }

  return (
    <article
      ref={cardRef}
      className="group relative aspect-[7/9] w-full overflow-hidden rounded-[10px] bg-[#203f8c] text-white"
      data-has-image={!!service.imageUrl && !imageFailed}
      onMouseEnter={(event) => showReveal(event.clientX, event.clientY)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) hideReveal()
      }}
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) showReveal()
      }}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.matches(":hover")
        )
          hideReveal()
      }}
    >
      <span
        ref={revealRef}
        className="pointer-events-none absolute inset-0 z-0 bg-[#122b5a] [clip-path:circle(0px_at_50%_50%)]"
        aria-hidden="true"
      >
        {service.imageUrl && !imageFailed && (
          <>
            <Image
              src={service.imageUrl}
              alt=""
              fill
              loading="eager"
              sizes="(max-width: 760px) 100vw, 33vw"
              unoptimized
              className={styles.coverImage}
              onError={() => setImageFailed(true)}
            />
            <span className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-black/20" />
          </>
        )}
      </span>
      <span className="absolute top-5 left-5 z-10 font-mono text-[11px] font-semibold text-white/85">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        aria-hidden="true"
        className="absolute top-4 right-4 z-10 grid size-9 place-items-center rounded-full bg-white text-[#121214] transition-transform duration-300 group-hover:rotate-45"
      >
        <ArrowUpRight size={16} />
      </span>
      <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
        <h2
          aria-label={service.name}
          className="!text-[clamp(20px,2vw,27px)] !leading-[1.08] !font-semibold !tracking-[-0.04em] !text-white"
        >
          <span ref={labelRef} aria-hidden="true" className="!text-white">
            {service.name}
          </span>
        </h2>
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] motion-reduce:transition-none">
          <div className="min-h-0 overflow-hidden">
            <p className="mt-2 line-clamp-3 max-w-[280px] text-[12px] leading-[1.5] text-white/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
              {service.description}
            </p>
          </div>
        </div>
      </div>
      <Link
        href={"/explore/services/" + encodeURIComponent(service.id)}
        aria-label={"View details for " + service.name}
        data-service-card-link
        className="absolute inset-0 z-20 rounded-[inherit] focus-visible:outline-3 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
      />
    </article>
  )
}

export function PublicServicesPage() {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const resource = useAsyncResource(
    (signal) => listPublicServices(query, page, signal),
    [query, page],
    {
      fallbackError: "We couldn't load services. Please try again.",
    },
  )
  const pages = Math.max(1, Math.ceil((resource.data?.total ?? 0) / 12))

  return (
    <>
      <div className={styles.intro}>
        <h1>
          FIND YOUR NEXT
          <br />
          <span className="!text-[#203f8c]">STARTING POINT.</span>
        </h1>
        <p>
          Explore our services, discover what fits, and share what you have in
          mind. A conversation comes before any commitment.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="relative left-1/2 mb-5 h-px w-screen -translate-x-1/2 bg-[#d7d6d2]"
      />
      <form
        className="flex items-center gap-3 max-[540px]:flex-wrap"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(search.trim())
          setPage(1)
        }}
      >
        <SearchField
          id="service-search"
          label="Search services"
          fullWidth
          containerClassName="!w-full !min-w-0 !flex-1 max-[1050px]:!w-full"
          maxLength={120}
          placeholder="Search services by name or description"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="submit"
          className={`${styles.primary} !min-h-[34px] !px-4 !py-2`}
        >
          Search
        </button>
        {(query || search) && (
          <button
            type="button"
            className={`${styles.secondary} !min-h-[34px] !px-4 !py-2`}
            onClick={() => {
              setSearch("")
              setQuery("")
              setPage(1)
            }}
          >
            Clear
          </button>
        )}
      </form>
      {resource.loading ? (
        <PublicState loading message="Finding services for you…" />
      ) : resource.error ? (
        <PublicState message={resource.error} onRetry={resource.retry} />
      ) : !resource.data?.services.length ? (
        <PublicState
          message={
            query
              ? "No services match your search. Try a different term."
              : "New services are on their way. Please check back soon."
          }
        />
      ) : (
        <>
          <div className={styles.resultsLine} aria-live="polite">
            {resource.data.total}{" "}
            {resource.data.total === 1 ? "service" : "services"}
            {query && " matching “" + query + "”"}
          </div>
          <div className={styles.catalogGrid}>
            {resource.data.services.map((service, index) => (
              <PublicServiceCard
                key={service.id}
                service={service}
                index={index}
              />
            ))}
          </div>
          <nav className={styles.pagination} aria-label="Service pages">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className={styles.secondary}
            >
              <ArrowLeft size={16} />
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className={styles.secondary}
            >
              Next
              <ArrowRight size={16} />
            </button>
          </nav>
        </>
      )}
    </>
  )
}

export function PublicServiceDetails({ id }: { id: string }) {
  const resource = useAsyncResource(
    (signal) => getPublicService(id, signal),
    [id],
  )
  const { data: service, loading } = resource
  if (loading) return <PublicState loading message="Opening service details…" />
  if (resource.error || !service)
    return (
      <>
        <Link href="/explore/services" className={styles.back}>
          <ArrowLeft size={16} />
          All services
        </Link>
        <PublicState
          message={resource.error || "This service is unavailable."}
          onRetry={resource.retry}
        />
      </>
    )
  return (
    <>
      <Link href="/explore/services" className={styles.back}>
        <ArrowLeft size={16} />
        All services
      </Link>
      <div className={styles.detailHero}>
        <div className={styles.detailCopy}>
          <h1>{service.name}</h1>
          <p className={styles.description}>{service.description}</p>
          {!loading && service.keyBenefits.length > 0 && (
            <div className="mt-7 border-t border-[#121214]/15">
              {service.keyBenefits.map((benefit, index) => (
                <details
                  key={benefit.id}
                  className="group border-b border-[#121214]/15"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-4 py-4 text-[#606068] transition-colors hover:text-[#121214] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5bff] [&::-webkit-details-marker]:hidden">
                    <span className="w-4 shrink-0 font-mono text-[9px] text-[#606068]/75">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[clamp(16px,2vw,24px)] leading-tight font-medium uppercase tracking-[-0.035em]">
                      {benefit.title}
                    </span>
                    <ChevronDown
                      size={18}
                      className="shrink-0 transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="pb-4 pl-8 text-sm leading-7 text-[#606068]">
                    {benefit.description}
                  </p>
                </details>
              ))}
            </div>
          )}
          {service.pricing?.amount !== null &&
            service.pricing?.amount !== undefined &&
            service.pricing.pricingModel !== "CUSTOM_QUOTE" && (
              <span className={styles.price}>
                {priceLabel(service.pricing)}
              </span>
            )}
          <Link
            href="/register"
            data-service-inquiry-link
            className={`${styles.primary} mt-6 !border-[#203f8c] !bg-[#203f8c]`}
          >
            Create an Account to Start Your Inquiry
            <ArrowUpRight size={18} />
          </Link>
          <p className={styles.small}>
            An inquiry starts a conversation. It does not confirm a booking.
          </p>
        </div>
        <ServiceVisual
          key={`${service.id}:${service.imageUrl ?? ""}`}
          service={service}
          large
        />
      </div>
      {!loading && !!service.packages.length && (
        <section
          className={styles.detailSection}
          aria-labelledby="plans-heading"
        >
          <h2 id="plans-heading">Find a plan that fits.</h2>
          <div className={styles.benefits}>
            {service.packages.map((plan) => (
              <article className={styles.plan} key={plan.id}>
                {plan.isRecommended && (
                  <span className={styles.recommended}>Recommended</span>
                )}
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <strong className={styles.price}>
                  {priceLabel(plan.pricing)}
                </strong>
                <ul>
                  {plan.includedFeatures.map((feature, index) => (
                    <li key={index}>
                      <Check size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={styles.secondary}>
                  Discuss this service
                  <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
      {!loading && !!service.clientRequirements.length && (
        <section
          className={styles.detailSection}
          aria-labelledby="requirements-heading"
        >
          <h2 id="requirements-heading">Helpful to have in mind.</h2>
          <ul className={styles.requirements}>
            {service.clientRequirements.map((item, index) => (
              <li key={index}>
                <Check size={17} />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
