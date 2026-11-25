import type { ReactNode } from "react"

type AuthLayoutProps = {
  centered?: boolean
  clientSplit?: boolean
  language: string
  visual: ReactNode
  header: ReactNode
  footer: ReactNode
  children: ReactNode
}

export function AuthLayout({
  centered = false,
  clientSplit = false,
  language,
  visual,
  header,
  footer,
  children,
}: AuthLayoutProps) {
  if (centered) {
    return (
      <main
        className="relative min-h-svh overflow-hidden bg-[#f3f6fa] text-foreground"
        lang={language}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,_rgba(57,92,132,0.18)_1px,_transparent_1px)] bg-[length:18px_18px] opacity-70"
        />
        <div className="relative z-10 flex min-h-svh flex-col">
          {header}
          <section className="flex flex-1 items-center justify-center px-5 pt-4 pb-16 sm:px-6">
            {children}
          </section>
          {footer}
        </div>
      </main>
    )
  }
  if (clientSplit) {
    return (
      <main
        className="grid h-screen min-h-0 grid-cols-[minmax(0,60%)_minmax(400px,40%)] overflow-hidden bg-background text-foreground max-[850px]:block"
        lang={language}
      >
        {visual}
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-background">
          {header}
          {children}
          {footer}
        </section>
      </main>
    )
  }
  return (
    <main
      className="grid h-svh overflow-hidden grid-cols-[minmax(0,57%)_minmax(440px,43%)] bg-background text-foreground max-[1100px]:grid-cols-[minmax(0,52%)_minmax(400px,48%)] max-[850px]:block max-[850px]:h-auto max-[850px]:min-h-svh max-[850px]:overflow-visible"
      lang={language}
    >
      {visual}
      <section className="flex h-svh min-h-0 min-w-0 flex-col overflow-hidden max-[850px]:h-auto max-[850px]:min-h-svh max-[850px]:overflow-visible">
        {header}
        {children}
        {footer}
      </section>
    </main>
  )
}
