"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { motion, useReducedMotion } from "motion/react"
import {
  CalendarDays,
  ClipboardCheck,
  Lightbulb,
  ShieldCheck,
  Target,
  Users,
  Wallet,
  Workflow,
  Wrench,
} from "lucide-react"

import { ApproachChat } from "./approach-chat"

gsap.registerPlugin(ScrollTrigger)

const approachClass = [
  'relative isolate z-[51] bg-(--landing-ink) py-22 text-(color:--landing-paper) before:pointer-events-none before:absolute before:z-20 before:[inset:0_var(--landing-frame-inset)] before:border-x before:border-white/15 before:content-[""]',
  "max-[761px]:py-16",
].join(" ")

const steps = [
  {
    number: "01",
    name: "Discuss",
    title: "Tell us what you have in mind.",
    description: "Tell us about your goals, ideas, and the support you need.",
    features: [
      { label: "Your goals", icon: Target },
      { label: "Your ideas", icon: Lightbulb },
      { label: "The right team", icon: Users },
    ],
  },
  {
    number: "02",
    name: "Quote",
    title: "Get a clear plan for the work ahead.",
    description: "Receive a clear scope, timeline, and tailored proposal.",
    features: [
      { label: "Clear scope", icon: ClipboardCheck },
      { label: "Project timeline", icon: CalendarDays },
      { label: "Tailored estimate", icon: Wallet },
    ],
  },
  {
    number: "03",
    name: "Approve",
    title: "Let's bring your idea to life.",
    description: "Confirm the plan and let's bring the work to life.",
    features: [
      { label: "Approve the plan", icon: ShieldCheck },
      { label: "A ready workspace", icon: Workflow },
      { label: "Work gets underway", icon: Wrench },
    ],
  },
]

export function ApproachCarousel() {
  const reduceMotion = useReducedMotion()
  const stagesRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const chatTransitionRef = useRef<HTMLDivElement>(null)
  const displayedStageRef = useRef<number | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [displayedStage, setDisplayedStage] = useState<{
    stage: number
    revision: number
  } | null>(null)
  const selected = steps[active ?? 0]

  useLayoutEffect(() => {
    const stages = stagesRef.current
    if (!stages) return

    const updateConnectors = () => {
      stages
        .querySelectorAll<HTMLElement>("[data-flow-step]")
        .forEach((step) => {
          const content = step.querySelector<HTMLElement>("[data-flow-content]")
          if (!content) return

          const gap = Math.max(0, step.clientHeight - content.offsetHeight)
          const connectorHeight = gap * 0.85
          step.style.setProperty(
            "--flow-connector-top",
            `${step.clientHeight - connectorHeight / 2}px`,
          )
          step.style.setProperty(
            "--flow-connector-height",
            `${connectorHeight}px`,
          )
        })
    }

    updateConnectors()
    const observer = new ResizeObserver(updateConnectors)
    observer.observe(stages)
    stages.querySelectorAll<HTMLElement>("[data-flow-step]").forEach((step) => {
      observer.observe(step)
      const content = step.querySelector<HTMLElement>("[data-flow-content]")
      if (content) observer.observe(content)
    })
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const stages = stagesRef.current
    if (!stages) return

    const media = gsap.matchMedia()
    media.add("(prefers-reduced-motion: no-preference)", () => {
      stages
        .querySelectorAll<HTMLElement>("[data-flow-connector]")
        .forEach((line) => {
          gsap.fromTo(
            line,
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: "none",
              scrollTrigger: {
                trigger: line,
                start: "top 80%",
                end: () => `+=${line.offsetHeight}`,
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          )
        })
    })
    return () => media.revert()
  }, [])

  useLayoutEffect(() => {
    const chat = chatTransitionRef.current
    if (!chat || active === null) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayedStageRef.current = active
      gsap.set(chat, { autoAlpha: 1, y: 0, scale: 1 })
      const update = gsap.delayedCall(0, () => {
        setDisplayedStage((previous) => ({
          stage: active,
          revision: (previous?.revision ?? 0) + 1,
        }))
      })
      return () => {
        update.kill()
      }
    }

    if (displayedStageRef.current === null) {
      displayedStageRef.current = active
      const update = gsap.delayedCall(0, () => {
        setDisplayedStage({ stage: active, revision: 0 })
      })
      return () => {
        update.kill()
      }
    }

    const transition = gsap.timeline()
    transition.to(chat, {
      autoAlpha: 0,
      y: -6,
      scale: 0.985,
      duration: 0.2,
      ease: "power2.inOut",
      onComplete: () => {
        displayedStageRef.current = active
        setDisplayedStage((previous) => ({
          stage: active,
          revision: (previous?.revision ?? 0) + 1,
        }))
        gsap.set(chat, { y: 6 })
      },
    })
    transition.to(chat, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.25,
      ease: "power2.out",
    })
    return () => {
      transition.kill()
    }
  }, [active])

  useEffect(() => {
    const stages = stagesRef.current
    const panel = panelRef.current
    if (!stages || !panel) return

    const media = gsap.matchMedia()
    media.add(
      { desktop: "(width > 761px)", mobile: "(width <= 761px)" },
      ({ conditions }) => {
        const articles = Array.from(stages.children)
        const headerHeight = () =>
          Number.parseFloat(
            getComputedStyle(stages).getPropertyValue(
              "--landing-header-height",
            ),
          )
        const syncStage = () => {
          const header = headerHeight()
          const center = conditions?.desktop
            ? header + panel.offsetHeight / 2
            : (header + panel.offsetHeight + window.innerHeight) / 2
          const index = articles.findIndex(
            (article) => article.getBoundingClientRect().bottom > center,
          )
          setActive(index === -1 ? articles.length - 1 : index)
        }

        ScrollTrigger.create({
          trigger: panel,
          endTrigger: stages,
          start: () => `top top+=${headerHeight()}`,
          end: "bottom top",
          onUpdate: syncStage,
          onEnter: syncStage,
          onEnterBack: syncStage,
          onRefresh: (trigger) => {
            if (trigger.isActive) syncStage()
          },
        })

        // The services above can change the section's position after loading.
        const observer = new ResizeObserver(() => ScrollTrigger.refresh())
        observer.observe(stages.closest("main") ?? stages)
        return () => observer.disconnect()
      },
    )

    return () => media.revert()
  }, [])

  return (
    <section id="approach" className={approachClass} aria-label="Flow">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(255,255,255,0.025)_10px_12px,transparent_12px_20px)]"
      ></div>
      <div className="relative mx-auto grid max-w-[1360px] grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-x-16 px-12 max-[1101px]:gap-x-10 max-[1101px]:px-8 max-[761px]:flex max-[761px]:flex-col max-[761px]:px-6 max-[761px]:[--approach-chat-height:clamp(260px,43svh,360px)]">
        <div
          ref={stagesRef}
          className="min-[762px]:pb-(--landing-header-height)"
        >
          {steps.map((step) => (
            <article
              key={step.number}
              data-flow-step
              className="relative flex min-h-[calc(100svh-var(--landing-header-height))] flex-col justify-center py-16 max-[761px]:min-h-[calc(100svh-var(--landing-header-height)-var(--approach-chat-height)-32px)] max-[761px]:py-12"
            >
              <motion.div
                data-flow-content
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                animate={
                  reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
                }
                viewport={{ amount: 0.5 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.45,
                  ease: "easeOut",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.14em] text-[rgb(242_241_238_/_58%)]">
                  {step.number} — {step.name.toLowerCase()}
                </p>
                <h3 className="mt-6 max-w-[470px] text-[clamp(32px,3.2vw,48px)] leading-[1.1] font-medium tracking-[-0.05em]">
                  {step.title}
                </h3>
                <p className="mt-7 max-w-[455px] text-[15px] leading-[1.9] text-[rgb(242_241_238_/_72%)] max-[761px]:text-[14px]">
                  {step.description}
                </p>
                <ul className="mt-8 grid max-w-[455px] grid-cols-3 gap-x-5 gap-y-4 max-[761px]:mt-6 max-[381px]:gap-x-3">
                  {step.features.map(({ label, icon: Icon }) => (
                    <li
                      key={label}
                      className="flex flex-col items-start gap-2.5"
                    >
                      <Icon
                        size={17}
                        strokeWidth={1.8}
                        className="text-(color:--landing-paper)"
                        aria-hidden="true"
                      />
                      <span className="text-[13px] leading-[1.45] font-medium text-(color:--landing-paper)">
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              {step.number !== "03" && (
                <div
                  aria-hidden="true"
                  data-flow-connector
                  className="absolute left-[min(50%,227.5px)] w-1 -translate-x-1/2 origin-top rounded-full bg-white/30"
                  style={{
                    top: "var(--flow-connector-top)",
                    height: "var(--flow-connector-height)",
                  }}
                ></div>
              )}
            </article>
          ))}
        </div>

        <aside
          ref={panelRef}
          className="sticky top-(--landing-header-height) z-10 flex h-[calc(100svh-var(--landing-header-height))] self-start items-center max-[761px]:order-first max-[761px]:-mx-6 max-[761px]:h-auto max-[761px]:self-stretch max-[761px]:bg-(--landing-ink) max-[761px]:px-6 max-[761px]:pb-3"
        >
          <div className="mx-auto w-full max-w-[540px]">
            <div ref={chatTransitionRef}>
              <ApproachChat
                key={displayedStage?.revision ?? -1}
                stage={displayedStage?.stage ?? null}
              />
            </div>
            <div
              aria-live="polite"
              aria-atomic="true"
              className="mt-5 flex items-center justify-between text-[12px] [font-variant-numeric:tabular-nums] text-[rgb(242_241_238_/_72%)] max-[761px]:mt-2"
            >
              <span>{selected.name}</span>
              <span>
                {selected.number}{" "}
                <span className="text-[rgb(242_241_238_/_45%)]">/ 03</span>
              </span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
