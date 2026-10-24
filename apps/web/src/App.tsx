import { NavLink, Route, Routes } from "react-router"
import { HomePage } from "@/pages/home"
import { NotFoundPage } from "@/pages/not-found"

export default function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="font-semibold tracking-tight">Nexus Starter</span>
          <nav aria-label="Main navigation" className="flex gap-5 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              About
            </NavLink>
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">
        About this starter
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Ready for your app.
      </h1>
      <p className="mt-5 max-w-xl leading-7 text-muted-foreground">
        React Router handles pages. The Express API runs Prisma on the server
        and connects to Supabase PostgreSQL. Add your own models in
        prisma/schema.prisma and UI components with the shadcn CLI.
      </p>
    </main>
  )
}
