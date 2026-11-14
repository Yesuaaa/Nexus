import { ViewTransition, type ReactNode } from "react"

/**
 * Directional page slide between a module's Overview and Management pages.
 * Links tag navigations with `transitionTypes={["nav-forward"]}` (into
 * Management) or `["nav-back"]` (back to Overview); untagged navigations
 * (other modules, browser back, refreshes) don't animate. Wrap the page in
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
