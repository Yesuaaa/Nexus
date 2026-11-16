export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"

export const iconButtonClass = `grid size-9 flex-none place-items-center rounded-lg border-0 bg-transparent text-[#667b9e] cursor-pointer hover:bg-[#e9eef5] hover:text-[#203a78] ${focusRing}`

export const sidebarRowClass =
  "flex h-9 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left text-[13px] font-medium whitespace-nowrap text-[#3b4658] no-underline transition-colors duration-150 hover:bg-[#f3f5f8] hover:text-[#182235] motion-reduce:transition-none"
export const sidebarActiveRowClass =
  "bg-[#eef2f9] font-semibold text-[#203f8c] hover:bg-[#eef2f9] hover:text-[#203f8c]"
/** Icon-only square in the collapsed desktop sidebar (full row in the drawer). */
export const sidebarCollapsedRowClass =
  "size-10 justify-center justify-self-center gap-0 p-0 max-[767px]:h-9 max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-2.5 max-[767px]:px-2.5"
export const sidebarNavLinkClass = `group relative ${sidebarRowClass} ${focusRing}`

// Fills the viewport below the global topbar: 8px gaps + 60px topbar
// (6px + 58px on phones).
export const contentClass =
  "mt-2 min-h-[calc(100dvh-84px)] rounded-[13px] border border-[#dedede] bg-background max-[767px]:mt-1.5 max-[767px]:min-h-[calc(100dvh-76px)]"
