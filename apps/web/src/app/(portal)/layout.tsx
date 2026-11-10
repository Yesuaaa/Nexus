import type { ReactNode } from "react"
import { PortalLayout } from "@/components/layout/portal-layout"
import "./portal.css"

export default function Layout({ children }: { children: ReactNode }) {
  return <PortalLayout>{children}</PortalLayout>
}
