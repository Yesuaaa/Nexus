import type { ReactNode } from "react"
import localFont from "next/font/local"
import {
  LandingHeader,
  LandingMotion,
} from "@/features/landing/components/landing-interactions"
import { LandingFooter } from "@/features/landing/components/landing-footer"
import { LandingSmoothScroll } from "@/features/landing/components/landing-smooth-scroll"
import styles from "./public-services.module.css"

const sora = localFont({
  src: "../../../../public/font/Sora/Sora-VariableFont_wght.ttf",
  variable: "--font-public-heading",
  display: "swap",
})

export function PublicServicesShell({ children }: { children: ReactNode }) {
  return (
    <LandingMotion>
      <LandingSmoothScroll />
      <a href="#public-main" className={styles.skipLink}>
        Skip to content
      </a>
      <LandingHeader />
      <main
        id="public-main"
        className={`${styles.main} ${sora.variable} !max-w-[1360px] !px-12 max-[1101px]:!px-8 max-[761px]:!px-6 [&_h1]:[font-family:var(--font-public-heading),sans-serif] [&_h2]:[font-family:var(--font-public-heading),sans-serif] [&_h3]:[font-family:var(--font-public-heading),sans-serif]`}
      >
        {children}
      </main>
      <LandingFooter />
    </LandingMotion>
  )
}
