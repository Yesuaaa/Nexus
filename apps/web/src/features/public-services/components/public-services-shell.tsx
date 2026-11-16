import type { ReactNode } from "react"
import {
  LandingHeader,
  LandingMotion,
} from "@/features/landing/components/landing-interactions"
import { LandingFooter } from "@/features/landing/components/landing-footer"
import styles from "./public-services.module.css"

export function PublicServicesShell({ children }: { children: ReactNode }) {
  return (
    <LandingMotion>
      <a href="#public-main" className={styles.skipLink}>
        Skip to content
      </a>
      <LandingHeader />
      <main id="public-main" className={styles.main}>
        {children}
      </main>
      <LandingFooter />
    </LandingMotion>
  )
}
