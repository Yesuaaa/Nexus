"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const aboutStoriesClass = [
  "min-w-0 w-full perspective-[1100px] rounded-[6px]",
  "focus-visible:[outline:2px_solid_var(--landing-blue)] focus-visible:outline-offset-[7px]",
  "max-[761px]:max-w-[560px] max-[761px]:mx-auto",
].join(" ")

const storyCardClass = [
  "absolute top-[50%] left-[50%] w-[50%] h-[85%] overflow-hidden [border:1px_solid_rgb(242_241_238_/_70%)] rounded-[12px] bg-(--landing-ink) [box-shadow:0_20px_38px_rgb(18_18_20_/_17%)] backface-hidden [transition:transform_650ms_cubic-bezier(0.22,1,0.36,1),opacity_450ms,box-shadow_650ms]",
  '[&[data-position="center"]]:z-3 [&[data-position="center"]]:opacity-100 [&[data-position="center"]]:[transform:translate(-50%,-53%)_scale(1)] [&[data-position="center"]]:[box-shadow:0_25px_55px_rgb(18_18_20_/_23%)]',
  '[&[data-position="right"]]:z-2 [&[data-position="right"]]:[opacity:0.94] [&[data-position="right"]]:[transform:translate(8%,-46%)_rotate(4deg)_scale(0.84)]',
  '[&[data-position="left"]]:z-1 [&[data-position="left"]]:[opacity:0.94] [&[data-position="left"]]:[transform:translate(-108%,-46%)_rotate(-4deg)_scale(0.84)]',
  'before:absolute before:z-1 before:left-0 before:right-0 before:[content:""] before:pointer-events-none before:top-0 before:h-[28%] before:[background:linear-gradient(rgb(18_18_20_/_32%),transparent)]',
  'after:absolute after:z-1 after:left-0 after:right-0 after:[content:""] after:pointer-events-none after:bottom-0 after:h-[45%] after:[background:linear-gradient(transparent,rgb(18_18_20_/_88%))]',
].join(" ")

const storyToplineClass = [
  "absolute z-2 top-4.75 left-4 right-4 flex items-center justify-between gap-2.5 text-[#f2f1ee] text-[8px] font-medium tracking-[0.3px]",
  "[&>_span:last-child]:[opacity:0.75] [&>_span:last-child]:[font-variant-numeric:tabular-nums]",
  "max-[1101px]:left-3 max-[1101px]:right-3 max-[1101px]:text-[7px]",
  "max-[851px]:min-[761px]:top-3.5 max-[851px]:min-[761px]:text-[6px]",
  "max-[761px]:text-[8px]",
  "max-[381px]:text-[6px] max-[381px]:gap-1.25",
].join(" ")

const storyCaptionClass = [
  "absolute z-2 left-4.75 right-4.75 bottom-6.25 text-[#f2f1ee]",
  "[&>_p]:max-w-[185px] [&>_p]:text-[25px] [&>_p]:leading-[1.16] [&>_p]:tracking-[-0.8px] [&>_p]:font-medium [&>_p]:text-pretty",
  "[&>_span]:block [&>_span]:mt-3 [&>_span]:text-[8px] [&>_span]:leading-[1.7] [&>_span]:text-[rgb(242_241_238_/_75%)]",
  "max-[1101px]:left-3.75 max-[1101px]:right-3.75 max-[1101px]:bottom-5.25",
  "max-[1101px]:[&>_p]:text-[22px]",
  "max-[851px]:min-[761px]:[&>_p]:text-[19px]",
  "max-[851px]:min-[761px]:[&>_span]:text-[7px] max-[851px]:min-[761px]:[&>_span]:mt-2",
  "max-[761px]:[&>_p]:text-[clamp(19px,4.8vw,27px)]",
  "max-[381px]:left-3.25 max-[381px]:right-3.25 max-[381px]:bottom-4.75",
  "max-[381px]:[&>_p]:text-[18px]",
  "max-[381px]:[&>_span]:text-[6px]",
].join(" ")

const storyDotsClass = [
  "flex items-center justify-center gap-1 mt-2",
  "[&>_button]:grid [&>_button]:[place-items:center] [&>_button]:w-7 [&>_button]:h-7 [&>_button]:p-2 [&>_button]:[border:0] [&>_button]:rounded-[4px] [&>_button]:bg-transparent [&>_button]:cursor-pointer",
  "[&>_button_>_span]:block [&>_button_>_span]:w-1.25 [&>_button_>_span]:h-1.25 [&>_button_>_span]:rounded-[50%] [&>_button_>_span]:bg-[color-mix(in_srgb,var(--landing-ink)_24%,var(--landing-paper))] [&>_button_>_span]:[transition:background_250ms,transform_250ms]",
  '[&>_button[aria-pressed="true"]_>_span]:bg-(--landing-blue) [&>_button[aria-pressed="true"]_>_span]:[transform:scale(1.4)]',
].join(" ")

const stories = [
  {
    image: "/landing/converyn-team-strategy.webp",
    alt: "Illustrative strategist reviewing website concepts and creative direction",
    category: "Creative direction",
    title: "Ideas with character.",
  },
  {
    image: "/landing/converyn-team-conversation.webp",
    alt: "Illustrative creative team discussing a digital project",
    category: "Brand storytelling",
    title: "A story worth seeing.",
  },
  {
    image: "/landing/converyn-team-design.webp",
    alt: "Illustrative digital designer working on a website layout",
    category: "Visual content",
    title: "A fresh perspective.",
  },
]

const positions = ["center", "right", "left"] as const

export function AboutStoryCards() {
  const root = useRef<HTMLDivElement>(null)
  const hovered = useRef(false)
  const focused = useRef(false)
  const visible = useRef(false)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const element = root.current
    if (!element) return

    let observer: IntersectionObserver | undefined
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          visible.current = Boolean(entry?.isIntersecting)
        },
        { threshold: 0.25 },
      )
      observer.observe(element)
    } else {
      visible.current = true
    }

    const timer = window.setInterval(() => {
      if (
        !preference.matches &&
        visible.current &&
        !document.hidden &&
        !hovered.current &&
        !focused.current
      )
        setRotation((value) => (value + 1) % stories.length)
    }, 2800)

    return () => {
      window.clearInterval(timer)
      observer?.disconnect()
    }
  }, [])

  const active = (stories.length - rotation) % stories.length

  return (
    <div
      ref={root}
      className={aboutStoriesClass}
      role="region"
      aria-roledescription="carousel"
      aria-label="Creative ideas in motion"
      aria-live="off"
      tabIndex={0}
      data-reveal
      onMouseEnter={() => {
        hovered.current = true
      }}
      onMouseLeave={() => {
        hovered.current = false
      }}
      onFocusCapture={() => {
        focused.current = true
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          focused.current = false
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault()
          setRotation((value) => (value + 1) % stories.length)
        } else if (event.key === "ArrowLeft") {
          event.preventDefault()
          setRotation((value) => (value + stories.length - 1) % stories.length)
        }
      }}
    >
      <div className="relative w-full aspect-[1.02] max-[761px]:aspect-[1.06]">
        {stories.map((story, index) => (
          <div
            className={storyCardClass}
            key={story.image}
            data-position={positions[(index + rotation) % stories.length]}
          >
            <Image
              src={story.image}
              alt={story.alt}
              fill
              sizes="(max-width: 760px) 48vw, 270px"
              className="object-cover"
            />
            <div className={storyToplineClass}>
              <span>{story.category}</span>
              <span aria-hidden="true">0{index + 1}</span>
            </div>
            <div className={storyCaptionClass}>
              <p>{story.title}</p>
              <span>Different skills. Shared direction.</span>
            </div>
          </div>
        ))}
      </div>
      <div className={storyDotsClass} role="group" aria-label="Choose an image">
        {stories.map((story, index) => (
          <button
            key={story.image}
            type="button"
            aria-label={"Show " + story.category.toLowerCase()}
            aria-pressed={active === index}
            onClick={() =>
              setRotation((stories.length - index) % stories.length)
            }
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  )
}
