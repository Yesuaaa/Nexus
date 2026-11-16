export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"

export const iconButtonClass = `grid size-9 flex-none place-items-center rounded-lg border-0 bg-transparent text-[#667b9e] cursor-pointer hover:bg-[#e9eef5] hover:text-[#203a78] ${focusRing}`

// Fills the viewport below the global topbar: 8px gaps + 60px topbar
// (6px + 58px on phones).
export const contentClass =
  "mt-2 min-h-[calc(100dvh-84px)] rounded-[13px] border border-[#dedede] bg-background max-[767px]:mt-1.5 max-[767px]:min-h-[calc(100dvh-76px)]"
