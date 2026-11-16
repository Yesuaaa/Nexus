"use client"

import Link from "next/link"
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import styles from "./landing.module.css"

const navigation = [
  { label: "About", href: "/#about" },
  { label: "Services", href: "/explore/services" },
  { label: "Our approach", href: "/#approach" },
  { label: "Contact", href: "/#contact" },
]

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
        document.getElementById("landing-menu-toggle")?.focus()
      }
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [menuOpen])

  return (
    <header className={styles.header}>
      <div className={styles.navbar}>
        <Link href="/" className={styles.brandName} aria-label="Converyn home">
          converyn
        </Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {navigation.map((item) =>
            item.href ? (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ) : (
              <button key={item.label} type="button" disabled>
                {item.label}
              </button>
            ),
          )}
        </nav>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.portalLink}>
            Log in
          </Link>
          <Link href="/register" className={styles.navCta}>
            Sign up <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            id="landing-menu-toggle"
            className={styles.menuToggle}
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          id="landing-mobile-nav"
          className={styles.mobileNav}
          aria-label="Mobile navigation"
        >
          {navigation.map((item) =>
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            ) : (
              <button key={item.label} type="button" disabled>
                {item.label}
              </button>
            ),
          )}
          <Link href="/login" onClick={() => setMenuOpen(false)}>
            Log in
          </Link>
          <Link href="/register" onClick={() => setMenuOpen(false)}>
            Sign up
          </Link>
        </nav>
      )}
    </header>
  )
}

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (
      preference.matches ||
      !root.current ||
      !("IntersectionObserver" in window)
    )
      return

    const animations = new Set<Animation>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const animation = entry.target.animate(
            [
              { opacity: 0.35, transform: "translateY(26px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          )
          animations.add(animation)
          animation.onfinish = () => animations.delete(animation)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1 },
    )

    root.current
      .querySelectorAll("[data-reveal]")
      .forEach((node) => observer.observe(node))
    const stopMotion = () => {
      if (!preference.matches) return
      observer.disconnect()
      animations.forEach((animation) => animation.cancel())
      animations.clear()
    }
    preference.addEventListener("change", stopMotion)

    return () => {
      observer.disconnect()
      animations.forEach((animation) => animation.cancel())
      preference.removeEventListener("change", stopMotion)
    }
  }, [])

  return (
    <div ref={root} className={styles.page}>
      {children}
    </div>
  )
}

const expertise = [
  "Brand strategy",
  "Creative content",
  "Digital campaigns",
  "Web experiences",
  "Visual storytelling",
  "Customer experience",
]

export function ServiceMarquee() {
  return (
    <section
      className={styles.marqueeSection}
      aria-labelledby="converyn-expertise-heading"
    >
      <div className={styles.marqueeHeading}>
        <p id="converyn-expertise-heading">
          The right expertise. A connected approach.
        </p>
        <p className={styles.marqueeDescription}>
          From a first impression to a lasting connection, bring your ideas into
          focus with creative and digital services that work together.
        </p>
      </div>
      <div
        className={styles.marquee}
        tabIndex={0}
        role="group"
        aria-label="Creative and digital expertise"
      >
        <div className={styles.marqueeTrack}>
          {[0, 1].map((copy) => (
            <div
              className={styles.marqueeGroup}
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
            >
              {expertise.map((service) => (
                <span className={styles.marqueeItem} key={service}>
                  {service}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

type LandingFaqItem = {
  question: string
  answer: string
}

export function LandingFaq({ items }: { items: readonly LandingFaqItem[] }) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)

  return (
    <div className={styles.faqList} data-reveal>
      {items.map((item, index) => {
        const open = openQuestion === item.question
        const answerId = `landing-faq-answer-${index + 1}`

        return (
          <div className={styles.faqItem} key={item.question}>
            <button
              type="button"
              className={styles.faqTrigger}
              aria-expanded={open}
              aria-controls={answerId}
              onClick={() => setOpenQuestion(open ? null : item.question)}
            >
              <span>{item.question}</span>
              <ChevronDown size={20} aria-hidden="true" />
            </button>
            <div
              id={answerId}
              className={`${styles.faqAnswer} ${open ? styles.faqAnswerOpen : ""}`}
              aria-hidden={!open}
            >
              <div className={styles.faqAnswerClip}>
                <p className={styles.faqAnswerText}>{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
