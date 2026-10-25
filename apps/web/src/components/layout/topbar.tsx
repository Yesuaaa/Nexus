import { Breadcrumbs } from "./breadcrumbs"
import { MenuIcon } from "./icons"

export function Topbar({
  drawerOpen,
  onOpenMenu,
}: {
  drawerOpen: boolean
  onOpenMenu: () => void
}) {
  return (
    <header className="app-topbar">
      <button
        type="button"
        className="app-mobile-menu app-icon-button"
        aria-label="Open navigation menu"
        aria-controls="app-sidebar"
        aria-expanded={drawerOpen}
        onClick={onOpenMenu}
      >
        <MenuIcon />
      </button>
      <Breadcrumbs />
    </header>
  )
}
