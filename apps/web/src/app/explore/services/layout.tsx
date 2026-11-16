import type { Metadata } from "next"
import type { ReactNode } from "react"
import { PublicServicesShell } from "@/features/public-services/components/public-services-shell"

export const metadata: Metadata = {
  title: { default: "Services | Converyn", template: "%s | Converyn" },
  description:
    "Explore Converyn services and start a conversation about your next project. No account or booking required.",
  icons: { icon: [] },
}

export default function Layout({ children }: { children: ReactNode }) {
  return <PublicServicesShell>{children}</PublicServicesShell>
}
