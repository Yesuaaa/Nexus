import { useId, type ComponentProps, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Switch } from "./switch"

export function SettingsSection({
  title,
  description,
  tone = "neutral",
  className,
  children,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  title: string
  description?: string
  tone?: "neutral" | "tinted"
}) {
  const headingId = useId()
  return (
    <section
      {...props}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 rounded-xl border border-[#dfe6f0] p-5 focus-visible:outline-2 focus-visible:outline-[#294a9b]",
        tone === "tinted" && "bg-[#f8faff]",
        className,
      )}
    >
      <h2 id={headingId} className="m-0 text-base font-semibold">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-xs leading-5 text-[#738096]">{description}</p>
      )}
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  )
}

export function SettingsSwitchRow({
  label,
  description,
  ...props
}: ComponentProps<typeof Switch> & { label: string; description: ReactNode }) {
  return (
    <label className="flex min-w-0 cursor-pointer items-start justify-between gap-5 border-t border-[#e1e6ee] py-4 last:pb-0">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#738096]">
          {description}
        </span>
      </span>
      <Switch {...props} aria-label={label} />
    </label>
  )
}
