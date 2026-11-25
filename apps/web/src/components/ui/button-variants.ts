import { cva } from "class-variance-authority"
import { rowActionButton } from "./row-action-styles"
import { pillTones } from "./pill"

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
export const conversationRowTones = {
  selected: "bg-[#203f8c] text-white",
  idle: "text-[#182235] hover:bg-[#e9eef5] hover:text-[#203a78]",
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
        ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground",
        conversation: conversationRowTones.idle,
        conversationSelected: conversationRowTones.selected,
        brand: buttonTones.brand,
        brandOutline: buttonTones.brandOutline,
        danger: buttonTones.danger,
        rowAction: rowActionButton,
        actionInfo: pillTones.info + " hover:brightness-95",
        actionWarning: pillTones.warning + " hover:brightness-95",
      },
      size: {
        default: "h-9 px-4 text-sm",
        boardAction: "h-8 w-8 p-0 text-xs",
        boardCard:
          "min-h-11 w-full flex-col items-start justify-start gap-1 whitespace-normal px-3 py-2 pr-10 text-left text-xs",
        inboxRow:
          "min-h-20 w-full items-start justify-start gap-3 whitespace-normal px-4 py-3 text-left text-xs",
        shortcutTile:
          "min-h-11 whitespace-normal px-2 py-2 text-center text-xs @min-[18rem]/shortcuts:min-h-20 @min-[18rem]/shortcuts:flex-col",
        shortcut:
          "min-h-10 justify-start whitespace-normal px-2.5 py-1.5 text-left text-xs",
        /** Compact inline action. */
        sm: "h-8 px-3 text-xs",
        actionPill:
          "min-h-8 max-w-full rounded-full whitespace-normal px-3 py-1.5 text-left text-xs",
        /** Side-panel and toolbar buttons. */
        panel: "h-[34px] rounded-lg px-3 text-xs font-semibold",
        /** Selectable project rows inside a side panel. */
        panelItem: "min-h-16 rounded-lg px-4 py-3 text-sm font-semibold",
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
