"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { useHoverLabel } from "@/components/ui/use-hover-label"
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
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
import {
  cancelServiceImageTransition,
  finishServiceImageTransition,
  getServiceImagePreview,
} from "../components/service-image-transition"

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
  const imageRef = useRef<HTMLImageElement>(null)
  const Icon = icons[service.iconKey as keyof typeof icons] ?? Sparkles
  useLayoutEffect(() => {
    if (!large) return
    const image = imageRef.current
    if (image?.complete && image.naturalWidth)
      finishServiceImageTransition(service.id, image)
  }, [large, service.id])

  return (
    <div className={large ? styles.detailVisual : styles.serviceVisual}>
      {service.imageUrl && !failed && !iconOnly ? (
        <Image
          ref={imageRef}
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
          onLoad={(event) => {
            if (large)
              finishServiceImageTransition(service.id, event.currentTarget)
          }}
          onError={() => {
            if (large) cancelServiceImageTransition(service.id)
            setFailed(true)
          }}
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

function PublicServiceCard({ service }: { service: PublicService }) {
  const cardRef = useRef<HTMLElement>(null)
  const revealRef = useRef<HTMLSpanElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const { labelRef, show, restore } = useHoverLabel(service.name)

  useEffect(() => {
    const reveal = revealRef.current
    return () => {
      gsap.killTweensOf(reveal)
    }
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
      scale: service.imageUrl && !imageFailed ? 1.03 : 1,
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
      className={styles.catalogCard}
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
      <span ref={revealRef} className={styles.cardReveal} aria-hidden="true">
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
            <span className={styles.cardRevealShade} />
          </>
        )}
      </span>
      <ServiceVisual service={service} iconOnly />
      <div className={styles.cardBody}>
        <h2 aria-label={service.name}>
          <span ref={labelRef} aria-hidden="true">
            {service.name}
          </span>
        </h2>
        <p className={styles.clamp}>{service.description}</p>
        <span className={styles.price}>{priceLabel(service.pricing)}</span>
        <div className={styles.cardActions}>
          <Link
            href={"/explore/services/" + service.id}
            className={styles.cardLink}
            aria-label={"View details for " + service.name}
          >
            View details
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <Link
            href={"/explore/services/" + service.id + "/inquire"}
            className={styles.primary}
            aria-label={"Inquire about " + service.name}
          >
            Inquire
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
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
        <Link href="/" className={styles.back}>
          <ArrowLeft size={16} /> Back to Converyn
        </Link>
        <h1>
          Find your next
          <br />
          <span>starting point.</span>
        </h1>
        <p>
          Explore our services, discover what fits, and share what you have in
          mind. A conversation comes before any commitment.
        </p>
      </div>
      <form
        className={styles.search}
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(search.trim())
          setPage(1)
        }}
      >
        <label htmlFor="service-search" className={styles.srOnly}>
          Search services
        </label>
        <Search size={19} aria-hidden="true" />
        <input
          id="service-search"
          type="search"
          maxLength={120}
          placeholder="Search services by name or description"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit" className={styles.primary}>
          Search
        </button>
        {(query || search) && (
          <button
            type="button"
            className={styles.secondary}
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
            {resource.data.services.map((service) => (
              <PublicServiceCard key={service.id} service={service} />
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
  const [preview] = useState(() => getServiceImagePreview(id))
  const resource = useAsyncResource(
    (signal) => getPublicService(id, signal),
    [id],
  )
  const { data, loading } = resource
  const service = loading ? (preview?.id === id ? preview : undefined) : data
  useEffect(() => {
    if (!loading && !data?.imageUrl) cancelServiceImageTransition(id)
  }, [data?.imageUrl, id, loading])
  if (loading && service?.id !== id)
    return <PublicState loading message="Opening service details…" />
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
          <span className={styles.price}>{priceLabel(service.pricing)}</span>
          <Link
            href={"/explore/services/" + service.id + "/inquire"}
            className={styles.primary}
          >
            Inquire about this service
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
      {!loading && !!service.keyBenefits.length && (
        <section
          className={styles.detailSection}
          aria-labelledby="benefits-heading"
        >
          <h2 id="benefits-heading">What this brings to your business.</h2>
          <div className={styles.benefits}>
            {service.keyBenefits.map((benefit) => (
              <article key={benefit.id}>
                <Check size={20} />
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
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
                <Link
                  href={"/explore/services/" + service.id + "/inquire"}
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
