import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import type { AuthCopy } from "../content/auth-copy"
import { focusOutline, heroTitleClass } from "../styles/auth-styles"
import type { AuthLanguage, AuthMode } from "../model/types"

const photos = [
  "/auth/community-1.png",
  "/auth/community-2.png",
  "/auth/community-3.png",
]

export function PhotoPanel({
  mode,
  copy,
  language,
}: {
  mode: AuthMode
  copy: AuthCopy
  language: AuthLanguage
}) {
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()
  const responsiveHeroTitleClass =
    language === "fil"
      ? "max-[1100px]:text-[clamp(32px,3.6vw,46px)]"
      : "max-[1100px]:text-[clamp(39px,4.3vw,56px)]"

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % photos.length),
      6000,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside
      className="relative h-svh min-h-0 overflow-hidden rounded-r-[26px] bg-[#173456] max-[850px]:hidden"
      aria-label={copy.community}
    >
      {photos.map((src, index) => (
        <img
          key={src}
          className={`absolute inset-0 size-full object-cover object-center transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${index === active ? "opacity-100" : "opacity-0"}`}
          src={src}
          alt=""
          aria-hidden="true"
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(10_30_52_/_77%)_0%,rgb(13_39_67_/_49%)_60%,rgb(12_45_77_/_38%)_100%),linear-gradient(0deg,rgb(5_31_56_/_48%),transparent_55%)]" />
      <motion.div
        key={mode}
        className="absolute z-1 top-[37%] left-[clamp(42px,6.2%,90px)] w-[min(83%,650px)] text-white"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {mode === "login" ? (
          <>
            <h1 className={`${heroTitleClass} ${responsiveHeroTitleClass}`}>
              {copy.loginHeroLine1}
              <br />
              <span className="bg-linear-to-r from-[#0989e5] to-[#23cae0] bg-clip-text text-transparent">
                {copy.loginHeroLine2}
              </span>
              <br />
              {copy.loginHeroLine3}
            </h1>
            <p className="mt-[22px] max-w-[560px] text-[clamp(16px,1.04vw,20px)] leading-[1.32]">
              {copy.loginHeroDescription}
            </p>
          </>
        ) : (
          <>
            <h1 className={`${heroTitleClass} ${responsiveHeroTitleClass}`}>
              {copy.registerHeroLine1}
              <br />
              <span className="bg-linear-to-r from-[#0989e5] to-[#23cae0] bg-clip-text text-transparent">
                {copy.registerHeroLine2}
              </span>
              <br />
              {copy.registerHeroLine3}
            </h1>
            <p className="mt-[22px] max-w-[560px] text-[clamp(16px,1.04vw,20px)] leading-[1.32]">
              {copy.registerHeroDescription}
            </p>
          </>
        )}
      </motion.div>
      <div
        className="absolute right-8 bottom-5 z-2 flex items-center gap-2"
        aria-label={copy.choosePhoto}
      >
        {photos.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`size-[7px] cursor-pointer rounded-full border-0 p-0 ${index === active ? "bg-[#2ed9e7] opacity-100" : "bg-white opacity-90"} ${focusOutline}`}
            onClick={() => setActive(index)}
            aria-label={`${copy.showPhoto} ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
          />
        ))}
      </div>
    </aside>
  )
}
