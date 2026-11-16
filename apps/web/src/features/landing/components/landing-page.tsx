import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import {
  LandingFaq,
  LandingHeader,
  LandingMotion,
  ServiceMarquee,
} from "./landing-interactions"
import { LandingFooter } from "./landing-footer"
import { ApproachCarousel } from "./approach-carousel"
import { AboutStoryCards } from "./about-story-cards"
import styles from "./landing.module.css"

const services = [
  {
    title: "Creative & content",
    description:
      "Give your ideas a distinct voice through considered design, compelling visuals, and content that connects.",
  },
  {
    title: "Digital marketing",
    description:
      "Connect your brand with the right audience through purposeful campaigns and a clear direction for growth.",
  },
  {
    title: "Web & digital experiences",
    description:
      "Bring your business online with thoughtful websites and digital experiences built around the people using them.",
  },
]

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
    <LandingMotion>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <LandingHeader />

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroCopy} data-reveal>
            <h1 id="hero-heading">
              Your next idea.
              <br />
              <span>Made possible.</span>
            </h1>
            <p>
              We bring strategy, design, and technology together to move your
              business forward. Explore what fits, share your vision, and start
              with a conversation.
            </p>
            <div className={styles.heroActions}>
              <Link href="/explore/services" className={styles.buttonPrimary}>
                Let’s talk
                <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div
            className={styles.heroMosaic}
            role="group"
            aria-label="An angular mosaic of creative and digital ideas"
            data-reveal
          >
            <div className={styles.mosaicUpper}>
              <div className={styles.mosaicUpperPhoto}>
                <Image
                  src="/landing/converyn-team-collaboration.webp"
                  alt="Illustrative creative and technology team planning a digital project"
                  fill
                  preload
                  sizes="(max-width: 760px) 90vw, 50vw"
                  className={styles.coverImage}
                />
              </div>
              <div className={styles.mosaicDiagonalPhoto}>
                <Image
                  src="/landing/converyn-team-design.webp"
                  alt="Illustrative digital designer working with a pen tablet and laptop"
                  fill
                  sizes="(max-width: 760px) 40vw, 22vw"
                  className={styles.coverImage}
                />
              </div>
            </div>
            <div className={styles.mosaicBase}>
              <Image
                src="/landing/converyn-team-conversation.webp"
                alt="Illustrative team discussing digital project requirements"
                fill
                sizes="(max-width: 760px) 72vw, 40vw"
                className={styles.coverImage}
              />
            </div>
            <div className={styles.mosaicAccentOne}>
              <Image
                src="/landing/converyn-grid-mobile.webp"
                alt="A mobile website design concept"
                fill
                sizes="(max-width: 760px) 16vw, 90px"
                className={styles.coverImage}
              />
            </div>
            <div className={styles.mosaicAccentTwo}>
              <Image
                src="/landing/converyn-product-create.webp"
                alt="A desktop displaying a digital design concept"
                fill
                sizes="(max-width: 760px) 16vw, 90px"
                className={styles.coverImage}
              />
            </div>
            <div className={styles.mosaicAccentThree}>
              <Image
                src="/landing/converyn-team-strategy.webp"
                alt="Illustrative strategist reviewing website wireframes"
                fill
                sizes="(max-width: 760px) 16vw, 90px"
                className={styles.coverImage}
              />
            </div>
          </div>
        </section>

        <ServiceMarquee />

        <section
          id="expertise"
          className={styles.services}
          aria-labelledby="expertise-heading"
        >
          <div className={styles.sectionHeading} data-reveal>
            <h2 id="expertise-heading">
              A little of what
              <br />
              <span>we can do together.</span>
            </h2>
            <p>
              Different needs. Connected expertise. Discover a starting point
              for your next project.
            </p>
          </div>
          <div className={styles.previewGrid}>
            {services.map((service) => (
              <article
                key={service.title}
                className={styles.servicePreview}
                data-reveal
              >
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <Link href="/explore/services" className={styles.previewLink}>
                  Explore services
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
          <div className={styles.previewActions} data-reveal>
            <Link href="/explore/services" className={styles.buttonPrimary}>
              View all services
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <ApproachCarousel />

        <section
          id="about"
          className={styles.about}
          aria-labelledby="about-heading"
        >
          <AboutStoryCards />
          <div className={styles.aboutCopy} data-reveal>
            <h2 id="about-heading">
              Different skills.
              <br />
              <span>One shared direction.</span>
            </h2>
            <p>
              Converyn brings creative thinking and digital expertise into the
              same conversation, connecting what your business needs with what
              it could become.
            </p>
            <p>
              We believe the strongest work starts with listening, a clear
              purpose, and care for the details. Together, we make room for
              better ideas and meaningful progress.
            </p>
            <Link href="/explore/services" className={styles.buttonSecondary}>
              Explore our expertise
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section id="faq" className={styles.faq} aria-labelledby="faq-heading">
          <h2 id="faq-heading" data-reveal>
            A little more <span>clarity.</span>
          </h2>
          <LandingFaq items={questions} />
        </section>

        <section
          id="contact"
          className={styles.contact}
          aria-labelledby="contact-heading"
          data-reveal
        >
          <div>
            <h2 id="contact-heading">
              Something in mind?
              <br />
              <span>Let’s connect.</span>
            </h2>
            <p>Bring your questions, your goals, or your next big idea.</p>
          </div>
          <Link href="/explore/services" className={styles.buttonLight}>
            Start a conversation
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <LandingFooter />
    </LandingMotion>
  )
}
