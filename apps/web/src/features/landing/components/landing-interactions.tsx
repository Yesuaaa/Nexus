"use client"

import Link from "next/link"
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

const headerClass =
  "sticky top-0 z-40 bg-(--landing-paper)/45 backdrop-blur-[1.5px] [border-bottom:1px_solid_var(--landing-line)]"

const navbarClass = [
  "max-w-[1360px] h-(--landing-header-height) mx-auto px-12 flex items-center justify-between gap-7",
  "max-[1101px]:px-8",
  "max-[851px]:gap-5",
  "max-[761px]:px-6",
].join(" ")

const desktopNavClass = [
  "flex items-center gap-2",
  "[&_a]:rounded-lg [&_a]:px-3.5 [&_a]:py-2.5 [&_a]:text-[13px] [&_a]:leading-[1.5] [&_a]:text-(color:--landing-muted) [&_a]:transition-colors [&_a]:duration-200",
  "[&_button]:rounded-lg [&_button]:px-3.5 [&_button]:py-2.5 [&_button]:text-[13px] [&_button]:leading-[1.5] [&_button]:text-(color:--landing-muted) [&_button]:transition-colors [&_button]:duration-200 [&_button]:[border:0] [&_button]:bg-transparent",
  "[&_a:hover]:bg-black/8 [&_a:hover]:text-(color:--landing-ink)",
  "[&_button:hover:not(:disabled)]:bg-black/8 [&_button:hover:not(:disabled)]:text-(color:--landing-ink)",
  "max-[851px]:gap-1",
  "max-[851px]:[&_a]:text-[12px]",
  "max-[851px]:[&_button]:text-[12px]",
  "max-[761px]:hidden",
].join(" ")

const portalLinkClass = [
  "text-[13px] leading-[1.5] text-(color:--landing-muted) [transition:color_250ms]",
  "hover:text-(color:--landing-blue)",
  "max-[851px]:text-[12px]",
  "max-[761px]:hidden",
].join(" ")

const navCtaClass = [
  "inline-flex items-center justify-center gap-5 [padding:13px_20px] [border:1px_solid_var(--landing-ink)] rounded-[4px] bg-(--landing-ink) text-(color:--landing-paper) text-[13px] [transition:background_500ms_ease-in-out,color_500ms_ease-in-out]",
  "hover:bg-transparent hover:text-(color:--landing-ink)",
  "focus-visible:bg-transparent focus-visible:text-(color:--landing-ink)",
  "[&_svg]:[transition:transform_500ms_ease-in-out]",
  "[&:hover_svg]:[transform:translateX(5px)]",
  "[&:focus-visible_svg]:[transform:translateX(5px)]",
  "max-[851px]:text-[12px] max-[851px]:px-3.75 max-[851px]:gap-3.5",
].join(" ")

const menuToggleClass = [
  "hidden w-10.75 h-10.75 items-center justify-center text-(color:--landing-ink) [border:1px_solid_var(--landing-line)] rounded-[4px] bg-transparent cursor-pointer",
  "max-[761px]:flex",
].join(" ")

const mobileNavClass = [
  "grid [padding:6px_24px_20px] bg-(--landing-paper) [border-top:1px_solid_var(--landing-line)]",
  "[&_:is(a,button)]:flex [&_:is(a,button)]:items-center [&_:is(a,button)]:justify-between [&_:is(a,button)]:w-full [&_:is(a,button)]:[padding:16px_0] [&_:is(a,button)]:text-(color:--landing-ink) [&_:is(a,button)]:text-[14px] [&_:is(a,button)]:text-left [&_:is(a,button)]:[border:0] [&_:is(a,button)]:[border-bottom:1px_solid_var(--landing-line)] [&_:is(a,button)]:bg-transparent",
].join(" ")

const pageClass = [
  '[--landing-paper:var(--background)] [--landing-ink:#121214] [--landing-blue:#2f5bff] [--landing-muted:color-mix(in_srgb,var(--landing-ink)_66%,var(--landing-paper))] [--landing-line:color-mix(in_srgb,var(--landing-ink)_16%,var(--landing-paper))] [--landing-frame-width:1360px] relative isolate overflow-clip bg-(--landing-paper) text-(color:--landing-ink) [font-family:var(--font-inter),"Inter_Variable",sans-serif] antialiased',
  "[container-type:inline-size] [--landing-header-height:92px] max-[761px]:[--landing-header-height:76px] [--landing-frame-inset:max(0px,calc((100cqw_-_var(--landing-frame-width))_/_2))]",
  'before:absolute before:z-50 before:[inset:0_var(--landing-frame-inset)] before:[content:""] before:pointer-events-none before:[border-inline:1px_solid_var(--landing-line)]',
  "[:where(&)_:where(a)]:text-inherit [:where(&)_:where(a)]:no-underline [:where(&)_:where(a)]:touch-manipulation [:where(&)_:where(a)]:[-webkit-tap-highlight-color:transparent]",
  "[:where(&)_:where(button)]:[font-family:inherit] [:where(&)_:where(button)]:touch-manipulation [:where(&)_:where(button)]:[-webkit-tap-highlight-color:transparent]",
  "[:where(&)_:where(button:disabled)]:cursor-default",
  "[:where(&)_:where(summary)]:touch-manipulation [:where(&)_:where(summary)]:[-webkit-tap-highlight-color:transparent]",
  "[:where(&)_:where(a:focus-visible)]:[outline:3px_solid_var(--landing-blue)] [:where(&)_:where(a:focus-visible)]:outline-offset-[5px]",
  "[:where(&)_:where(button:focus-visible)]:[outline:3px_solid_var(--landing-blue)] [:where(&)_:where(button:focus-visible)]:outline-offset-[5px]",
  "[:where(&)_:where(summary:focus-visible)]:[outline:3px_solid_var(--landing-blue)] [:where(&)_:where(summary:focus-visible)]:outline-offset-[5px]",
  "[&_[id]]:scroll-mt-27.5",
  "[:where(&)_:where(h1)]:m-0",
  "[:where(&)_:where(h2)]:m-0 [:where(&)_h2]:text-[clamp(36px,3.5vw,50px)] [:where(&)_h2]:leading-[1.18] [:where(&)_h2]:tracking-[-2px] [:where(&)_h2]:font-medium",
  "[:where(&)_:where(h3)]:m-0",
  "[:where(&)_:where(h4)]:m-0",
  "[:where(&)_:where(p)]:m-0",
  "[:where(&)_h2_>_span]:text-(color:--landing-blue)",
  "max-[851px]:[:where(&)_h2]:text-[38px] max-[851px]:[:where(&)_h2]:tracking-[-1.5px]",
  "max-[761px]:before:hidden",
  "max-[761px]:[:where(&)_h2]:text-[38px] max-[761px]:[:where(&)_h2]:leading-[1.2]",
  "max-[381px]:[:where(&)_h2]:text-[34px]",
  "motion-reduce:[&_*]:animate-none! motion-reduce:[&_*]:transition-none!",
  "motion-reduce:[&_*::before]:animate-none! motion-reduce:[&_*::before]:transition-none!",
  "motion-reduce:[&_*::after]:animate-none! motion-reduce:[&_*::after]:transition-none!",
].join(" ")

const marqueeHeadingClass = [
  "max-w-[760px] mx-auto px-8 text-center",
  "[&>_p:first-child]:text-(color:--landing-ink) [&>_p:first-child]:text-[16px] [&>_p:first-child]:font-medium [&>_p:first-child]:leading-[1.7]",
  "max-[761px]:px-7",
  "max-[761px]:[&>_p:first-child]:text-[15px]",
].join(" ")

const marqueeDescriptionClass = [
  "max-w-[590px] [margin:13px_auto_0] text-(color:--landing-muted) text-[14px] leading-[1.85] text-pretty",
  "max-[761px]:text-[13px]",
].join(" ")

const marqueeClass = [
  "max-w-[1264px] [margin:38px_auto_0] overflow-hidden [mask-image:linear-gradient(_90deg,transparent,#000_6%,#000_94%,transparent_)]",
  "focus-visible:[outline:2px_solid_var(--landing-blue)] focus-visible:outline-offset-[6px]",
  "max-[761px]:mt-6",
  "motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]",
].join(" ")

const marqueeItemClass = [
  "inline-flex shrink-0 items-center justify-between gap-12.5 min-h-17.5 px-6.5 text-(color:--landing-ink) text-[24px] font-medium tracking-[-0.7px] [transition:color_300ms]",
  "hover:text-(color:--landing-blue)",
  "max-[761px]:min-h-14.5 max-[761px]:gap-8 max-[761px]:px-5 max-[761px]:text-[20px]",
].join(" ")

const faqTriggerClass = [
  "flex items-center justify-between gap-5.5 w-full min-h-21.5 py-5 [border:0] bg-transparent text-(color:--landing-ink) [font-family:inherit] text-[15px] leading-[1.6] text-left cursor-pointer",
  "focus-visible:[outline:2px_solid_var(--landing-blue)] focus-visible:outline-offset-[3px]",
  "[&_svg]:shrink-0 [&_svg]:text-(color:--landing-muted) [&_svg]:[transition:transform_200ms_ease-out,color_200ms_ease-out]",
  '[&[aria-expanded="true"]_svg]:[transform:rotate(180deg)] [&[aria-expanded="true"]_svg]:text-(color:--landing-blue)',
  "max-[851px]:text-[14px]",
  "max-[761px]:min-h-20.75 max-[761px]:text-[15px]",
  "motion-reduce:[&_svg]:transition-none!",
].join(" ")

const faqAnswerClass = [
  "grid grid-rows-[0fr] [transition:grid-template-rows_200ms_ease-out]",
  "motion-reduce:transition-none!",
  "data-[open=true]:grid-rows-[1fr] data-[open=true]:[&_p]:opacity-100 data-[open=true]:[&_p]:[transform:translateY(0)]",
].join(" ")

const faqAnswerTextClass = [
  "[padding:0_38px_26px_0] text-[14px] leading-[1.9] text-(color:--landing-muted) opacity-0 [transform:translateY(-5px)] [transition:opacity_200ms_ease-out,transform_200ms_ease-out]",
  "motion-reduce:transition-none!",
].join(" ")

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
    <header className={headerClass}>
      <div className={navbarClass}>
        <Link
          href="/"
          className="text-(color:--landing-ink) text-[27px] font-semibold tracking-[-1.1px] leading-[1.3] max-[761px]:text-[25px]"
          aria-label="Converyn home"
        >
          <img
            src="/auth/converyn-logo-w-text.svg"
            alt=""
            width={134}
            height={67}
            className="block h-[67px] w-[134px] object-contain"
          />
        </Link>
        <nav className={desktopNavClass} aria-label="Main navigation">
          {navigation.map((item) =>
            item.href ? (
              <Link key={item.label} href={item.href}>
                {item.label}
              </Link>
            ) : (
              <button key={item.label} type="button" disabled>
                {item.label}
              </button>
            ),
          )}
        </nav>
        <div className="flex items-center gap-6.5 max-[1101px]:gap-5 max-[851px]:gap-4 max-[761px]:gap-3">
          <Link href="/login" className={portalLinkClass}>
            Log in
          </Link>
          <Link href="/register" className={navCtaClass}>
            Sign up <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            id="landing-menu-toggle"
            className={menuToggleClass}
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
          className={mobileNavClass}
          aria-label="Mobile navigation"
        >
          {navigation.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
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
    <div ref={root} className={pageClass}>
      {children}
    </div>
  )
}

export function PinnedHero({ children }: { children: ReactNode }) {
  const heroRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    const content = contentRef.current
    if (!hero || !content) return

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0

    const updateParallax = () => {
      frame = 0
      if (preference.matches) {
        content.style.transform = ""
        return
      }
      const curtain = hero.nextElementSibling
      if (!curtain) return
      const heroBounds = hero.getBoundingClientRect()
      const covered = Math.max(
        0,
        Math.min(
          1,
          (heroBounds.bottom - curtain.getBoundingClientRect().top) /
            heroBounds.height,
        ),
      )
      content.style.transform = `translateY(${-32 * covered}px)`
    }
    const scheduleParallax = () => {
      if (!frame) frame = window.requestAnimationFrame(updateParallax)
    }

    const updatePosition = () => {
      const headerHeight = parseFloat(
        getComputedStyle(hero).getPropertyValue("--landing-header-height"),
      )
      const availableHeight =
        window.visualViewport?.height ?? window.innerHeight
      hero.style.setProperty(
        "--hero-sticky-top",
        `${Math.min(headerHeight || 0, availableHeight - hero.offsetHeight)}px`,
      )
      scheduleParallax()
    }
    const observer = new ResizeObserver(updatePosition)
    observer.observe(hero)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", scheduleParallax, { passive: true })
    preference.addEventListener("change", scheduleParallax)
    window.visualViewport?.addEventListener("resize", updatePosition)
    updatePosition()

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", scheduleParallax)
      preference.removeEventListener("change", scheduleParallax)
      window.visualViewport?.removeEventListener("resize", updatePosition)
    }
  }, [])

  return (
    <div
      ref={heroRef}
      className="sticky top-(--hero-sticky-top,0px) z-0 motion-reduce:relative motion-reduce:top-auto"
    >
      <div ref={contentRef}>{children}</div>
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
      className="[padding:48px_0_54px] [border-block:1px_solid_var(--landing-line)] max-[761px]:[padding-block:36px_38px]"
      aria-labelledby="converyn-expertise-heading"
    >
      <div className={marqueeHeadingClass}>
        <p id="converyn-expertise-heading">
          The right expertise. A connected approach.
        </p>
        <p className={marqueeDescriptionClass}>
          From a first impression to a lasting connection, bring your ideas into
          focus with creative and digital services that work together.
        </p>
      </div>
      <div
        className={marqueeClass}
        tabIndex={0}
        role="group"
        aria-label="Creative and digital expertise"
      >
        <div className="flex w-[max-content] animate-[landing-service-marquee_50s_linear_infinite]">
          {[0, 1].map((copy) => (
            <div
              className={
                'flex shrink-0 motion-reduce:[&[aria-hidden="true"]]:hidden'
              }
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
            >
              {expertise.map((service) => (
                <span className={marqueeItemClass} key={service}>
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
    <div className="[border-top:1px_solid_var(--landing-line)]" data-reveal>
      {items.map((item, index) => {
        const open = openQuestion === item.question
        const answerId = `landing-faq-answer-${index + 1}`

        return (
          <div
            className="[border-bottom:1px_solid_var(--landing-line)]"
            key={item.question}
          >
            <button
              type="button"
              className={faqTriggerClass}
              aria-expanded={open}
              aria-controls={answerId}
              onClick={() => setOpenQuestion(open ? null : item.question)}
            >
              <span>{item.question}</span>
              <ChevronDown size={20} aria-hidden="true" />
            </button>
            <div
              id={answerId}
              className={faqAnswerClass}
              data-open={open}
              aria-hidden={!open}
            >
              <div className="min-h-0 overflow-hidden">
                <p className={faqAnswerTextClass}>{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
