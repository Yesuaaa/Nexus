import { notFound } from "next/navigation"
import { AuthLoaderPreview } from "@/features/auth/components/auth-loader-preview"

export default function LogoRevealPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return <AuthLoaderPreview />
}
