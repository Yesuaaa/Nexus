import { getImageProps } from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import type { AuthCopy } from "../content/auth-copy"
import { focusOutline, heroTitleClass } from "../styles/auth-styles"
import type { AuthLanguage, AuthMode, AuthPortal } from "../model/types"
import { Brand } from "./auth-fields"

const photos = [
  { src: "/auth/community-1.webp", width: 1672, height: 941 },
  { src: "/auth/community-2.webp", width: 1672, height: 941 },
  { src: "/auth/community-3.webp", width: 1983, height: 793 },
]

const desktopMedia = "(min-width: 850px)"
const transparentPixel =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="

function getPhotoProps(index: number) {
  const photo = photos[index]
  // object-cover must fill the panel's height as well as its width.
  const coverWidth = `${(photo.width / photo.height) * 100}svh`
  return getImageProps({
    fill: true,
    src: photo.src,
    alt: "",
    sizes: `(width < 1100px) max(52vw, ${coverWidth}), max(57vw, ${coverWidth})`,
    quality: 70,
    loading: "eager",
    fetchPriority: index === 0 ? "high" : "auto",
  }).props
}

export function PhotoPanel({
  mode,
  portal,
  copy,
  language,
}: {
  mode: AuthMode
  portal: AuthPortal
  copy: AuthCopy
  language: AuthLanguage
}) {
  const [{ active, previous }, setSlide] = useState<{
    active: number
    previous: number | null
  }>({ active: 0, previous: null })
  const responsiveHeroTitleClass =
    language === "fil"
      ? "max-[1100px]:text-[clamp(32px,3.6vw,46px)]"
      : "max-[1100px]:text-[clamp(39px,4.3vw,56px)]"

  useEffect(() => {
    const desktop = window.matchMedia(desktopMedia)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let timer: ReturnType<typeof setInterval> | undefined
    function update() {
      clearInterval(timer)
      if (!desktop.matches || reduced.matches) return
      timer = setInterval(() => {
        if (document.visibilityState === "visible")
          setSlide((current) => ({
            active: (current.active + 1) % photos.length,
            previous: current.active,
          }))
      }, 6000)
    }
    update()
    desktop.addEventListener("change", update)
    reduced.addEventListener("change", update)
    return () => {
      clearInterval(timer)
      desktop.removeEventListener("change", update)
      reduced.removeEventListener("change", update)
    }
  }, [])

  if (portal === "client") {
    const slides =
      language === "fil"
        ? [
            {
              word: "Talakayin.",
              title: "Lahat ng usapan sa proyekto",
              accent: "sa iisang thread.",
              description:
                "Panatilihing organisado ang mga kinakailangan, feedback, at kahilingan sa chat.",
            },
            {
              word: "Presyo.",
              title: "Mabilis na quotation",
              accent: "sa loob ng iyong chat.",
              description:
                "Suriin ang presyo, saklaw, at timeline nang hindi umaalis sa usapan.",
            },
            {
              word: "Aprubahan.",
              title: "Mga real-time na update",
              accent: "at malinaw na pananagutan.",
              description:
                "Subaybayan ang mga deliverable, miyembro ng team, at milestone sa real time.",
            },
          ]
        : [
            {
              word: "Discuss.",
              title: "All project discussions",
              accent: "in one focused thread.",
              description:
                "Keep requirements, feedback, and service requests organized directly inside chat.",
            },
            {
              word: "Quote.",
              title: "Instant quotations",
              accent: "built inside your chat.",
              description:
                "Review itemized pricing, scope breakdowns, and timelines without leaving the conversation.",
            },
            {
              word: "Approve.",
              title: "Real-time updates",
              accent: "and clear accountability.",
              description:
                "Track active deliverables, assigned squad members, and milestone logs in real time.",
            },
          ]
    const slide = slides[active]
    return (
      <aside
        className="flex h-full min-h-0 flex-col overflow-y-auto border-r border-[#dedede] bg-[#203f8c] bg-[linear-gradient(to_right,rgb(255_255_255_/_0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255_/_0.05)_1px,transparent_1px)] bg-size-[48px_48px] px-12 py-12 max-[850px]:hidden"
        aria-label={copy.community}
      >
        <div className="flex h-9 items-center">
          <Link href="/" aria-label="Converyn home" data-auth-home-link>
            <Brand white className="" />
          </Link>
        </div>
        <div className="flex flex-1 flex-col justify-center py-12">
          <h1 className="text-[clamp(54px,6vw,88px)] leading-[0.92] font-extrabold tracking-[-0.055em] uppercase">
            {slides.map((item, index) => (
              <span
                key={item.word}
                className={`block transition-colors ${index === active ? "text-white" : "text-[#6e87b9]"}`}
              >
                {item.word}
              </span>
            ))}
          </h1>
        </div>
        <div>
          <h2 className="text-[28px] leading-tight font-bold tracking-[-0.03em] text-white">
            {slide.title}
            <br />
            <span className="text-[#aabce0]">{slide.accent}</span>
          </h2>
          <p className="mt-4 max-w-[520px] text-sm leading-snug text-[#bbcbe6]">
            {slide.description}
          </p>
          <div
            className="mt-5 flex flex-wrap items-center gap-5 border-t border-white/20 pt-5 font-mono text-[11px] font-bold tracking-[0.1em] uppercase"
            aria-label={copy.choosePhoto}
          >
            {slides.map((item, index) => (
              <span key={item.word} className="flex items-center gap-5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-[#6e87b9]">
                    /
                  </span>
                )}
                <button
                  type="button"
                  className={`cursor-pointer uppercase ${index === active ? "text-white" : "text-[#aabce0]"} ${focusOutline}`}
                  onClick={() =>
                    setSlide((current) => ({
                      active: index,
                      previous: current.active,
                    }))
                  }
                  aria-current={index === active ? "true" : undefined}
                >
                  {String(index + 1).padStart(2, "0")}{" "}
                  {item.word.replace(".", "")}
                </button>
              </span>
            ))}
          </div>
        </div>
      </aside>
    )
  }

  const image = getPhotoProps(active)

  return (
    <aside
      className="relative h-svh min-h-0 overflow-hidden rounded-r-[26px] bg-[#173456] max-[850px]:hidden"
      aria-label={copy.community}
    >
      {active === 0 && (
        <link
          rel="preload"
          as="image"
          media={desktopMedia}
          imageSrcSet={image.srcSet}
          imageSizes={image.sizes}
          fetchPriority="high"
        />
      )}
      {previous !== null && <AuthPhoto index={previous} />}
      <AuthPhoto key={active} index={active} animate={previous !== null} />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(10_30_52_/_77%)_0%,rgb(13_39_67_/_49%)_60%,rgb(12_45_77_/_38%)_100%),linear-gradient(0deg,rgb(5_31_56_/_48%),transparent_55%)]" />
      <div
        key={`${portal}-${mode}`}
        className="auth-hero-enter absolute z-1 top-[37%] left-[clamp(42px,6.2%,90px)] w-[min(83%,650px)] text-white"
      >
        {mode === "login" ? (
          <>
            <h1 className={`${heroTitleClass} ${responsiveHeroTitleClass}`}>
              {portal === "workforce"
                ? copy.workforceHeroLine1
                : copy.loginHeroLine1}
              <br />
              <span className="bg-linear-to-r from-[#0989e5] to-[#23cae0] bg-clip-text text-transparent">
                {portal === "workforce"
                  ? copy.workforceHeroLine2
                  : copy.loginHeroLine2}
              </span>
              <br />
              {portal === "workforce"
                ? copy.workforceHeroLine3
                : copy.loginHeroLine3}
            </h1>
            <p className="mt-[22px] max-w-[560px] text-[clamp(16px,1.04vw,20px)] leading-[1.32]">
              {portal === "workforce"
                ? copy.workforceHeroDescription
                : copy.loginHeroDescription}
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
      </div>
      <div
        className="absolute right-8 bottom-5 z-2 flex items-center gap-2"
        aria-label={copy.choosePhoto}
      >
        {photos.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`size-[7px] cursor-pointer rounded-full border-0 p-0 ${index === active ? "bg-[#2ed9e7] opacity-100" : "bg-white opacity-90"} ${focusOutline}`}
            onClick={() =>
              setSlide((current) =>
                current.active === index
                  ? current
                  : { active: index, previous: current.active },
              )
            }
            aria-label={`${copy.showPhoto} ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
          />
        ))}
      </div>
    </aside>
  )
}

function AuthPhoto({
  index,
  animate = false,
}: {
  index: number
  animate?: boolean
}) {
  const props = getPhotoProps(index)
  return (
    <picture
      className={
        animate ? "auth-photo-enter absolute inset-0" : "absolute inset-0"
      }
    >
      <source media={desktopMedia} srcSet={props.srcSet} sizes={props.sizes} />
      <img
        {...props}
        src={transparentPixel}
        srcSet={undefined}
        aria-hidden="true"
        className="object-cover object-center"
      />
    </picture>
  )
}
