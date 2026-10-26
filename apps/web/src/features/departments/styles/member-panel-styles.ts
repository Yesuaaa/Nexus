import { focusRing } from "@/components/layout/styles"

const button =
  "h-[34px] flex-none cursor-pointer rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed"

export const panelPrimaryButton = `${button} bg-[#0b0b0c] text-white hover:bg-[#2a2a2e] ${focusRing}`
export const panelAssignButton = `${button} bg-[#203f8c] text-white hover:bg-[#172f70] ${focusRing}`
export const panelSecondaryButton = `${button} border-[#e1e4ea] text-foreground hover:bg-[#f1f5fc] ${focusRing}`
export const panelIconButton = `group relative grid size-8 flex-none cursor-pointer place-items-center rounded-[7px] border border-[#e1e4ea] bg-background text-[#65718a] hover:bg-[#f1f5fc] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`
export const panelDangerButton = `group relative grid size-8 flex-none cursor-pointer place-items-center rounded-[7px] border border-[#bc3649] bg-[#bc3649] text-white hover:border-[#a72d3f] hover:bg-[#a72d3f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`
export const panelInput = `h-[34px] min-w-0 rounded-lg border-[#e1e4ea] bg-background px-[11px] text-xs shadow-none placeholder:text-[#8a9ab1] focus-visible:ring-0 md:text-xs ${focusRing}`
export const panelSelectTrigger = `h-[34px] min-w-0 rounded-lg border-[#e1e4ea] bg-background px-[11px] text-xs text-foreground shadow-none data-[placeholder]:text-foreground [&>span]:truncate ${focusRing}`
export const panelField =
  "grid min-w-0 gap-[7px] text-xs font-medium text-foreground"
export const panelMuted = "text-[11px] leading-[1.5] text-[#738096]"
export const panelEmpty =
  "grid min-h-[120px] place-content-center gap-2 p-5 text-center text-xs text-[#7183a2]"
