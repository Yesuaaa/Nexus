import { Globe2, ArrowUpRight } from "lucide-react"
import Link from "next/link"

const footerClass = [
  "mt-22 [border-top:1px_solid_var(--landing-line)] bg-[color-mix(in_srgb,var(--landing-ink)_3%,var(--landing-paper))]",
  "max-[761px]:mt-16",
].join(" ")

const footerColumnsClass = [
  "grid grid-cols-[1.15fr_0.8fr_1.2fr] gap-12 items-start",
  "max-[1101px]:gap-7.5",
  "max-[851px]:grid-cols-[1.2fr_1fr_1fr] max-[851px]:gap-8.75",
  "max-[761px]:grid-cols-[1fr_1fr] max-[761px]:[gap:38px_24px]",
].join(" ")

const footerBrandClass = [
  "[&>_p:first-child]:max-w-[none] [&>_p:first-child]:m-0 [&>_p:first-child]:text-[28px] [&>_p:first-child]:leading-[1.3] [&>_p:first-child]:text-(color:--landing-ink)",
  "[&>_p:last-child]:max-w-[245px] [&>_p:last-child]:mt-5.5 [&>_p:last-child]:text-[13px] [&>_p:last-child]:leading-[1.95] [&>_p:last-child]:text-(color:--landing-muted)",
  "max-[761px]:col-span-full",
  "max-[761px]:[&>_p:last-child]:max-w-[390px] max-[761px]:[&>_p:last-child]:mt-4.5",
].join(" ")

const footerLinksClass = [
  "[&_h2]:[margin:4px_0_26px] [&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:leading-[1.5] [&_h2]:tracking-[-0.2px]",
  "[&_ul]:grid [&_ul]:gap-4.5 [&_ul]:m-0 [&_ul]:p-0 [&_ul]:list-none",
  "max-[761px]:[&_h2]:mt-0 max-[761px]:[&_h2]:mb-5",
].join(" ")

const footerItemClass = [
  "inline-flex items-center gap-3.5 text-(color:--landing-muted) text-[13px] leading-[1.6] [transition:color_250ms]",
  "[&>_svg]:[transition:transform_350ms]",
  "hover:text-(color:--landing-blue)",
  "[&:hover_>_svg]:[transform:translate(2px,-2px)]",
].join(" ")

const footerLegalClass = [
  "[&_h2]:[margin:4px_0_26px] [&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:leading-[1.5] [&_h2]:tracking-[-0.2px]",
  "relative self-stretch pl-7 before:absolute before:-top-16 before:-bottom-15 before:left-0 before:w-px before:bg-(--landing-line) before:content-['']",
  "[&>_p]:text-[12px] [&>_p]:leading-[1.95] [&>_p]:text-(color:--landing-muted)",
  "max-[1101px]:pl-5.5",
  "max-[851px]:col-span-full max-[851px]:[padding:26px_0_0] max-[851px]:[border-top:1px_solid_var(--landing-line)] max-[851px]:before:hidden",
  "max-[851px]:[&>_p]:max-w-[650px]",
  "max-[761px]:col-span-full",
  "max-[761px]:[&_h2]:mt-0 max-[761px]:[&_h2]:mb-5",
].join(" ")

const footerBottomClass = [
  "relative flex items-center justify-between gap-6 mt-15 pt-6.25 text-(color:--landing-muted) text-[11px] leading-[1.8]",
  "before:absolute before:top-0 before:left-1/2 before:w-screen before:-translate-x-1/2 before:[border-top:1px_solid_var(--landing-line)] before:content-['']",
  "max-[851px]:flex-wrap max-[851px]:gap-y-3.5",
  "max-[761px]:mt-8.75 max-[761px]:flex-col max-[761px]:items-start max-[761px]:gap-3.5 max-[761px]:text-[10px]",
].join(" ")

const footerPages = [
  { label: "About Converyn", href: "/" },
  { label: "Services", href: "/explore/services" },
  { label: "Flow", href: "/#approach" },
  { label: "Contact", href: "/#contact" },
]

export function LandingFooter() {
  return (
    <footer className={footerClass}>
      <div className="max-w-[1360px] mx-auto [padding:64px_48px_28px] max-[1101px]:px-8 max-[761px]:[padding:42px_24px_26px]">
        <div className={footerColumnsClass}>
          <div className={footerBrandClass}>
            <p className="text-(color:--landing-ink) text-[27px] font-semibold tracking-[-1.1px] leading-[1.3] max-[761px]:text-[25px]">
              converyn
            </p>
            <p>
              Creative thinking. Connected expertise. Digital services that help
              bring your next idea into focus.
            </p>
          </div>

          <nav className={footerLinksClass} aria-label="Footer navigation">
            <h2>Explore Converyn</h2>
            <ul>
              {footerPages.map((page) => (
                <li key={page.href}>
                  <Link href={page.href} className={footerItemClass}>
                    {page.label}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={footerLegalClass}>
            <h2>A note on ownership</h2>
            <p>
              All content, imagery, and third-party trademarks belong to their
              respective owners. Their use does not imply ownership,
              endorsement, sponsorship, or affiliation.
            </p>
          </div>
        </div>
        <div className={footerBottomClass}>
          <span>
            &copy; {new Date().getFullYear()} Converyn. All rights reserved.
          </span>
          <span className="inline-flex items-center gap-2">
            <Globe2 size={14} aria-hidden="true" /> Based in the Philippines.
          </span>
        </div>
      </div>
    </footer>
  )
}
