"use client"

import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { X } from "lucide-react"

type ClientProfile = {
  id: string
  fullName: string | null
  email: string
  contactNumber: string | null
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "C"
  )
}

export function ClientProfileDialog({
  client,
  onClose,
}: {
  client: ClientProfile
  onClose: () => void
}) {
  const { open, handleOpenChange, closeAfterTransition } =
    useAnimatedPanelClose(onClose)
  const name = client.fullName?.trim() || "Client"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay z-[110] bg-[rgb(13_28_57_/_58%)]"
        className="nexus-detail-dialog z-[110] flex max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] max-w-[560px] flex-col gap-0 overflow-hidden rounded-2xl border border-[#dce3ee] bg-white p-0 text-[#17243a] shadow-[0_24px_80px_rgb(7_20_48_/_28%)] max-[560px]:max-h-[calc(100dvh-20px)] max-[560px]:w-[calc(100vw-20px)]"
      >
        <div
          aria-hidden="true"
          className="relative h-28 shrink-0 overflow-hidden bg-[#203f8c]"
        >
          <span className="absolute -top-20 -right-6 size-56 rounded-full border-[24px] border-white/10" />
          <span className="absolute -bottom-24 left-[35%] size-48 rounded-full bg-white/5" />
        </div>
        <div className="relative -mt-11 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 max-[560px]:px-5">
          <div className="flex items-end justify-between gap-3">
            <span
              aria-hidden="true"
              className="grid size-[88px] shrink-0 place-items-center rounded-full border-4 border-white bg-[#eef2f8] text-xl font-semibold text-[#294a9b] shadow-sm"
            >
              {initials(name)}
            </span>
            <Button
              type="button"
              variant="outline"
              aria-label="Close client profile"
              className="size-10 shrink-0 p-0 text-[#52627a]"
              onClick={() => closeAfterTransition()}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
          <header className="mt-3 border-b border-[#e8ebef] pb-5">
            <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-[#52627a] uppercase">
              Client profile
            </p>
            <DialogTitle className="mt-1 text-xl leading-7 font-semibold tracking-[-0.025em] text-[#17243a]">
              {name}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-5 text-[#52627a]">
              Contact information for this service request.
            </DialogDescription>
          </header>
          <section aria-label="Contact information" className="pt-5">
            <h3 className="m-0 text-xs font-semibold text-[#17243a]">
              Contact information
            </h3>
            <dl className="mt-3 divide-y divide-[#e8ebef] rounded-xl border border-[#e8ebef] px-4">
              <div className="grid gap-1.5 py-3">
                <dt className="text-[11px] font-medium text-[#52627a]">
                  Email address
                </dt>
                <dd className="m-0 min-w-0 break-all text-xs font-medium">
                  <a
                    className="text-[#294a9b] underline-offset-2 hover:underline"
                    href={`mailto:${client.email}`}
                  >
                    {client.email}
                  </a>
                </dd>
              </div>
              <div className="grid gap-1.5 py-3">
                <dt className="text-[11px] font-medium text-[#52627a]">
                  Contact number
                </dt>
                <dd className="m-0 min-w-0 break-all text-xs font-medium">
                  {client.contactNumber?.trim() || "Not provided"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
