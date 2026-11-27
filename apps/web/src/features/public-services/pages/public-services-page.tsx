"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useCardImageReveal } from "@/components/ui/use-card-image-reveal"
import { useHoverLabel } from "@/components/ui/use-hover-label"
import { SearchField } from "@/components/ui/search-field"
import { HistoryBackLink } from "@/components/ui/history-back-link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import { serviceIconOptions } from "@/features/services/components/service-icon"
import { ProjectsRevealMotion } from "@/features/projects/components/projects-hero-motion"
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
  const { revealRef, showReveal, hideReveal } = useCardImageReveal(cardRef, 1)
  const [imageFailed, setImageFailed] = useState(false)
  const { labelRef, show, restore } = useHoverLabel(service.name)

  function showCard(clientX?: number, clientY?: number) {
    showReveal(clientX, clientY)
    show()
  }

  function hideCard() {
    hideReveal()
    restore()
  }

  return (
    <article
      ref={cardRef}
      className="group relative aspect-[7/9] w-full overflow-hidden rounded-[10px] bg-[#203f8c] text-white"
      data-has-image={!!service.imageUrl && !imageFailed}
      onMouseEnter={(event) => showCard(event.clientX, event.clientY)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) hideCard()
      }}
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) showCard()
      }}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.matches(":hover")
        )
          hideCard()
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

function catalogHref(query: string, page = 1, category = "") {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (page > 1) params.set("page", String(page))
  if (category) params.set("category", category)
  return params.size ? `${catalogPath}?${params}` : catalogPath
}

export function PublicServicesPage() {
  const router = useRouter()
  const params = useSearchParams()
  const query = (params.get("q") ?? "").trim().slice(0, 120)
  const category = serviceIconOptions.some(
    (option) => option.value === params.get("category"),
  )
    ? (params.get("category") ?? "")
    : ""
  const [search, setSearch] = useState(query)
  const [previousQuery, setPreviousQuery] = useState(query)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  if (previousQuery !== query) {
    setPreviousQuery(query)
    setSearch(query)
  }
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    },
    [],
  )
  const requestedPage = params.get("page") ?? ""
  const page = /^[1-9][0-9]{0,4}$/.test(requestedPage)
    ? Number(requestedPage)
    : 1
  const resource = useAsyncResource(
    (signal) => listPublicServices(query, page, signal, category),
    [query, page, category],
    {
      fallbackError: "We couldn't load services. Please try again.",
    },
  )
  const pages = Math.max(1, Math.ceil((resource.data?.total ?? 0) / 12))

  return (
    <>
      <ProjectsRevealMotion duration={0.15}>
        <div
          className={`${styles.intro} motion-safe:[[data-public-reveal=pending]_&]:opacity-0`}
          data-projects-reveal
        >
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
      </ProjectsRevealMotion>
      <div
        aria-hidden="true"
        className="relative left-1/2 mb-5 h-px w-screen -translate-x-1/2 bg-[#d7d6d2]"
      />
      <div
        role="search"
        className="grid grid-cols-[minmax(0,1fr)_224px] gap-3 max-[700px]:grid-cols-1"
      >
        <SearchField
          size="large"
          id="service-search"
          name="q"
          label="Search services"
          containerClassName="!shadow-none focus-within:!bg-background"
          className="focus-visible:!outline-none"
          maxLength={120}
          placeholder="Search services..."
          value={search}
          onChange={(event) => {
            const value = event.target.value
            setSearch(value)
            if (searchTimer.current) clearTimeout(searchTimer.current)
            searchTimer.current = setTimeout(() => {
              router.push(catalogHref(value.trim(), 1, category), {
                scroll: false,
              })
              searchTimer.current = null
            }, 300)
          }}
        />
        <Select
          value={category || "all"}
          onValueChange={(value) => {
            if (searchTimer.current) clearTimeout(searchTimer.current)
            searchTimer.current = null
            router.push(
              catalogHref(search.trim(), 1, value === "all" ? "" : value),
              { scroll: false },
            )
          }}
        >
          <SelectTrigger
            className={cn(
              "h-12 rounded-xl border-[#dce3ee] bg-background px-4 text-sm font-semibold text-[#17233a] shadow-[0_1px_2px_rgb(31_55_94_/_4%)]",
              focusRing,
            )}
            aria-label="Filter services by category"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {serviceIconOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {resource.loading ? (
        <PublicState loading message="Finding services for you…" />
      ) : resource.error ? (
        <PublicState message={resource.error} onRetry={resource.retry} />
      ) : !resource.data?.services.length ? (
        <PublicState
          message={
            query || category
              ? "No services match your search or category. Try another filter."
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
                href={catalogHref(query, page - 1, category)}
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
                href={catalogHref(query, page + 1, category)}
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
      <HistoryBackLink
        href={catalogPath}
        className={styles.back}
        data-service-back-link
      />
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
