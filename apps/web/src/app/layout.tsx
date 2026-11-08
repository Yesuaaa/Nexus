import type { Metadata } from "next"
import type { ReactNode } from "react"
import localFont from "next/font/local"
import { AuthProvider } from "@/features/auth/providers/auth-provider"
import "@fontsource-variable/inter/wght.css"
import "../index.css"

// Preload the existing local Latin font and use a metric-adjusted fallback.
// Fontsource's other Unicode subsets remain available for user-entered names.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  fallback: ["Inter Variable", "Arial"],
})

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
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
