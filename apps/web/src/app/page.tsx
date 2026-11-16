import type { Metadata } from "next"
import { LandingPage } from "@/features/landing/components/landing-page"

export const metadata: Metadata = {
  title: "Converyn | Your next idea. Made possible.",
  description:
    "Connect your next idea with creative thinking, digital marketing, and web expertise. Discover a new direction with Converyn.",
  icons: { icon: [] },
}

export default function HomePage() {
  return <LandingPage />
}
