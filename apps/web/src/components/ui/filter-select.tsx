"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type FilterSelectOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

/**
 * Toolbar row for a search field followed by filter selects. On phones it
 * becomes a two-column grid: the first item (the search) spans the row,
 * selects pair up, and a lone last item spans the row, instead of every
 * control taking a full-width row of its own.
 */
export const filterBarClass =
  "flex flex-wrap items-center gap-2.5 max-[560px]:grid max-[560px]:grid-cols-2 max-[560px]:gap-2 max-[560px]:[&>*:first-child]:col-span-2 max-[560px]:[&>*:last-child:nth-child(even)]:col-span-2"

/** Selects-only variant: pairs up on phones, a lone last item spans the row. */
export const filterGridClass =
  "flex flex-wrap items-center gap-2 max-[560px]:grid max-[560px]:grid-cols-2 max-[560px]:[&>*:last-child:nth-child(odd)]:col-span-2"

/** Toolbar filter/sort trigger: 34px tall (44px on phones), full width on phones. */
export const filterSelectTriggerClass =
  "h-[34px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"

/**
 * Select for table toolbars and simple forms. Unlike the Radix primitive it
 * accepts an empty-string value (e.g. `{ value: "", label: "All statuses" }`),
 * so callers don't need an `"all"` placeholder value. Same API as `Dropdown`.
 *
 *   <FilterSelect label="Filter by status" value={status} onChange={setStatus}
 *     options={[{ value: "", label: "All Statuses" }, …]} triggerClassName="w-[150px]" />
 */
export function FilterSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  announceValue = false,
  placeholder,
  disabled = false,
  align = "left",
  className,
  triggerClassName,
  menuClassName,
}: {
  value: T
  options: FilterSelectOption<T>[]
  onChange: (value: T) => void
  /** Accessible name of the trigger, e.g. "Filter by status". */
  label: string
  /** Name the trigger "Label: Selected option" instead of just "Label". */
  announceValue?: boolean
  /** Shown when `value` matches no option. */
  placeholder?: string
  disabled?: boolean
  align?: "left" | "right"
  /** Wrapper classes (layout). */
  className?: string
  /** Trigger classes, e.g. a width. Merged over the standard toolbar style. */
  triggerClassName?: string
  menuClassName?: string
}) {
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = options[selectedIndex]
  // Radix Select reserves "" for "no value", so options are keyed by index.
  const internalValue = selectedIndex >= 0 ? `option-${selectedIndex}` : ""

  return (
    <div
      className={cn("relative min-w-0 flex-none max-[560px]:w-full", className)}
    >
      <Select
        value={internalValue}
        disabled={disabled}
        onValueChange={(next) => {
          const option = options[Number(next.replace("option-", ""))]
          if (option) onChange(option.value)
        }}
      >
        <SelectTrigger
          className={cn(filterSelectTriggerClass, triggerClassName)}
          aria-label={
            announceValue ? `${label}: ${selected?.label ?? ""}` : label
          }
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          align={align === "right" ? "end" : "start"}
          className={menuClassName}
        >
          {options.map((option, index) => (
            <SelectItem
              key={option.value || `option-${index}`}
              value={`option-${index}`}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
