"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

export function ProjectScrollImage({
  src,
  sizes = "(max-width: 761px) 100vw, 33vw",
}: {
  src: string
  sizes?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [1, 1] : [1.15, 1],
  )

  return (
    <motion.div ref={ref} className="absolute inset-0" style={{ scale }}>
      <Image
        src={src}
        unoptimized={src.startsWith("https://")}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
      />
    </motion.div>
  )
}
