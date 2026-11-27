import type { Metadata } from "next"
import { LandingPage } from "@/features/landing/components/landing-page"
import { listPublicProjects } from "@/features/projects/api/project-showcase.server"

export const metadata: Metadata = {
  title: "Converyn | Your next idea. Made possible.",
  description:
    "Connect your next idea with creative thinking, digital marketing, and web expertise. Discover a new direction with Converyn.",
}

export default async function HomePage() {
  return <LandingPage projects={(await listPublicProjects(true)) ?? []} />
}
