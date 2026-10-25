import type { ReactNode } from "react"
import { PortalLayout } from "@/components/layout/portal-layout"

export default function Layout({ children }: { children: ReactNode }) {
  return <PortalLayout>{children}</PortalLayout>
}
