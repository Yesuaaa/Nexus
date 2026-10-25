export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"

export const iconButtonClass = `grid size-9 flex-none place-items-center rounded-lg border-0 bg-transparent text-[#667b9e] cursor-pointer hover:bg-[#e9eef5] hover:text-[#203a78] ${focusRing}`

export const collapsedTooltipClass =
  "pointer-events-none invisible absolute top-1/2 left-[calc(100%+10px)] z-50 -translate-y-1/2 translate-x-1 rounded-md border border-[#242d3d] bg-[#070f1f] px-2.5 py-1.5 text-[11px] leading-none font-medium tracking-[0.01em] text-[#fafafa] opacity-0 shadow-[0_6px_18px_rgb(7_15_31_/_18%)] transition-[opacity,transform,visibility] duration-150 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:visible group-focus-visible:translate-x-0 group-focus-visible:opacity-100 max-[767px]:hidden motion-reduce:transition-none"

export const contentClass =
  "mt-4 min-h-[calc(100dvh-116px)] rounded-[13px] border border-[#dedede] bg-background max-[767px]:mt-3 max-[767px]:min-h-[calc(100dvh-98px)]"
