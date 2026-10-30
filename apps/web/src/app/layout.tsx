import type { Metadata } from "next"
import type { ReactNode } from "react"
import { AuthProvider } from "@/features/auth/providers/auth-provider"
import "@fontsource-variable/inter/wght.css"
import "sileo/styles.css"
import "../index.css"

export const metadata: Metadata = {
  title: "EXP Digital Solutions",
  description: "Sign in or create your EXP account.",
  icons: {
    icon: "/favicon.svg",
  },
}

export const dynamic = "force-dynamic"

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
