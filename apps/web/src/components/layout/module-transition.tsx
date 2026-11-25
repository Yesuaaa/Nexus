import { ViewTransition, type ReactNode } from "react"

/**
 * Directional page slide between pages in a workspace. Links tag navigations
 * with `transitionTypes={["nav-forward"]}` or `["nav-back"]`; untagged
 * navigations (other modules, browser back, refreshes) don't animate. Wrap
 * each route's page.tsx, not a layout: layouts persist, so their enter/exit
 * never fire. Keyframes live in src/index.css.
 */
const directional = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
}

export function ModuleTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={directional} exit={directional} default="none">
      {children}
    </ViewTransition>
  )
}
