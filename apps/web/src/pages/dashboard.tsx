import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import {
  ApiError,
  clearToken,
  getCurrentAccount,
  getToken,
  signOut,
  type Account,
} from "@/lib/auth"

const roleLabels: Record<Account["role"], string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "User",
}

export function DashboardPage({
  onReady,
}: {
  onReady?: (succeeded: boolean) => void
}) {
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!getToken()) {
      onReady?.(false)
      navigate("/login", { replace: true })
      return
    }
    let active = true
    getCurrentAccount()
      .then(({ user }) => {
        if (active) {
          setAccount(user)
          onReady?.(true)
        }
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) {
          clearToken()
          navigate("/login", { replace: true })
        } else {
          setError(
            "We couldn't load your account. Please refresh to try again.",
          )
        }
        onReady?.(false)
      })
    return () => {
      active = false
    }
  }, [navigate, onReady])

  async function handleSignOut() {
    try {
      await signOut()
      navigate("/login", { replace: true })
      sileo.success({ title: "Signed out", description: "See you next time." })
    } catch {
      sileo.error({
        title: "Couldn't sign out",
        description: "Please try again.",
      })
    }
  }

  return (
    <main className="min-h-svh bg-[#f5f8fc] text-[#17213a]">
      <header className="border-b border-[#e4eaf4] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <img src="/auth/exp-logo.svg" alt="EXP" width="93" height="48" />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSignOut()}
            className="rounded-full border border-[#d7e0ee] px-5 py-2 text-sm font-semibold text-[#28438b] hover:bg-[#f3f7fd]"
          >
            Sign Out
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-16">
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-white p-6 text-[#9e3447] shadow-sm"
          >
            {error}
          </p>
        ) : account ? (
          <section className="rounded-2xl border border-[#e4eaf4] bg-white p-8 shadow-sm sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#20a9bf]">
              Your account
            </p>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              Welcome{account.fullName ? `, ${account.fullName}` : " back"}.
            </h1>
            <p className="mt-4 text-[#5a6f95]">
              You're signed in as {roleLabels[account.role]}.
            </p>
            <div className="mt-10 grid gap-4 border-t border-[#e9edf5] pt-8 text-sm sm:grid-cols-2">
              <div>
                <p className="font-semibold text-[#7b8dac]">Email address</p>
                <p className="mt-2 break-all font-medium">{account.email}</p>
              </div>
              <div>
                <p className="font-semibold text-[#7b8dac]">Account role</p>
                <p className="mt-2 font-medium">{roleLabels[account.role]}</p>
              </div>
            </div>
          </section>
        ) : (
          <p role="status" className="text-[#5a6f95]">
            Loading your account…
          </p>
        )}
      </div>
    </main>
  )
}
