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
      className="grid min-h-svh grid-cols-[minmax(0,60%)_minmax(420px,40%)] bg-white text-[#121b28] max-[1100px]:grid-cols-[minmax(0,55%)_minmax(400px,45%)] max-[850px]:block"
      lang={language}
    >
      {visual}
      <section className="flex min-h-svh min-w-0 flex-col">
        {header}
        {children}
        {footer}
      </section>
    </main>
  )
}
