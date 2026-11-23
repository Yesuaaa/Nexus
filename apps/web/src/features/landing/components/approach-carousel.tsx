"use client"

import Image from "next/image"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const approachClass = [
  "relative isolate overflow-hidden [padding-block:88px_62px] bg-(--landing-ink) text-(color:--landing-paper)",
  "max-[761px]:[padding-block:65px_42px]",
].join(" ")

const approachHeadingClass = [
  "max-w-[1264px] mx-auto px-12 flex justify-between items-end gap-12",
  "[&_h2_>_span]:text-(color:--landing-blue)",
  "[&>_p]:text-[rgb(242_241_238_/_76%)] [&>_p]:text-[14px] [&>_p]:leading-[1.9]",
  "max-[1101px]:px-9",
  "max-[851px]:gap-7",
  "max-[851px]:[&>_p]:text-[12px]",
  "max-[761px]:px-6",
  "max-[761px]:[&>_p]:max-w-[225px]",
  "max-[761px]:[&>_h2]:text-[32px]",
  "max-[621px]:items-start max-[621px]:flex-col max-[621px]:gap-5",
  "max-[621px]:[&>_h2]:text-[36px]",
  "max-[621px]:[&>_p]:max-w-[360px] max-[621px]:[&>_p]:text-[13px]",
].join(" ")

const approachViewportClass = [
  "overflow-x-auto [overscroll-behavior-x:contain] [scroll-snap-type:x_mandatory] scroll-px-[max(48px,calc((100vw_-_1168px)_/_2))] [padding:0_max(48px,calc((100vw_-_1168px)_/_2))_6px] mt-12 [scrollbar-width:none]",
  "[&::-webkit-scrollbar]:hidden",
  "focus-visible:[outline:2px_solid_var(--landing-blue)] focus-visible:outline-offset-[7px]",
  "max-[1101px]:px-9 max-[1101px]:scroll-px-9",
  "max-[761px]:mt-8.75 max-[761px]:px-6 max-[761px]:scroll-px-6",
  "motion-reduce:scroll-auto",
].join(" ")

const approachCardClass = [
  "grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] [flex:0_0_auto] gap-8.5 w-[min(1000px,calc(100vw_-_120px))] min-h-[468px] p-4.5 bg-(--landing-paper) text-(color:--landing-ink) [border:1px_solid_rgb(242_241_238_/_20%)] rounded-[6px] [scroll-snap-align:start] [box-shadow:0_22px_48px_rgb(0_0_0_/_15%)]",
  "[&:hover_[data-step-image]_>_img]:[transform:scale(1.035)]",
  "max-[1101px]:gap-6.5 max-[1101px]:min-h-[440px]",
  "max-[851px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] max-[851px]:gap-6 max-[851px]:min-h-[425px] max-[851px]:p-3.75",
  "max-[761px]:w-[calc(100vw_-_72px)]",
  "max-[621px]:grid-cols-1 max-[621px]:gap-0 max-[621px]:p-3 max-[621px]:min-h-0 max-[621px]:rounded-[6px]",
].join(" ")

const stepImageClass = [
  "relative min-h-[430px] overflow-hidden rounded-[4px] bg-(--landing-ink)",
  "[&>_img]:[transition:transform_850ms_cubic-bezier(0.22,1,0.36,1)]",
  'after:absolute after:[inset:35%_0_0] after:[content:""] after:[background:linear-gradient(_transparent,rgb(18_18_20_/_60%)_65%,rgb(18_18_20_/_95%)_)]',
  "max-[1101px]:min-h-[400px]",
  "max-[851px]:min-h-[393px]",
  "max-[621px]:min-h-0 max-[621px]:aspect-[1.2]",
].join(" ")

const stepImageCaptionClass = [
  "absolute z-1 bottom-6.5 left-6.5 right-6.5 text-[#f2f1ee]",
  "[&>_span]:text-[66px] [&>_span]:leading-[1] [&>_span]:font-normal [&>_span]:tracking-[-4px]",
  "[&>_p]:mt-3.5 [&>_p]:text-[20px] [&>_p]:font-medium [&>_p]:tracking-[-0.5px]",
  "max-[851px]:left-5 max-[851px]:bottom-5.75",
  "max-[851px]:[&>_span]:text-[58px]",
  "max-[851px]:[&>_p]:text-[18px]",
  "max-[621px]:left-5 max-[621px]:bottom-5",
  "max-[621px]:[&>_span]:text-[54px] max-[621px]:[&>_span]:tracking-[-3px]",
  "max-[621px]:[&>_p]:mt-2.25 max-[621px]:[&>_p]:text-[17px]",
].join(" ")

const stepContentClass = [
  "flex flex-col min-w-0 [padding:12px_12px_0_0]",
  "[&_h3]:max-w-[490px] [&_h3]:mt-6 [&_h3]:text-[clamp(28px,3vw,40px)] [&_h3]:leading-[1.16] [&_h3]:tracking-[-1.7px] [&_h3]:font-medium [&_h3]:text-pretty",
  "[&>_p]:max-w-[440px] [&>_p]:mt-6 [&>_p]:text-[14px] [&>_p]:leading-[1.9] [&>_p]:text-(color:--landing-muted)",
  "max-[1101px]:[&_h3]:text-[34px]",
  "max-[851px]:[padding:10px_7px_0_0]",
  "max-[851px]:[&_h3]:text-[29px] max-[851px]:[&_h3]:tracking-[-1px]",
  "max-[851px]:[&>_p]:mt-4.5 max-[851px]:[&>_p]:text-[13px]",
  "max-[621px]:min-h-[342px] max-[621px]:[padding:25px_12px_12px]",
  "max-[621px]:[&_h3]:mt-4 max-[621px]:[&_h3]:text-[28px] max-[621px]:[&_h3]:leading-[1.2]",
  "max-[621px]:[&>_p]:mt-4.5 max-[621px]:[&>_p]:text-[13px]",
].join(" ")

const stepFooterClass = [
  "flex flex-wrap justify-between items-end gap-5 pt-12 mt-auto",
  "[&>_span]:max-w-[170px] [&>_span]:pb-3 [&>_span]:text-[12px] [&>_span]:leading-[1.7] [&>_span]:text-(color:--landing-muted)",
  "max-[1101px]:pt-8 max-[1101px]:gap-3",
  "max-[1101px]:[&>_span]:max-w-[150px] max-[1101px]:[&>_span]:text-[11px]",
  "max-[851px]:items-start max-[851px]:flex-col max-[851px]:pt-6.75 max-[851px]:gap-3.75",
  "max-[851px]:[&>_span]:max-w-[none] max-[851px]:[&>_span]:pb-0",
  "max-[621px]:pt-6.5 max-[621px]:gap-4.5",
  "max-[621px]:[&>_span]:text-[10px]",
].join(" ")

const approachControlsClass = [
  "max-w-[1264px] [margin:26px_auto_0] px-12 flex items-center justify-between gap-6",
  "max-[1101px]:px-9",
  "max-[761px]:px-6",
].join(" ")

const carouselArrowsClass = [
  "flex gap-3",
  "[&>_button]:grid [&>_button]:[place-items:center] [&>_button]:w-17 [&>_button]:h-10 [&>_button]:[border:1px_solid_rgb(242_241_238_/_8%)] [&>_button]:rounded-[4px] [&>_button]:bg-[rgb(242_241_238_/_12%)] [&>_button]:text-[#f2f1ee] [&>_button]:cursor-pointer [&>_button]:[transition:background_250ms,opacity_250ms]",
  "[&>_button:hover:not(:disabled)]:bg-(--landing-blue)",
  "[&>_button:disabled]:[opacity:0.3]",
  "max-[621px]:[&>_button]:w-15 max-[621px]:[&>_button]:h-9.5",
].join(" ")

const steps = [
  {
    number: "01",
    name: "Discover",
    image: "/landing/converyn-product-discover.webp",
    imageAlt:
      "A product-focused brand exploration kit with paper studies and cobalt color swatches",
    title: "Find the right fit for your next big idea.",
    description:
      "Explore the services that support your goals. Whether you have a clear brief or a possibility in mind, start by discovering where we can make a difference together.",
    outcome: "A little curiosity. A clearer direction.",
  },
  {
    number: "02",
    name: "Connect",
    image: "/landing/converyn-product-connect.webp",
    imageAlt:
      "A laptop and smartphone displaying coordinated illustrative digital concepts",
    title: "A good conversation opens up new possibilities.",
    description:
      "Tell us what matters to your business. Share your questions, priorities, and requirements so we can understand the bigger picture before shaping the next step.",
    outcome: "Your perspective comes first.",
  },
  {
    number: "03",
    name: "Create",
    image: "/landing/converyn-product-create.webp",
    imageAlt:
      "A desktop screen, keyboard, and pen tablet in a product-focused creative workspace",
    title: "Give your next chapter a shared direction.",
    description:
      "Bring the right ideas and expertise together. Discuss the scope, align on expectations, and agree on the work ahead before turning a possibility into a project.",
    outcome: "Good work starts with understanding.",
  },
]

export function ApproachCarousel() {
  const viewport = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [isInView, setIsInView] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const [motionAllowed, setMotionAllowed] = useState(false)

  const goTo = useCallback((index: number) => {
    const container = viewport.current
    if (!container) return
    const cards = container.querySelectorAll<HTMLElement>(
      "[data-approach-card]",
    )
    const target = cards[index]
    const first = cards[0]
    if (!target || !first) return
    container.scrollTo({
      left: target.offsetLeft - first.offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    })
  }, [])

  useEffect(() => {
    const container = viewport.current
    if (!container) return

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncMotionPreference = () => setMotionAllowed(!preference.matches)
    const syncDocumentVisibility = () =>
      setIsDocumentVisible(document.visibilityState === "visible")

    syncMotionPreference()
    syncDocumentVisibility()
    preference.addEventListener("change", syncMotionPreference)
    document.addEventListener("visibilitychange", syncDocumentVisibility)

    let observer: IntersectionObserver | undefined
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => setIsInView(entry?.isIntersecting ?? false),
        { threshold: 0.25 },
      )
      observer.observe(container)
    }

    return () => {
      observer?.disconnect()
      preference.removeEventListener("change", syncMotionPreference)
      document.removeEventListener("visibilitychange", syncDocumentVisibility)
    }
  }, [])

  useEffect(() => {
    if (!isInView || isPaused || !isDocumentVisible || !motionAllowed) return

    const interval = window.setInterval(() => {
      goTo((active + 1) % steps.length)
    }, 2000)

    return () => window.clearInterval(interval)
  }, [active, goTo, isDocumentVisible, isInView, isPaused, motionAllowed])

  function updateActive() {
    const container = viewport.current
    if (!container) return
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-approach-card]"),
    )
    const firstOffset = cards[0]?.offsetLeft ?? 0
    let nearest = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    cards.forEach((card, index) => {
      const distance = Math.abs(
        container.scrollLeft - (card.offsetLeft - firstOffset),
      )
      if (distance < nearestDistance) {
        nearest = index
        nearestDistance = distance
      }
    })
    setActive((current) => (current === nearest ? current : nearest))
  }

  return (
    <section
      id="approach"
      className={approachClass}
      aria-labelledby="approach-heading"
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false)
        }
      }}
    >
      <div className={approachHeadingClass} data-reveal>
        <h2 id="approach-heading">
          A clear beginning.
          <br />
          <span>A shared direction.</span>
        </h2>
        <p>
          Discover what fits. Connect over what matters.
          <br />
          Create a clear path to what comes next.
        </p>
      </div>

      <div
        ref={viewport}
        className={approachViewportClass}
        role="region"
        aria-roledescription="carousel"
        aria-label="Discover, Connect, and Create"
        tabIndex={0}
        onScroll={updateActive}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault()
            goTo((active + 1) % steps.length)
          } else if (event.key === "ArrowLeft") {
            event.preventDefault()
            goTo((active - 1 + steps.length) % steps.length)
          } else if (event.key === "Home") {
            event.preventDefault()
            goTo(0)
          } else if (event.key === "End") {
            event.preventDefault()
            goTo(steps.length - 1)
          }
        }}
      >
        <div className="relative flex w-[max-content] gap-6 max-[621px]:gap-4">
          {steps.map((step) => (
            <article
              key={step.number}
              data-approach-card
              className={approachCardClass}
              aria-roledescription="slide"
              aria-label={step.number + " of 03: " + step.name}
            >
              <div className={stepImageClass} data-step-image>
                <Image
                  src={step.image}
                  alt={step.imageAlt}
                  fill
                  sizes="(max-width: 620px) 85vw, (max-width: 900px) 40vw, 380px"
                  className="object-cover"
                />
                <div className={stepImageCaptionClass}>
                  <span>{step.number}</span>
                  <p>{step.name}</p>
                </div>
              </div>
              <div className={stepContentClass}>
                <span className="text-[10px] leading-[1.6] uppercase tracking-[1.3px] text-(color:--landing-muted) max-[621px]:text-[8px]">
                  The {step.name.toLowerCase()} stage
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className={stepFooterClass}>
                  <span>{step.outcome}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className={approachControlsClass}>
        <div className={carouselArrowsClass}>
          <button
            type="button"
            aria-label="Previous step"
            onClick={() => goTo((active - 1 + steps.length) % steps.length)}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next step"
            onClick={() => goTo((active + 1) % steps.length)}
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
        <span className="text-[12px] [font-variant-numeric:tabular-nums] text-[#f2f1ee] [&>_span]:text-[rgb(242_241_238_/_56%)]">
          {String(active + 1).padStart(2, "0")}
          <span> / 03</span>
        </span>
      </div>
    </section>
  )
}
