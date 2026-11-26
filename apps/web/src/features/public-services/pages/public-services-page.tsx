"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
import { listPublicServices } from "../api/public-services-api"
import { withInquiryService } from "../model/service-inquiry-link"
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

const catalogPath = "/explore/services"

function catalogHref(query: string, page = 1) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (page > 1) params.set("page", String(page))
  return params.size ? `${catalogPath}?${params}` : catalogPath
}

export function PublicServicesPage() {
  const router = useRouter()
  const params = useSearchParams()
  const query = (params.get("q") ?? "").trim().slice(0, 120)
  const requestedPage = params.get("page") ?? ""
  const page = /^[1-9][0-9]{0,4}$/.test(requestedPage)
    ? Number(requestedPage)
    : 1
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
        action={catalogPath}
        className="flex items-center gap-3 max-[540px]:flex-wrap"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          const search = new FormData(event.currentTarget).get("q")
          if (typeof search === "string")
            router.push(catalogHref(search.trim()), { scroll: false })
        }}
      >
        <SearchField
          key={query}
          id="service-search"
          name="q"
          label="Search services"
          fullWidth
          containerClassName="!w-full !min-w-0 !flex-1 max-[1050px]:!w-full"
          maxLength={120}
          placeholder="Search services by name or description"
          defaultValue={query}
        />
        <button
          type="submit"
          className={`${styles.primary} !min-h-[34px] !px-4 !py-2`}
        >
          Search
        </button>
        {(query || page > 1) && (
          <Link
            href={catalogPath}
            scroll={false}
            className={`${styles.secondary} !min-h-[34px] !px-4 !py-2`}
          >
            Clear
          </Link>
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
            {page > 1 && (
              <Link
                href={catalogHref(query, page - 1)}
                scroll={false}
                className={styles.secondary}
              >
                <ArrowLeft size={16} />
                Previous
              </Link>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link
                href={catalogHref(query, page + 1)}
                scroll={false}
                className={styles.secondary}
              >
                Next
                <ArrowRight size={16} />
              </Link>
            )}
          </nav>
        </>
      )}
    </>
  )
}

export function PublicServiceDetails({
  service,
}: {
  service: PublicService | null
}) {
  const router = useRouter()
  return (
    <>
      <Link
        href={catalogPath}
        className={styles.back}
        data-service-back-link
        onNavigate={(event) => {
          if (window.history.length <= 1) return
          event.preventDefault()
          router.back()
        }}
      >
        <ArrowLeft size={16} />
        Go Back
      </Link>
      {!service ? (
        <div className={styles.state} role="alert">
          <p>Service details are temporarily unavailable.</p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => router.refresh()}
          >
            Try again
          </button>
        </div>
      ) : (
        <ServiceDetailContent service={service} />
      )}
    </>
  )
}

function ServiceDetailContent({ service }: { service: PublicService }) {
  const inquiryHref = withInquiryService("/register", service.id)
  return (
    <>
      <div className={styles.detailHero}>
        <div className={styles.detailCopy}>
          <h1>{service.name}</h1>
          <p className={styles.description}>{service.description}</p>
          {service.keyBenefits.length > 0 && (
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
            href={inquiryHref}
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
      {!!service.packages.length && (
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
                <Link
                  href={inquiryHref}
                  data-service-inquiry-link
                  className={styles.secondary}
                >
                  Discuss this service
                  <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
      {!!service.clientRequirements.length && (
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
