import { getImageProps } from "next/image"
import { useEffect, useState } from "react"
import type { AuthCopy } from "../content/auth-copy"
import { focusOutline, heroTitleClass } from "../styles/auth-styles"
import type { AuthLanguage, AuthMode } from "../model/types"

const photos = [
  { src: "/auth/community-1.png", width: 1672, height: 941 },
  { src: "/auth/community-2.png", width: 1672, height: 941 },
  { src: "/auth/community-3.png", width: 1983, height: 793 },
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
  copy,
  language,
}: {
  mode: AuthMode
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
        key={mode}
        className="auth-hero-enter absolute z-1 top-[37%] left-[clamp(42px,6.2%,90px)] w-[min(83%,650px)] text-white"
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
