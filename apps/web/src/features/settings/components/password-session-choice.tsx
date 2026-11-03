"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ApiError, clearToken } from "@/features/auth/api/auth-api"
import { revokeAllSessions } from "../api/settings-api"
export function PasswordSessionChoice({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function logout() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await revokeAllSessions()
      clearToken()
      router.replace("/login")
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        clearToken()
        router.replace("/login")
        return
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn’t log out your devices. Please try again.",
      )
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault()
        }}
        className="w-[min(440px,calc(100vw-32px))] rounded-xl p-6"
      >
        <DialogTitle>
          {confirm ? "Log out of all devices?" : "Password changed"}
        </DialogTitle>
        <DialogDescription>
          {confirm
            ? "Are you sure you want to log out of all devices, including this one? You’ll need to sign in again with your new password."
            : "Do you want to log out of all devices?"}
        </DialogDescription>
        {error && (
          <p role="alert" className="m-0 text-xs leading-5 text-[#bc3649]">
            {error}
          </p>
        )}
        <footer className="mt-2 flex flex-wrap justify-end gap-2">
          {confirm ? (
            <>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  setConfirm(false)
                  setError("")
                }}
              >
                Cancel
              </Button>
              <Button
                className="min-h-11 bg-[#bc3649] text-white hover:bg-[#a42f40]"
                disabled={busy}
                onClick={() => void logout()}
              >
                {busy ? "Logging out…" : "Log out all devices"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={onClose}
                autoFocus
              >
                No
              </Button>
              <Button
                className="min-h-11 bg-[#203f8c] text-white hover:bg-[#172f70]"
                onClick={() => setConfirm(true)}
              >
                Yes
              </Button>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  )
}
