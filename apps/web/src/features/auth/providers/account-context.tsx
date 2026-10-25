"use client"

import { createContext, useContext } from "react"
import type { Account } from "../model/types"

export const AccountContext = createContext<Account | null>(null)

export function usePortalAccount(): Account {
  const account = useContext(AccountContext)
  if (!account) throw new Error("A signed-in portal account is required")
  return account
}
