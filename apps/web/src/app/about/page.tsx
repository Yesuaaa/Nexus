import type { Metadata } from "next"
import { PublicServicesShell } from "@/features/public-services/components/public-services-shell"

export const metadata: Metadata = { title: "About | Converyn" }

export default function AboutPage() {
  return (
    <PublicServicesShell>
      <h1>About</h1>
      <p>More about Converyn is coming soon.</p>
    </PublicServicesShell>
  )
}
