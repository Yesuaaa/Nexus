import Link from "next/link"
import localFont from "next/font/local"
import { ArrowUpRight } from "lucide-react"
import {
  ContactHeading,
  LandingFaq,
  LandingHeader,
  LandingMotion,
  PinnedHero,
  ServiceMarquee,
} from "./landing-interactions"
import { LandingFooter } from "./landing-footer"
import { ApproachCarousel } from "./approach-carousel"
import { HeroHalftone } from "./hero-halftone"
import { HeroStats } from "./hero-stats"
import { LandingServices } from "./landing-services"
import { LandingSmoothScroll } from "./landing-smooth-scroll"
import { LandingLoader } from "./landing-loader"
import { ProjectsRevealMotion } from "@/features/projects/components/projects-hero-motion"

const sora = localFont({
  src: "../../../../public/font/Sora/Sora-VariableFont_wght.ttf",
  variable: "--font-landing-heading",
  display: "swap",
})

const heroClass = [
  "relative max-w-[1360px] min-h-[calc(100svh_-_var(--landing-header-height))] mx-auto [padding:76px_48px_84px] grid grid-cols-[minmax(0,1fr)_40%] items-center gap-x-8 gap-y-4 min-[761px]:grid-rows-[1fr_auto]",
  "[&_h1]:text-[clamp(36px,4.3vw,66px)] [&_h1]:leading-[1.09] [&_h1]:tracking-[-3px] [&_h1]:font-medium",
  "[&_h1_>_span]:text-(color:--landing-blue)",
  "min-[1500px]:py-23.75",
  "max-[1101px]:[padding:64px_32px_70px]",
  "max-[1101px]:[&_h1]:text-[clamp(42px,4.6vw,48px)] max-[1101px]:[&_h1]:tracking-[-2.5px]",
  "max-[851px]:gap-x-6.25",
  "max-[851px]:[&_h1]:text-[36px] max-[851px]:[&_h1]:tracking-[-2px]",
  "max-[761px]:grid-cols-1 max-[761px]:[padding:58px_24px_48px] max-[761px]:gap-9.5",
  "max-[761px]:[&_h1]:text-[clamp(20px,6.5vw,48px)] max-[761px]:[&_h1]:tracking-[-1px]",
].join(" ")

const heroCopyClass = [
  "relative z-10 py-6.5",
  "[&>_p]:max-w-[560px] [&>_p]:mt-7.5 [&>_p]:text-(color:--landing-muted) [&>_p]:text-[16px] [&>_p]:leading-[1.9]",
  "max-[1101px]:[&>_p]:text-[15px]",
  "max-[851px]:[&>_p]:text-[14px] max-[851px]:[&>_p]:mt-6",
  "max-[761px]:p-0",
  "max-[761px]:[&>_p]:max-w-[460px] max-[761px]:[&>_p]:text-[15px] max-[761px]:[&>_p]:leading-[1.9]",
].join(" ")

const heroActionsClass = [
  "flex flex-wrap gap-3.5 mt-9.5",
  "max-[1101px]:gap-3 max-[1101px]:mt-7.5",
  "max-[851px]:flex-col max-[851px]:items-start",
  "max-[851px]:[&>_:is(a,button)]:min-w-[205px] max-[851px]:[&>_:is(a,button)]:justify-between",
  "max-[761px]:flex-row max-[761px]:items-center max-[761px]:gap-3 max-[761px]:mt-7.5",
  "max-[761px]:[&>_:is(a,button)]:min-w-0 max-[761px]:[&>_:is(a,button)]:text-[12px] max-[761px]:[&>_:is(a,button)]:gap-4",
  "max-[381px]:[align-items:stretch] max-[381px]:flex-col",
  "max-[381px]:[&>_:is(a,button)]:justify-between",
].join(" ")

const buttonPrimaryClass = [
  "relative isolate min-h-13 inline-flex items-center justify-center gap-6 [padding:14px_22px] border border-[#203f8c] rounded-[4px] text-[13px] font-medium [transition:background_500ms_ease-in-out,color_500ms_ease-in-out] text-white bg-[#203f8c] hover:bg-transparent hover:text-[#203f8c] hover:border-[#203f8c] focus-visible:bg-transparent focus-visible:text-[#203f8c] focus-visible:border-[#203f8c]",
  "[&_svg]:shrink-0 [&_svg]:[transition:transform_500ms_ease-in-out]",
  "[&:hover_svg]:[transform:translateX(5px)]",
  "[&:focus-visible_svg]:[transform:translateX(5px)]",
  "max-[1101px]:gap-4 max-[1101px]:text-[12px] max-[1101px]:px-4.5",
].join(" ")

const buttonSecondaryClass = [
  "relative isolate min-h-13 inline-flex items-center justify-center gap-6 [padding:14px_22px] [border:1px_solid_var(--landing-ink)] rounded-[4px] text-[13px] font-medium [transition:background_500ms_ease-in-out,color_500ms_ease-in-out] bg-transparent text-(color:--landing-ink)",
  "[&_svg]:shrink-0 [&_svg]:[transition:transform_500ms_ease-in-out]",
  "[&:hover_svg]:[transform:translateX(5px)]",
  "[&:focus-visible_svg]:[transform:translateX(5px)]",
  "hover:bg-(--landing-ink) hover:text-(color:--landing-paper)",
  "focus-visible:bg-(--landing-ink) focus-visible:text-(color:--landing-paper)",
  "max-[1101px]:gap-4 max-[1101px]:text-[12px] max-[1101px]:px-4.5",
].join(" ")

const faqClass = [
  "relative z-10 max-w-[1360px] m-auto [padding:120px_48px] grid grid-cols-[0.9fr_1.1fr] items-start gap-22.5",
  "[&_h2]:max-w-[330px]",
  "max-[1101px]:px-8",
  "max-[851px]:gap-12.5",
  "max-[761px]:grid-cols-1 max-[761px]:[padding:80px_24px] max-[761px]:gap-8.75",
  "max-[761px]:[&_h2]:max-w-[none]",
].join(" ")

const contactClass = [
  "relative isolate overflow-hidden [padding:72px_65px] flex items-center justify-between gap-11.25 bg-(--landing-ink) text-(color:--landing-paper) rounded-[6px]",
  "[&_h2]:text-[clamp(34px,3.7vw,50px)] [&_h2]:leading-[1] [&_h2]:tracking-[-2px]",
  "[&_h2_>_span]:text-(color:--landing-blue)",
  "[&_p]:mt-6 [&_p]:text-[color-mix(in_srgb,var(--landing-paper)_72%,var(--landing-ink))] [&_p]:text-[14px] [&_p]:leading-[1.8]",
  "max-[1101px]:[padding:60px_42px]",
  "max-[851px]:[padding:55px_38px] max-[851px]:gap-7.5",
  "max-[851px]:[&_h2]:text-[42px]",
  "max-[761px]:flex-col max-[761px]:items-start max-[761px]:gap-8.75 max-[761px]:[padding:48px_28px]",
  "max-[761px]:[&_h2]:text-[clamp(38px,8vw,52px)] max-[761px]:[&_h2]:tracking-[-2px]",
  "max-[761px]:[&_p]:mt-5.5 max-[761px]:[&_p]:text-[14px]",
].join(" ")

const buttonLightClass = [
  "relative isolate min-h-13 inline-flex items-center justify-center gap-6 [padding:14px_22px] [border:1px_solid_var(--landing-ink)] rounded-[4px] text-[13px] font-medium [transition:background_500ms_ease-in-out,color_500ms_ease-in-out] shrink-0 bg-(--landing-paper) text-(color:--landing-ink) [border-color:var(--landing-paper)]",
  "[&_svg]:shrink-0 [&_svg]:[transition:transform_500ms_ease-in-out]",
  "[&:hover_svg]:[transform:translateX(5px)]",
  "[&:focus-visible_svg]:[transform:translateX(5px)]",
  "hover:bg-[#203f8c] hover:text-white hover:border-[#203f8c]",
  "focus-visible:bg-[#203f8c] focus-visible:text-white focus-visible:border-[#203f8c]",
  "max-[1101px]:gap-4 max-[1101px]:text-[12px] max-[1101px]:px-4.5",
  "max-[761px]:text-[13px]",
].join(" ")

const questions = [
  {
    question: "What does Converyn offer?",
    answer:
      "Converyn brings together creative content, digital marketing, and web experiences. The aim is to find the right support for your business, from a focused creative project to a broader digital direction.",
  },
  {
    question: "Can I discuss an idea before committing?",
    answer:
      "Yes. You can start with your goals, questions, or an early idea. A conversation helps clarify what you need before you decide on a service or agree to any work.",
  },
  {
    question: "Does an inquiry confirm a booking?",
    answer:
      "No. An inquiry expresses your interest and starts a conversation. The scope, timeline, and any service agreement are discussed and confirmed separately.",
  },
]

export function LandingPage() {
  return (
    <LandingLoader>
      <LandingMotion
        className={`${sora.variable} [&_h1]:[font-family:var(--font-landing-heading),sans-serif] [&_h2]:[font-family:var(--font-landing-heading),sans-serif] [&_h3]:[font-family:var(--font-landing-heading),sans-serif]`}
      >
        <LandingSmoothScroll />
        <a
          className="fixed left-4 -top-20 z-100 [padding:12px_20px] bg-(--landing-paper) text-(color:--landing-ink) focus:top-4"
          href="#main-content"
        >
          Skip to content
        </a>
        <LandingHeader />

        <main id="main-content">
          <PinnedHero>
            <section className={heroClass} aria-labelledby="hero-heading">
              <ProjectsRevealMotion duration={0.15}>
                <div
                  className={`${heroCopyClass} motion-safe:[[data-public-reveal=pending]_&]:opacity-0`}
                  data-projects-reveal
                >
                  <h1 id="hero-heading">
                    Creative Ideas.
                    <br />
                    <span className="whitespace-nowrap !text-inherit">
                      Connected Growth.
                    </span>
                  </h1>
                  <p>
                    Bring your brand to life through creative content, digital
                    marketing, and web experiences designed around your goals.
                  </p>
                  <div className={heroActionsClass}>
                    <Link
                      href="/explore/services"
                      className={buttonPrimaryClass}
                    >
                      Explore Services
                    </Link>
                    <Link href="/login" className={buttonSecondaryClass}>
                      Sign in
                    </Link>
                  </div>
                </div>
              </ProjectsRevealMotion>
              <HeroHalftone />
              <HeroStats />
            </section>
          </PinnedHero>

          <div className="relative z-10 bg-(--landing-paper)">
            <ServiceMarquee />

            <section
              id="expertise"
              className="mx-auto min-h-[100vh] max-w-[1360px] px-12 max-[1101px]:px-8 max-[761px]:px-6"
              aria-label="Services"
            >
              <LandingServices />
            </section>
          </div>

          <ApproachCarousel />

          <div className="relative z-10 bg-(--landing-paper)">
            <div className="relative isolate overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <HeroHalftone background />
              </div>
              <section
                id="faq"
                className={faqClass}
                aria-labelledby="faq-heading"
              >
                <h2 id="faq-heading" data-reveal className="!max-w-none">
                  <span className="block whitespace-nowrap !text-inherit">
                    A LITTLE MORE
                  </span>
                  <span className="block !text-[#203f8c]">CLARITY.</span>
                </h2>
                <LandingFaq items={questions} />
              </section>
            </div>

            <div className="mx-auto max-w-[1360px] px-12 max-[1101px]:px-8 max-[761px]:px-6">
              <section
                id="contact"
                className={contactClass}
                aria-labelledby="contact-heading"
                data-reveal
              >
                <div className="relative z-10">
                  <ContactHeading />
                </div>
                <Link
                  href="/register"
                  className={`${buttonLightClass} relative z-10`}
                >
                  Start a conversation
                  <ArrowUpRight size={20} aria-hidden="true" />
                </Link>
              </section>
            </div>
          </div>
        </main>

        <LandingFooter />
      </LandingMotion>
    </LandingLoader>
  )
}
