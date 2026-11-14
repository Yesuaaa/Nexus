"use client"

import { useId, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  MemberIdentity,
  type MemberIdentityData,
} from "@/components/ui/member-identity"
import {
  panelAssignButton,
  panelMuted,
  panelSecondaryButton,
} from "@/components/ui/panel-styles"
import { SearchField } from "@/components/ui/search-field"
import { cn } from "@/lib/utils"

type SelectionEmployee = MemberIdentityData & {
  id: string
  employeeId?: string
  position?: string | null
}

export function EmployeeSelection({
  employees,
  selectedIds,
  onChange,
  title,
  searchLabel,
  searchPlaceholder,
  listLabel,
  emptyMessage,
  noMatchesMessage,
  hideHeader = false,
  searchAction,
  beforeList,
  control = "checkbox",
  required = false,
  disabled = false,
}: {
  employees: readonly SelectionEmployee[]
  selectedIds: readonly string[]
  onChange: (ids: string[]) => void
  title: string
  searchLabel: string
  searchPlaceholder: string
  listLabel: string
  emptyMessage: string
  noMatchesMessage: string
  hideHeader?: boolean
  searchAction?: ReactNode
  beforeList?: ReactNode
  control?: "button" | "checkbox"
  required?: boolean
  disabled?: boolean
}) {
  const searchId = useId()
  const [search, setSearch] = useState("")
  const query = search.trim().toLowerCase()
  const filtered = employees.filter((employee) =>
    [
      employee.fullName,
      employee.email,
      employee.user?.fullName,
      employee.user?.email,
      employee.position,
      employee.employeeId,
    ].some((value) => value?.toLowerCase().includes(query)),
  )

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id],
    )
  }

  return (
    <div className="grid min-w-0 gap-2">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-xs font-medium text-foreground">
            {title}{" "}
            {required && (
              <span className="font-normal text-[#bc3649]">(required)</span>
            )}
          </p>
          <span className={panelMuted} role="status">
            {selectedIds.length} selected
          </span>
        </div>
      )}
      <SearchField
        id={searchId}
        label={searchLabel}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
        containerClassName="w-full max-[1050px]:w-full max-[1050px]:flex-none"
      />
      {filtered.length > 0 ? (
        <ul
          className="m-0 grid max-h-72 list-none gap-2 overflow-y-auto overscroll-contain p-0.5"
          aria-label={listLabel}
        >
          {filtered.map((employee) => {
            const selected = selectedIds.includes(employee.id)
            const name = employee.fullName || employee.email || "employee"
            const identity = (
              <MemberIdentity
                member={employee}
                secondaryText={employee.employeeId}
              />
            )
            const rowClass =
              "flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e8ebef] p-2.5"
            return (
              <li key={employee.id} className="min-w-0">
                {control === "checkbox" ? (
                  <label
                    className={cn(
                      rowClass,
                      "cursor-pointer transition-colors focus-within:border-[#294a9b] motion-reduce:transition-none",
                      selected
                        ? "border-[#c5d2ed] bg-[#f2f5fc]"
                        : "hover:bg-[#fafbfc]",
                      disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    {identity}
                    <Checkbox
                      aria-label={`Select ${name}`}
                      checked={selected}
                      onChange={() => toggle(employee.id)}
                      disabled={disabled}
                    />
                  </label>
                ) : (
                  <div className={rowClass}>
                    {identity}
                    <Button
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className={
                        selected ? panelAssignButton : panelSecondaryButton
                      }
                      aria-pressed={selected}
                      onClick={() => toggle(employee.id)}
                      disabled={disabled}
                    >
                      {selected ? "Added" : "Add"}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={`${panelMuted} m-0`}>
          {employees.length > 0 ? noMatchesMessage : emptyMessage}
        </p>
      )}
      {beforeList}
      {searchAction}
    </div>
  )
}
