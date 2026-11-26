import { useLayoutEffect, useRef, type ReactNode } from "react"
import { gsap } from "gsap"
import {
  ArrowUp,
  Check,
  ClipboardList,
  FolderCheck,
  Plus,
  ShieldCheck,
} from "lucide-react"

const clientMessage = "Hi! Can you help redesign five pages before our launch?"
const quotationAmount = "$4,800"

function ConversationRow({
  name,
  children,
}: {
  name: string
  children: ReactNode
}) {
  return (
    <div data-row={name} className="invisible grid grid-rows-[0fr] opacity-0">
      <div className="min-h-0 overflow-hidden">
        <div className="pt-2.5" data-message>
          {children}
        </div>
      </div>
    </div>
  )
}

export function ApproachChat({ stage }: { stage: number | null }) {
  const chat = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!chat.current || stage === null) return

    const find = gsap.utils.selector(chat.current)
    const part = (name: string) => find(`[data-chat="${name}"]`)
    const row = (name: string) => find(`[data-row="${name}"]`)
    const media = gsap.matchMedia()

    media.add(
      { all: "all", reduced: "(prefers-reduced-motion: reduce)" },
      ({ conditions }) => {
        const timeline = gsap.timeline({ defaults: { ease: "power2.out" } })
        const reduced = conditions?.reduced

        const showRow = (name: string) => {
          gsap.set(row(name), { autoAlpha: 1, gridTemplateRows: "1fr" })
        }
        const reveal = (name: string) => {
          const target = row(name)
          const message = find(`[data-row="${name}"] [data-message]`)
          timeline
            .to(target, {
              autoAlpha: 1,
              gridTemplateRows: "1fr",
              duration: 0.38,
            })
            .fromTo(message, { y: 9 }, { y: 0, duration: 0.38 }, "<")
        }
        const press = (name: string, at: string) => {
          timeline
            .to(part(name), { scale: 0.92, duration: 0.13 }, at)
            .to(part(name), { scale: 1, duration: 0.19 })
        }

        if (stage > 0 || reduced) {
          showRow("client")
          showRow("manager")
        }
        if (stage > 1 || (stage === 1 && reduced)) {
          showRow("quote")
        }

        if (reduced) {
          if (stage === 2) {
            gsap.set(part("accept"), { autoAlpha: 0 })
            gsap.set(part("accepted"), { autoAlpha: 1 })
            showRow("verified")
            showRow("activated")
          }
          return
        }

        if (stage === 0) {
          const draft = part("draft")[0]
          const typing = { length: 0 }
          timeline.set(part("placeholder"), { autoAlpha: 0 }, 0.28).to(typing, {
            length: clientMessage.length,
            duration: 1.8,
            ease: "none",
            onUpdate: () => {
              draft.textContent = clientMessage.slice(0, typing.length)
            },
          })
          press("send", "+=0.25")
          timeline.call(() => {
            draft.textContent = ""
          })
          timeline.set(part("placeholder"), { autoAlpha: 1 })
          reveal("client")
          timeline.addLabel("reply", "+=0.32")
          timeline.to(
            row("typing"),
            { autoAlpha: 1, gridTemplateRows: "1fr", duration: 0.25 },
            "reply",
          )
          timeline.fromTo(
            find("[data-chat-dot]"),
            { y: 0, opacity: 0.45 },
            {
              y: -3,
              opacity: 1,
              duration: 0.24,
              stagger: 0.12,
              repeat: 3,
              yoyo: true,
              ease: "sine.inOut",
            },
            "reply",
          )
          timeline.to(row("typing"), {
            autoAlpha: 0,
            gridTemplateRows: "0fr",
            duration: 0.2,
          })
          reveal("manager")
        }

        if (stage === 1) {
          timeline.to({}, { duration: 0.5 })
          reveal("quote")
        }

        if (stage === 2) {
          press("accept", "+=0.42")
          timeline
            .to(part("accept"), { autoAlpha: 0, duration: 0.16 })
            .fromTo(
              part("accepted"),
              { y: 4 },
              { y: 0, autoAlpha: 1, duration: 0.25 },
              "<",
            )
          reveal("verified")
          timeline.to({}, { duration: 0.7 })
          reveal("activated")
        }

        return () => {
          part("draft")[0].textContent = ""
        }
      },
    )

    return () => media.revert()
  }, [stage])

  return (
    <div
      ref={chat}
      role="region"
      aria-label="Project conversation demo"
      className="relative isolate mx-auto flex w-full max-w-[540px] aspect-[1.35] max-h-[calc(100svh-var(--landing-header-height)-56px)] min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#121214]/85 text-[13px] leading-snug text-(color:--landing-paper) backdrop-blur-md max-[761px]:aspect-auto max-[761px]:h-(--approach-chat-height) max-[761px]:max-h-none max-[761px]:min-h-0"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3 sm:px-5">
          <ConversationRow name="client">
            <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-sm bg-[#203F8C] px-3.5 py-2 text-white">
              {clientMessage}
            </div>
          </ConversationRow>
          <ConversationRow name="manager">
            <p className="mb-1 text-[11px] font-medium text-white/60">
              Manager
            </p>
            <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-3.5 py-2">
              Absolutely. I'll put together a quote with the scope and timeline.
            </div>
          </ConversationRow>
          <ConversationRow name="typing">
            <div
              className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2"
              aria-label="The design manager is typing"
            >
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  data-chat-dot
                  className="size-1.5 rounded-full bg-white/70"
                />
              ))}
            </div>
          </ConversationRow>
          <ConversationRow name="quote">
            <div className="w-full max-w-[330px] rounded-xl border border-[#203F8C]/75 bg-[#203F8C]/15 px-3 py-2">
              <div className="flex items-center gap-2 font-semibold">
                <ClipboardList
                  className="size-4 text-[#a5bcff]"
                  aria-hidden="true"
                />
                Quotation
                <span className="ml-auto text-sm">{quotationAmount}</span>
              </div>
              <dl className="mt-2 space-y-1 text-[11px] text-white/70">
                <div>
                  <dt className="inline font-medium text-white/85">
                    Start Date &amp; End Date{" "}
                  </dt>
                  <dd className="inline">Jan 11 – Feb 8, 2027</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-white/85">
                    Project scope{" "}
                  </dt>
                  <dd className="inline">Redesign and build five pages.</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-white/85">Goals </dt>
                  <dd className="inline">
                    Improve navigation and increase inquiries.
                  </dd>
                </div>
              </dl>
              <div className="relative mt-2 h-7">
                <span
                  data-chat="accept"
                  className="absolute inset-0 grid place-items-center rounded-md bg-[#203F8C] text-[11px] font-semibold text-white"
                >
                  Accept quotation
                </span>
                <span
                  data-chat="accepted"
                  className="invisible absolute inset-0 flex items-center justify-center gap-1.5 rounded-md bg-white/8 text-[11px] font-medium text-white opacity-0"
                >
                  <Check
                    className="size-3.5 text-[#a5bcff]"
                    aria-hidden="true"
                  />
                  Quotation accepted
                </span>
              </div>
            </div>
          </ConversationRow>
          <ConversationRow name="verified">
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-white/65">
              <ShieldCheck
                className="size-3.5 shrink-0 text-[#a5bcff]"
                aria-hidden="true"
              />
              Commencement requirements verified
            </p>
          </ConversationRow>
          <ConversationRow name="activated">
            <div className="flex w-full max-w-[330px] items-center gap-2.5 rounded-xl border border-[#203F8C]/75 bg-[#203F8C]/15 px-3 py-2">
              <FolderCheck
                className="size-5 shrink-0 text-[#a5bcff]"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">Project activated</p>
                <p className="text-[11px] text-white/70">
                  Your project workspace is ready.
                </p>
              </div>
            </div>
          </ConversationRow>
        </div>
      </div>

      <div
        className="relative flex shrink-0 items-center gap-2 border-t border-white/10 bg-white/3 px-3 py-2 sm:px-5"
        aria-hidden="true"
      >
        <span
          data-chat="plus"
          className="grid size-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5"
        >
          <Plus className="size-4" />
        </span>
        <div className="relative flex h-8 min-w-0 flex-1 items-center rounded-full border border-white/10 bg-black/15 px-3 text-xs">
          <span data-chat="placeholder" className="absolute text-white/55">
            Message
          </span>
          <span data-chat="draft" className="truncate" />
        </div>
        <span
          data-chat="send"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-[#203F8C]"
        >
          <ArrowUp className="size-4" />
        </span>
      </div>
    </div>
  )
}
