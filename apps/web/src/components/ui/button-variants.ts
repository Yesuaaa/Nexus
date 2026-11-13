import { cva } from "class-variance-authority"

/**
 * Colour sets for the portal's buttons. Exported for class constants that
 * compose their own shape (e.g. panel-styles); prefer `buttonVariants` or
 * `<Button variant>` everywhere else.
 */
export const buttonTones = {
  /** EXP navy primary action. */
  brand:
    "bg-[#203f8c] text-white hover:bg-[#172f70] disabled:hover:bg-[#203f8c]",
  /** Bordered secondary action in navy text. */
  brandOutline:
    "border border-[#d7e0ee] bg-background text-[#24437e] hover:bg-[#f1f5fc] disabled:hover:bg-background",
  /** Destructive action. */
  danger:
    "bg-[#bc3649] text-white hover:bg-[#a42f40] disabled:hover:bg-[#bc3649]",
} as const
// Hover uses plain `hover:` (not `hover:enabled:`) so it also works on links;
// the `disabled:hover:` reset keeps disabled raw <button>s from darkening.

// Shared by interactive buttons and server-rendered navigation links.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        brand: buttonTones.brand,
        brandOutline: buttonTones.brandOutline,
        danger: buttonTones.danger,
      },
      size: {
        default: "h-9 px-4 text-sm",
        /** Compact inline action. */
        sm: "h-8 px-3 text-xs",
        /** Side-panel and toolbar buttons. */
        panel: "h-[34px] rounded-lg px-3 text-xs font-semibold",
        /** Page-header actions (e.g. "Create Employee"). */
        header:
          "min-h-[34px] gap-[7px] rounded-lg px-[13px] text-xs leading-[1.2] font-semibold",
        /** Dialog footer buttons. */
        modal:
          "min-h-[38px] gap-[7px] rounded-[9px] px-[15px] text-xs leading-[1.2] font-semibold",
        /** Full-size touch target used on profile and settings forms. */
        touch: "min-h-11 px-4 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)
