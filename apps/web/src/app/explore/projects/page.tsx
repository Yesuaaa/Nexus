import type { Metadata } from "next"
import { ChevronDown } from "lucide-react"
import { PublicServicesShell } from "@/features/public-services/components/public-services-shell"
import { ProjectsRevealMotion } from "@/features/projects/components/projects-hero-motion"
import { ProjectShowcaseCard } from "@/features/projects/components/project-showcase-card"
import { listPublicProjects } from "@/features/projects/api/project-showcase.server"
import {
  PinnedHero,
  ServiceMarquee,
} from "@/features/landing/components/landing-interactions"

export const metadata: Metadata = { title: "Projects | Converyn" }

export default async function PublicProjectsPage() {
  const projects = await listPublicProjects()
  const clients = [...new Set(projects?.map((project) => project.client))]
  return (
    <PublicServicesShell>
      <PinnedHero>
        <ProjectsRevealMotion duration={0.15}>
          <section
            aria-labelledby="projects-heading"
            className="relative left-1/2 h-[max(480px,calc(82svh-var(--landing-header-height)-56px))] w-screen -translate-x-1/2 overflow-hidden"
          >
            <h1
              id="projects-heading"
              data-projects-reveal
              className="absolute left-1/2 top-[37%] !m-0 w-[min(90%,760px)] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-[family-name:var(--font-public-heading),sans-serif] !text-[#203f8c] !text-[clamp(13px,2.2vw,34px)] !font-normal !leading-[1.5] !tracking-[-0.03em] motion-safe:[[data-public-reveal=pending]_&]:opacity-0"
            >
              Selected projects shaped by
              <br />
              strategy, creativity, and collaboration.
            </h1>
            <a
              href="#selected-projects-heading"
              aria-label="Scroll to selected projects"
              className="absolute bottom-[12%] left-1/2 z-10 grid size-11 -translate-x-1/2 place-items-center text-[#203f8c] transition-transform hover:translate-y-1 focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
            >
              <ChevronDown size={28} aria-hidden="true" />
            </a>
          </section>
        </ProjectsRevealMotion>
      </PinnedHero>
      <div className="relative z-10 bg-(--landing-paper)">
        {clients.length > 0 && (
          <div className="relative left-1/2 w-screen -translate-x-1/2 bg-(--landing-paper)">
            <ServiceMarquee
              headingId="projects-brands-heading"
              heading="Brands brought to life together."
              description="Explore the brands represented in the project showcase."
              label="Showcase brands"
              items={clients}
            />
          </div>
        )}
        <section
          aria-labelledby="selected-projects-heading"
          className="pt-8 pb-12"
        >
          <ProjectsRevealMotion triggerOnScroll>
            <div>
              <h2
                id="selected-projects-heading"
                data-projects-reveal
                className="!text-xl !tracking-normal"
              >
                Selected projects
              </h2>
            </div>
            {projects?.length ? (
              <div className="mt-7 grid grid-cols-2 items-start gap-4 max-[761px]:grid-cols-1">
                {[0, 1].map((column) => (
                  <div
                    key={column}
                    className="grid content-start gap-4 max-[761px]:contents"
                  >
                    {projects
                      .filter((_, index) => index % 2 === column)
                      .map((project, row) => (
                        <ProjectShowcaseCard
                          key={project.slug}
                          project={project}
                          number={row * 2 + column + 1}
                          aspect={row % 2 === column ? "wide" : "tall"}
                        />
                      ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-(color:--landing-muted)">
                {projects
                  ? "No projects are currently showcased."
                  : "Projects are temporarily unavailable."}
              </p>
            )}
          </ProjectsRevealMotion>
        </section>
      </div>
    </PublicServicesShell>
  )
}
