"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import styles from "./landing.module.css"

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
      className={styles.aboutStories}
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
      <div className={styles.storyStage}>
        {stories.map((story, index) => (
          <div
            className={styles.storyCard}
            key={story.image}
            data-position={positions[(index + rotation) % stories.length]}
          >
            <Image
              src={story.image}
              alt={story.alt}
              fill
              sizes="(max-width: 760px) 48vw, 270px"
              className={styles.coverImage}
            />
            <div className={styles.storyTopline}>
              <span>{story.category}</span>
              <span aria-hidden="true">0{index + 1}</span>
            </div>
            <div className={styles.storyCaption}>
              <p>{story.title}</p>
              <span>Different skills. Shared direction.</span>
            </div>
          </div>
        ))}
      </div>
      <div
        className={styles.storyDots}
        role="group"
        aria-label="Choose an image"
      >
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
