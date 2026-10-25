export const accountFocusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b]"

export const accountButton = `inline-flex min-h-[38px] items-center justify-center gap-[7px] rounded-[9px] border border-transparent px-[15px] font-semibold leading-[1.2] whitespace-nowrap cursor-pointer transition-[background-color,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${accountFocusRing}`

export const accountButtonPrimary =
  "bg-[#203f8c] text-white hover:enabled:bg-[#172f70]"

export const accountButtonSecondary =
  "border-[#d7e0ee] bg-background text-[#24437e] hover:enabled:bg-[#f1f5fc]"

export const accountGrid =
  "grid grid-cols-[minmax(200px,1.7fr)_minmax(100px,0.8fr)_minmax(120px,1fr)_minmax(205px,1.2fr)] items-center gap-4 @max-[720px]:grid-cols-[minmax(0,1fr)_auto] @max-[530px]:grid-cols-[minmax(0,1fr)]"

export const accountField =
  "grid min-w-0 gap-[7px] [&>span]:text-xs [&>span]:font-[650] [&>span]:text-foreground [&_strong]:text-[#d04b56]"

export const accountInput = `h-10 w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-[11px] text-foreground placeholder:text-[#9aa8bb] ${accountFocusRing}`
