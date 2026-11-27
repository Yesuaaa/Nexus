import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { PublicServicesShell } from "@/features/public-services/components/public-services-shell"
import { readPublicProject } from "@/features/projects/api/project-showcase.server"
import { HistoryBackLink } from "@/components/ui/history-back-link"
import { ShowcaseImageGrid } from "@/features/projects/components/showcase-image-grid"
import { showcaseImageLayouts } from "@/features/projects/model/showcase-images"
import { buttonSecondaryClass } from "@/features/landing/components/landing-page"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = await readPublicProject(slug)
  if (project === "missing") notFound()
  if (!project) {
    return (
      <PublicServicesShell>
        <HistoryBackLink href="/explore/projects" data-project-back-link />
        <h1>Project details unavailable</h1>
        <p>Please try again shortly.</p>
      </PublicServicesShell>
    )
  }

  const images = [project.image, ...(project.additionalImages ?? [])]
  const layout =
    showcaseImageLayouts.find(
      ({ id, count }) =>
        id === project.galleryLayout && count === images.length,
    ) ?? showcaseImageLayouts[0]

  return (
    <PublicServicesShell>
      <section
        className="pt-0 pb-20 max-[761px]:pb-12"
        aria-labelledby="project-detail-heading"
      >
        <HistoryBackLink href="/explore/projects" data-project-back-link />
        <div className="mt-8 grid grid-cols-[1fr_2fr] gap-12 max-[761px]:grid-cols-1 max-[761px]:gap-8">
          <dl className="flex flex-wrap gap-x-12 gap-y-4 text-sm min-[762px]:pt-20">
            <div>
              <dt className="text-(color:--landing-muted)">Client</dt>
              <dd className="mt-1 font-semibold">{project.client}</dd>
            </div>
            <div>
              <dt className="text-(color:--landing-muted)">Service</dt>
              <dd className="mt-1 font-semibold">{project.type}</dd>
            </div>
            <div>
              <dt className="text-(color:--landing-muted)">Year</dt>
              <dd className="mt-1 font-semibold">{project.year ?? "—"}</dd>
            </div>
          </dl>
          <div className="max-w-[580px]">
            <h1
              id="project-detail-heading"
              className="!text-[clamp(32px,3vw,44px)] !font-medium !tracking-[-0.04em]"
            >
              {project.name}
            </h1>
            {project.fictional && (
              <p className="text-sm text-(color:--landing-muted)">
                Fictional example
              </p>
            )}
            <p className="mt-10 text-lg leading-relaxed whitespace-pre-line wrap-break-word">
              {project.description}
            </p>
          </div>
        </div>
        <div
          role="group"
          aria-label="Project images"
          className="mt-24 max-[761px]:mt-12"
        >
          <ShowcaseImageGrid layout={layout} images={images} />
        </div>
        <div className="mt-16 text-center max-[761px]:mt-10">
          <Link
            href="/explore/projects"
            data-project-back-link
            className={buttonSecondaryClass}
          >
            Check All Works <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicServicesShell>
  )
}
