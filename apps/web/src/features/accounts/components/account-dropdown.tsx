"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type AccountDropdownOption<T extends string> = {
  value: T
  label: string
}

export function AccountDropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  align = "left",
  className = "",
  triggerClassName = "",
  menuClassName = "",
}: {
  value: T
  options: AccountDropdownOption<T>[]
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  align?: "left" | "right"
  className?: string
  triggerClassName?: string
  menuClassName?: string
}) {
  const selectedOption = options.find((option) => option.value === value)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const internalValue =
    selectedIndex >= 0 ? `account-option-${selectedIndex}` : undefined

  return (
    <div className={cn("relative min-w-0", className)}>
      <Select
        value={internalValue}
        disabled={disabled}
        onValueChange={(nextValue) => {
          const nextIndex = Number(nextValue.replace("account-option-", ""))
          const nextOption = options[nextIndex]
          if (nextOption) onChange(nextOption.value)
        }}
      >
        <SelectTrigger
          className={triggerClassName}
          aria-label={`${label}: ${selectedOption?.label ?? ""}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          align={align === "right" ? "end" : "start"}
          className={menuClassName}
        >
          {options.map((option, index) => (
            <SelectItem key={option.value} value={`account-option-${index}`}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
