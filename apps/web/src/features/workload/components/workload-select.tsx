import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function WorkloadSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(next) => onChange(next === "all" ? "" : next)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-[34px] w-[155px] flex-none border-[#e1e4ea] text-xs shadow-none max-[560px]:w-full",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value || "all"} value={option.value || "all"}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
