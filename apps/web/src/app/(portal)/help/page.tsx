"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, MessageSquare } from "lucide-react"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
import { RequestStatus } from "@/features/services/components/client-requests-table"
import { serviceRequestStatuses } from "@/features/services/model/service-request-status"

type Faq = {
  title: string
  answer: string | string[]
  statuses?: ("SUBMITTED" | "UNDER_REVIEW")[]
}

const faqGroups: { title: string; questions: Faq[] }[] = [
  {
    title: "Bookings and requests",
    questions: [
      {
        title: "How do I book a service?",
        answer: [
          "Choose a service or package from the Services page.",
          "Complete the request form with your requirements.",
          "Review your details and submit your request.",
        ],
      },
      {
        title: "What happens after I book a service?",
        answer:
          "The department responsible for your service will review your request. You can track its status in Booked Requests and continue the conversation once the team accepts your request.",
      },
      {
        title: "What does my request status mean?",
        answer: [
          "Your request has been received and is awaiting review.",
          "The department is reviewing your request.",
        ],
        statuses: ["SUBMITTED", "UNDER_REVIEW"],
      },
    ],
  },
  {
    title: "Quotations and consultations",
    questions: [
      {
        title: "Where do I review my quotation?",
        answer:
          "Your quotation will appear in the booking conversation in Messages once the team sends it.",
      },
      {
        title: "Where do I find my consultation details?",
        answer:
          "Your booking conversation shows the date, time, and meeting link or location once your consultation is scheduled.",
      },
      {
        title: "How do I request a different time?",
        answer:
          "Select Request reschedule on the meeting card in your booking conversation. Your original appointment remains in place until the team confirms a new time.",
      },
    ],
  },
]

export default function HelpCenterPage() {
  const [search, setSearch] = useState("")
  const [openQuestion, setOpenQuestion] = useState<string | null>(
    faqGroups[0].questions[0].title,
  )
  const query = search.trim().toLowerCase()
  const groups = faqGroups
    .map((group) => ({
      ...group,
      questions: group.questions.filter(({ title, answer, statuses }) =>
        [
          title,
          ...[answer].flat(),
          ...(statuses ?? []).map(
            (status) => serviceRequestStatuses[status].label,
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      ),
    }))
    .filter(({ questions }) => questions.length > 0)

  return (
    <main className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}>
      <header className="-mx-[clamp(16px,2.1vw,32px)] border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5">
        <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]">
          Help &amp; Support
        </h1>
        <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#52627a]">
          Find answers about booking services and tracking your requests.
        </p>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <SearchField
            label="Search questions"
            placeholder="Search questions…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            containerClassName="w-full max-[1050px]:w-full"
          />
          {groups.length ? (
            groups.map(({ title, questions }) => (
              <section key={title} aria-label={title}>
                <h2 className="mb-3 text-base font-semibold">{title}</h2>
                <div className="divide-y divide-[#e2e8f0] overflow-hidden rounded-lg border border-[#e2e8f0]">
                  {questions.map(({ title, answer, statuses }) => {
                    const open = openQuestion === title
                    const answerId = `faq-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`
                    return (
                      <div key={title}>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={answerId}
                          onClick={() => setOpenQuestion(open ? null : title)}
                          className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-[#e8eef2] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#294a9b]"
                        >
                          {title}
                          <ChevronDown
                            size={16}
                            className="shrink-0 text-[#52627a] transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none"
                            aria-hidden="true"
                          />
                        </button>
                        <div
                          id={answerId}
                          aria-hidden={!open}
                          className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="px-4 pt-3 pb-4 text-sm leading-normal text-[#475569]">
                              {typeof answer === "string" ? (
                                <p>{answer}</p>
                              ) : statuses ? (
                                <ul className="space-y-1.5">
                                  {statuses.map((status, index) => (
                                    <li
                                      key={status}
                                      className="flex flex-wrap items-center gap-x-2 gap-y-1"
                                    >
                                      <RequestStatus status={status} />
                                      <span>{answer[index]}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <ol className="list-inside list-decimal">
                                  {answer.map((step) => (
                                    <li key={step}>{step}</li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-lg border border-[#e2e8f0] px-4 py-6">
              <SearchEmptyState query={search.trim()} />
            </div>
          )}
        </div>

        <aside
          className="min-w-0 rounded-lg border border-[#e2e8f0] p-5"
          aria-labelledby="booking-help"
        >
          <h2
            id="booking-help"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <MessageSquare size={20} className="shrink-0" aria-hidden="true" />
            Need help with a booking?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#475569]">
            Open your booking conversation to ask the team a question or follow
            up on an update.
          </p>
          <Button
            asChild
            className="mt-4 bg-[#203f8c] text-white hover:bg-[#172f70]"
          >
            <Link href="/messages">Open messages</Link>
          </Button>
          <p className="mt-2 text-[13px] text-[#475569]">
            Or email us at{" "}
            <a
              href="mailto:support@exp.test"
              className={`break-words rounded-sm text-[#203f8c] hover:underline ${focusRing}`}
            >
              support@exp.test
            </a>
          </p>
        </aside>
      </div>
    </main>
  )
}
