import type { ReactNode } from "react"

type AuthLayoutProps = {
  language: string
  visual: ReactNode
  header: ReactNode
  footer: ReactNode
  children: ReactNode
}

export function AuthLayout({
  language,
  visual,
  header,
  footer,
  children,
}: AuthLayoutProps) {
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
