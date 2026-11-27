import Link from "next/link"
import { ProjectScrollImage } from "./project-scroll-image"
import type { ShowcaseCard } from "../model/showcase-projects"

export function ProjectShowcaseCard({
  project,
  number,
  aspect,
}: {
  project: ShowcaseCard
  number: number
  aspect: "wide" | "tall"
}) {
  return (
    <article
      data-projects-reveal
      style={{ aspectRatio: aspect === "wide" ? "1.4" : "0.82", order: number }}
      className="group relative w-full overflow-hidden rounded-md bg-[#203f8c] text-white"
    >
      <ProjectScrollImage
        src={project.image}
        sizes="(max-width: 761px) 100vw, (max-width: 1360px) 50vw, 632px"
      />
      <div
        aria-hidden="true"
        style={{ backgroundColor: "rgba(16, 43, 107, 0.6)" }}
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
      />
      <span
        style={{ top: 4, left: 4 }}
        className="absolute z-20 text-sm font-semibold opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
      >
        CON — {String(number).padStart(2, "0")}
      </span>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
        <h3 className="!text-[clamp(24px,3vw,42px)] !font-semibold !tracking-[-0.04em]">
          {project.name}
        </h3>
        <p className="mt-2 text-sm text-white/85">{project.type}</p>
        {project.fictional && (
          <p className="mt-1 text-xs text-white/85">Fictional example</p>
        )}
      </div>
      <Link
        href={`/explore/projects/${project.slug}`}
        data-project-card-link
        aria-label={`View ${project.name} project details`}
        className="absolute inset-0 z-30 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
      />
    </article>
  )
}
