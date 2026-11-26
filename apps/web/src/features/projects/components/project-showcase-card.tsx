"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

type Project = { name: string; type: string; image: string }

export function ProjectShowcaseCard({
  project,
  number,
  aspect,
}: {
  project: Project
  number: number
  aspect: "wide" | "tall"
}) {
  const cardRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  })
  const imageScale = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [1, 1] : [1.15, 1],
  )

  return (
    <article
      ref={cardRef}
      className={`group relative overflow-hidden rounded-md bg-[#203f8c] text-white ${aspect === "wide" ? "aspect-[1.4]" : "aspect-[0.82]"}`}
    >
      <motion.img
        src={project.image}
        alt=""
        style={{ scale: imageScale, transformOrigin: "center" }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40" />
      <span className="absolute top-6 left-6 text-sm font-semibold">
        NÂ° â€” {String(number).padStart(2, "0")}
      </span>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <h3 className="!text-[clamp(24px,3vw,42px)] !font-semibold !tracking-[-0.04em]">
          {project.name}
        </h3>
        <p className="mt-2 text-sm text-white/85">{project.type}</p>
      </div>
    </article>
  )
}
