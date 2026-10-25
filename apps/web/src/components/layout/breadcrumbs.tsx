import { Link, useLocation } from "react-router"
import { ChevronRightIcon, HomeIcon } from "./icons"
import { focusRing } from "./styles"

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Account Management",
}

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
    <nav className="min-w-0 overflow-hidden" aria-label="Breadcrumb">
      <ol className="flex min-w-0 list-none gap-[7px] p-0 whitespace-nowrap">
        <li className="flex min-w-0 items-center gap-[7px] text-[#8a9ab3]">
          <Link
            to="/"
            className={`flex items-center gap-[5px] text-[#647a9c] no-underline hover:text-[#203a78] ${focusRing}`}
          >
            <HomeIcon width="15" height="15" />
            <span>Home</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          const label = labelFor(segment)
          return (
            <li
              key={`${index}-${segment}`}
              className="flex min-w-0 items-center gap-[7px] text-[#8a9ab3]"
            >
              <ChevronRightIcon width="14" height="14" />
              {index === segments.length - 1 ? (
                <span
                  aria-current="page"
                  className="overflow-hidden text-ellipsis font-semibold text-[#253f8c]"
                >
                  {label}
                </span>
              ) : (
                <Link
                  to={`/${segments.slice(0, index + 1).join("/")}`}
                  className={`flex items-center gap-[5px] text-[#647a9c] no-underline hover:text-[#203a78] ${focusRing}`}
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
