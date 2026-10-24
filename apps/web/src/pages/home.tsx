import { useState } from "react"
import { Button } from "@/components/ui/button"

type CheckResult = "idle" | "checking" | "connected" | "unavailable"
const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? ""

export function HomePage() {
  const [api, setApi] = useState<CheckResult>("idle")
  const [database, setDatabase] = useState<CheckResult>("idle")

  async function check(path: string, update: (result: CheckResult) => void) {
    update("checking")
    try {
      const response = await fetch(`${apiBaseUrl}${path}`)
      update(response.ok ? "connected" : "unavailable")
    } catch {
      update("unavailable")
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
        React + TypeScript + Vite
      </span>
      <h1 className="mt-7 max-w-2xl text-5xl font-semibold tracking-tight sm:text-6xl">
        Build from a clean foundation.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
        Routing, UI, styling, a server API, and a Prisma connection to Supabase PostgreSQL are wired together.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">API</h2>
          <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
            The Vite dev server forwards /api requests to Express.
          </p>
          <div className="mt-5 flex items-center justify-between gap-4">
            <Status result={api} />
            <Button variant="outline" onClick={() => void check("/api/health", setApi)} disabled={api === "checking"}>
              Check API
            </Button>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Database</h2>
          <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
            Set your Supabase URLs in .env to check the Prisma connection.
          </p>
          <div className="mt-5 flex items-center justify-between gap-4">
            <Status result={database} />
            <Button onClick={() => void check("/api/db-check", setDatabase)} disabled={database === "checking"}>
              Check database
            </Button>
          </div>
        </section>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Start with <code className="rounded bg-muted px-1.5 py-1 text-foreground">README.md</code> for setup and migration commands.
      </p>
    </main>
  )
}

function Status({ result }: { result: CheckResult }) {
  const labels: Record<CheckResult, string> = {
    idle: "Not checked",
    checking: "Checking…",
    connected: "Connected",
    unavailable: "Unavailable",
  }
  return (
    <span role="status" className={result === "connected" ? "text-sm font-medium text-emerald-700" : "text-sm text-muted-foreground"}>
      {labels[result]}
    </span>
  )
}
