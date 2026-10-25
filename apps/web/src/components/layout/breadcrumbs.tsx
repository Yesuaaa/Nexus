import { Link, useLocation } from "react-router"
import { ChevronRightIcon, HomeIcon } from "./icons"

const routeLabels: Record<string, string> = { dashboard: "Dashboard" }

function labelFor(segment: string) {
  const decoded = decodeURIComponent(segment)
  return (
    routeLabels[decoded.toLowerCase()] ??
    decoded
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <nav className="app-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/" className="app-breadcrumb-link">
            <HomeIcon width="15" height="15" />
            <span>Home</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          const label = labelFor(segment)
          return (
            <li key={`${index}-${segment}`}>
              <ChevronRightIcon width="14" height="14" />
              {index === segments.length - 1 ? (
                <span aria-current="page" className="app-breadcrumb-current">
                  {label}
                </span>
              ) : (
                <Link
                  to={`/${segments.slice(0, index + 1).join("/")}`}
                  className="app-breadcrumb-link"
                >
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
