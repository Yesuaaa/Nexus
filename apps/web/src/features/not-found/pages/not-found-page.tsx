import { buttonVariants } from "@/components/ui/button-variants"

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Page not found
      </h1>
      <a href="/" className={buttonVariants({ className: "mt-8" })}>
        Go home
      </a>
    </main>
  )
}
