import type { Metadata } from "next"
import { PublicServicesShell } from "@/features/public-services/components/public-services-shell"
import { ProjectsHeroMotion } from "@/features/projects/components/projects-hero-motion"
import { ProjectsScrollMarker } from "@/features/projects/components/projects-scroll-marker"
import {
  PinnedHero,
  ServiceMarquee,
} from "@/features/landing/components/landing-interactions"

export const metadata: Metadata = { title: "Projects | Converyn" }

const sampleProjects = [
  {
    name: "Jollybee",
    type: "Brand campaign",
    image: "/landing/converyn-product-discover.webp",
  },
  {
    name: "Mang Inasalan",
    type: "Digital experience",
    image: "/landing/converyn-product-create.webp",
  },
  {
    name: "Chowkingdom",
    type: "Visual storytelling",
    image: "/landing/converyn-product-connect.webp",
  },
  {
    name: "Sari-SM",
    type: "Creative campaign",
    image: "/landing/converyn-team-design.webp",
  },
]

export default function PublicProjectsPage() {
  return (
    <PublicServicesShell>
      <PinnedHero>
        <ProjectsHeroMotion>
          <section
            aria-labelledby="projects-heading"
            className="relative left-1/2 h-[max(480px,calc(82svh-var(--landing-header-height)-56px))] w-screen -translate-x-1/2 overflow-hidden"
          >
            <span
              aria-hidden="true"
              data-projects-line-start
              className="absolute left-1/2 top-[14%] h-12 w-[2px] -translate-x-1/2 bg-[#203f8c]"
            />
            <h1
              id="projects-heading"
              data-projects-headline
              className="absolute left-1/2 top-[37%] !m-0 w-[min(90%,760px)] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-[family-name:var(--font-public-heading),sans-serif] !text-[#203f8c] !text-[clamp(13px,2.2vw,34px)] !font-normal !leading-[1.5] !tracking-[-0.03em]"
            >
              Selected projects shaped by
              <br />
              strategy, creativity, and collaboration.
            </h1>
            <span
              aria-hidden="true"
              data-projects-line-end
              className="absolute left-1/2 top-[59%] h-[21%] w-[2px] -translate-x-1/2 bg-[#203f8c]"
            />
          </section>
        </ProjectsHeroMotion>
      </PinnedHero>
      <div className="relative z-10 bg-(--landing-paper)">
        <div className="relative left-1/2 w-screen -translate-x-1/2 bg-(--landing-paper)">
          <ServiceMarquee
            headingId="projects-brands-heading"
            heading="Brands brought to life together."
            description="A glimpse at the kinds of brands we love collaborating with. These names are fictional examples."
            label="Fictional example brands"
            items={[
              "Jollybee",
              "Mang Inasalan",
              "Chowkingdom",
              "Goldilocks Bakeryan",
              "Bench Press",
              "Sari-SM",
            ]}
          />
        </div>
        <section
          aria-labelledby="selected-projects-heading"
          className="pt-8 pb-12"
        >
          <h2
            id="selected-projects-heading"
            className="!text-xl !tracking-normal"
          >
            Selected projects
          </h2>
          <p className="mt-3 text-sm text-(color:--landing-muted)">
            Fictional projects for illustration.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-4 max-[761px]:grid-cols-1">
            {[0, 1].map((column) => (
              <div key={column} className="grid content-start gap-4">
                {[sampleProjects[column], sampleProjects[column + 2]].map(
                  (project, row) => (
                    <article
                      key={project.name}
                      className={`group relative overflow-hidden rounded-md bg-[#203f8c] text-white ${column === row ? "aspect-[1.4]" : "aspect-[0.82]"}`}
                    >
                      <img
                        src={project.image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
                      />
                      <div className="absolute inset-0 bg-black/40" />
                      <span className="absolute top-6 left-6 text-sm font-semibold">
                        N° — {String(column + row * 2 + 1).padStart(2, "0")}
                      </span>
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                        <h3 className="!text-[clamp(24px,3vw,42px)] !font-semibold !tracking-[-0.04em]">
                          {project.name}
                        </h3>
                        <p className="mt-2 text-sm text-white/85">
                          {project.type}
                        </p>
                      </div>
                    </article>
                  ),
                )}
              </div>
            ))}
          </div>
          <ProjectsScrollMarker />
        </section>
      </div>
    </PublicServicesShell>
  )
}
