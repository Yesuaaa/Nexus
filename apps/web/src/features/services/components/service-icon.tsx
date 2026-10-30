import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Clapperboard,
  CodeXml,
  Mail,
  Palette,
  Search,
  Share2,
  Sparkles,
} from "lucide-react"
import type { ServiceIconKey } from "../api/services-api"

export const serviceIconOptions: {
  value: ServiceIconKey
  label: string
}[] = [
  { value: "social", label: "Social & Community" },
  { value: "advertising", label: "Advertising & Marketing" },
  { value: "business", label: "Business & Support" },
  { value: "video", label: "Video & Media" },
  { value: "code", label: "Web & Development" },
  { value: "search", label: "Search & SEO" },
  { value: "email", label: "Email" },
  { value: "design", label: "Design & Creative" },
  { value: "sparkles", label: "General Service" },
]

export function ServiceIcon({
  iconKey,
  size = 28,
}: {
  iconKey: ServiceIconKey
  size?: number
}) {
  const props = { size, strokeWidth: 1.8, "aria-hidden": true } as const

  if (iconKey === "social") return <Share2 {...props} />
  if (iconKey === "advertising") return <BadgeDollarSign {...props} />
  if (iconKey === "business") return <BriefcaseBusiness {...props} />
  if (iconKey === "video") return <Clapperboard {...props} />
  if (iconKey === "code") return <CodeXml {...props} />
  if (iconKey === "search") return <Search {...props} />
  if (iconKey === "email") return <Mail {...props} />
  if (iconKey === "design") return <Palette {...props} />
  return <Sparkles {...props} />
}
