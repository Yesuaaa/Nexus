import { Check } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { Pill } from "@/components/ui/pill"
import type { DepartmentColor } from "@/features/departments/model/department-color"
import { cn } from "@/lib/utils"

export const departmentColors = [
  {
    value: "blue",
    label: "Blue",
    pill: "bg-[#dbe8ff] text-[#2b4a8b]",
    swatch: "bg-[#5b8def]",
  },
  {
    value: "violet",
    label: "Violet",
    pill: "bg-[#ece5ff] text-[#5b3fb0]",
    swatch: "bg-[#8b6cf0]",
  },
  {
    value: "pink",
    label: "Pink",
    pill: "bg-[#fde4f1] text-[#a1286b]",
    swatch: "bg-[#e65aa8]",
  },
  {
    value: "orange",
    label: "Orange",
    pill: "bg-[#ffe9d6] text-[#a4500f]",
    swatch: "bg-[#f08a3c]",
  },
  {
    value: "teal",
    label: "Teal",
    pill: "bg-[#d9f3f0] text-[#14716a]",
    swatch: "bg-[#2bb3a6]",
  },
  {
    value: "amber",
    label: "Yellow",
    pill: "bg-[#fff1c9] text-[#8a6100]",
    swatch: "bg-[#e5b025]",
  },
  {
    value: "slate",
    label: "Slate",
    pill: "bg-[#e6eaf0] text-[#44546b]",
    swatch: "bg-[#8494ab]",
  },
  {
    value: "green",
    label: "Green",
    pill: "bg-[#dcf3e1] text-[#1f6b35]",
    swatch: "bg-[#3eb35f]",
  },
  {
    value: "red",
    label: "Red",
    pill: "bg-[#fde1e1] text-[#a3262b]",
    swatch: "bg-[#e5484d]",
  },
  {
    value: "brown",
    label: "Brown",
    pill: "bg-[#efe4dc] text-[#6b4430]",
    swatch: "bg-[#a8785a]",
  },
  {
    value: "cyan",
    label: "Cyan",
    pill: "bg-[#d6f1fa] text-[#0e6f8a]",
    swatch: "bg-[#2fb6dc]",
  },
] as const

const presetColors: Record<string, DepartmentColor> = {
  administration: "blue",
}

function nameKey(name: string) {
  return name.trim().toLowerCase()
}

export function autoDepartmentColor(name: string): DepartmentColor {
  const key = nameKey(name)
  const preset = presetColors[key]
  if (preset) return preset
  const pool = departmentColors.filter((item) => item.value !== "blue")
  let hash = 0
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return pool[hash % pool.length].value
}

export function resolveDepartmentColor(
  color: string | null | undefined,
  name: string,
) {
  const found = departmentColors.find((item) => item.value === color)
  if (found) return found
  const auto = autoDepartmentColor(name)
  return (
    departmentColors.find((item) => item.value === auto) ?? departmentColors[0]
  )
}

type DepartmentLike = { id: string; name: string; color?: string | null }

export function getDepartmentColorValue(department: DepartmentLike) {
  return resolveDepartmentColor(department.color, department.name).value
}

export function DepartmentPill({
  department,
  className,
}: {
  department: DepartmentLike
  className?: string
}) {
  const color = resolveDepartmentColor(department.color, department.name)
  return (
    <Pill className={cn(color.pill, className)} title={department.name}>
      {department.name}
    </Pill>
  )
}

export function DepartmentColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: DepartmentColor) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Department color"
      className="flex flex-wrap gap-2"
    >
      {departmentColors.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={item.label}
            title={item.label}
            disabled={disabled}
            className={cn(
              "grid size-7 cursor-pointer place-items-center rounded-full border-2 border-transparent disabled:cursor-not-allowed disabled:opacity-50",
              item.swatch,
              selected && "border-white ring-2 ring-[#203f8c]",
              focusRing,
            )}
            onClick={() => onChange(item.value)}
          >
            {selected && (
              <Check size={14} className="text-white" aria-hidden="true" />
            )}
          </button>
        )
      })}
    </div>
  )
}
