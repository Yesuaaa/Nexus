import type { Metadata } from "next"
import { PublicServicesShell } from "@/features/public-services/components/public-services-shell"

export const metadata: Metadata = { title: "Projects | Converyn" }

export default function PublicProjectsPage() {
  return (
    <PublicServicesShell>
      <h1>Projects</h1>
      <p>Projects are coming soon.</p>
    </PublicServicesShell>
  )
}
