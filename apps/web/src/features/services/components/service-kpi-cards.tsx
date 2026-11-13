import { CircleOff, Package, Radio } from "lucide-react"
import {
  ProgressMeter,
  SegmentMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"
import type { Service } from "../api/services-api"

function share(value: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((value / total) * 100)}%`
}

export function ServiceKpiCards({
  services,
  loading,
  unavailable,
}: {
  services: Service[]
  loading: boolean
  unavailable: boolean
}) {
  const total = services.length
  const active = services.filter((service) => service.isActive).length
  const inactive = total - active
  const empty = total === 0

  const items: StatStripItem[] = [
    {
      label: "Services",
      value: total.toLocaleString("en-US"),
      caption: empty ? "No services yet" : "Services in the catalog",
      icon: Package,
      tone: "bg-[#e8eef8] text-[#284f9e]",
      meter: (
        <SegmentMeter
          label="Service status breakdown"
          segments={[
            { label: "Active", value: active, colorClass: "bg-[#29906b]" },
            { label: "Inactive", value: inactive, colorClass: "bg-[#c94a6a]" },
          ]}
        />
      ),
    },
    {
      label: "Active",
      value: active.toLocaleString("en-US"),
      caption: empty
        ? "—"
        : `${share(active, total)} available for new requests`,
      captionTone: active > 0 ? "text-[#25745b]" : undefined,
      icon: Radio,
      tone: "bg-[#e6f4ee] text-[#25745b]",
      meter: (
        <ProgressMeter
          value={active}
          max={total}
          label="Active services"
          colorClass="bg-[#29906b]"
        />
      ),
    },
    {
      label: "Inactive",
      value: inactive.toLocaleString("en-US"),
      caption:
        inactive === 0 ? "None inactive" : "Unavailable for new requests",
      captionTone: inactive > 0 ? "text-[#b4234d]" : undefined,
      icon: CircleOff,
      tone: "bg-[#fbe9ee] text-[#b4234d]",
      meter: (
        <ProgressMeter
          value={inactive}
          max={total}
          label="Inactive services"
          colorClass="bg-[#c94a6a]"
        />
      ),
    },
  ]

  return (
    <StatStrip
      items={items}
      label="Service overview"
      pending={loading && empty}
      unavailable={unavailable && empty}
      className="grid-cols-3 max-[1050px]:grid-cols-3 max-[760px]:grid-cols-1"
    />
  )
}
