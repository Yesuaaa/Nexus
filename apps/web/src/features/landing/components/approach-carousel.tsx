"use client"

import Image from "next/image"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import styles from "./landing.module.css"

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
      className={styles.approach}
      aria-labelledby="approach-heading"
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false)
        }
      }}
    >
      <div className={styles.approachHeading} data-reveal>
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
        className={styles.approachViewport}
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
        <div className={styles.approachTrack}>
          {steps.map((step) => (
            <article
              key={step.number}
              data-approach-card
              className={styles.approachCard}
              aria-roledescription="slide"
              aria-label={step.number + " of 03: " + step.name}
            >
              <div className={styles.stepImage}>
                <Image
                  src={step.image}
                  alt={step.imageAlt}
                  fill
                  sizes="(max-width: 620px) 85vw, (max-width: 900px) 40vw, 380px"
                  className={styles.coverImage}
                />
                <div className={styles.stepImageCaption}>
                  <span>{step.number}</span>
                  <p>{step.name}</p>
                </div>
              </div>
              <div className={styles.stepContent}>
                <span className={styles.stepKicker}>
                  The {step.name.toLowerCase()} stage
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className={styles.stepFooter}>
                  <span>{step.outcome}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.approachControls}>
        <div className={styles.carouselArrows}>
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
        <span className={styles.carouselCount}>
          {String(active + 1).padStart(2, "0")}
          <span> / 03</span>
        </span>
      </div>
    </section>
  )
}
