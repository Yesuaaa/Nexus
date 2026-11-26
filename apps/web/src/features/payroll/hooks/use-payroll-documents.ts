"use client"

import { useState } from "react"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import {
  apiRequest,
  downloadAuthenticatedFile,
} from "@/features/auth/api/auth-api"
import {
  canAccessPayroll,
  canManagePayroll,
} from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { humanizeEnum } from "@/lib/format"
import { sileo } from "@/lib/toast"
import { useAsyncResource } from "@/lib/use-async-resource"
import { getPayrollPreferences } from "../api/payroll-api"
import { listPayrollRuns, type PayrollRun } from "../api/payroll-runs-api"
import {
  type Payslip,
  type Request,
  type Page,
  relatedPayslipTypes,
  requestTypes,
} from "../model/payroll-documents"

/** State, data and actions shared by the payroll document views. */
export function usePayrollDocuments({ staff = false }: { staff?: boolean }) {
  const account = usePortalAccount()
  const manage = !staff && canManagePayroll(account)
  const preferences = useAsyncResource(getPayrollPreferences, [], {
    enabled: manage,
  })
  const base = staff ? "/api/staff/my-payroll" : "/api/payroll"
  const [slipPage, setSlipPage] = useState(1)
  const [requestPage, setRequestPage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const [runSearch, setRunSearch] = useState("")
  const [search, setSearch] = useState("")
  const [publication, setPublication] = useState("")
  const [requestStatus, setRequestStatus] = useState("")
  const [requestType, setRequestType] = useState("")
  const [requestSearch, setRequestSearch] = useState("")
  const { query: settledRequestQuery, pending: requestSearchPending } =
    useTableSearchQuery(requestSearch)
  const { query: payslipQuery, pending: payslipSearchPending } =
    useTableSearchQuery(search)
  const { query: runQuery, pending: runSearchPending } =
    useTableSearchQuery(runSearch)
  const requestQuery = requestSearch.trim()
  const [refresh, setRefresh] = useState(0)
  const [slip, setSlip] = useState<Payslip | null>(null)
  const [selected, setSelected] = useState<Request | null>(null)
  const [create, setCreate] = useState(false)
  const [editing, setEditing] = useState(false)
  const [withdrawal, setWithdrawal] = useState<Request | null>(null)
  const [withdrawalError, setWithdrawalError] = useState("")
  const [type, setType] = useState("")
  const [related, setRelated] = useState("")
  const [body, setBody] = useState("")
  const [bodyTouched, setBodyTouched] = useState(false)
  const [status, setStatus] = useState("")
  const [correction, setCorrection] = useState<boolean | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [discardResponseConfirm, setDiscardResponseConfirm] = useState(false)
  const [confirm, setConfirm] = useState<{
    action: "generate" | "publish"
    run: PayrollRun
  } | null>(null)
  const [activeTab, setActiveTab] = useState("payslips")
  const [selectedRunId, setSelectedRunId] = useState("")
  const overview = useAsyncResource(
    (signal) =>
      apiRequest<{
        linked: boolean
        latestPayslip: Payslip | null
        recentRequests: Request[]
        openConcernCount: number
      }>(base, { signal }),
    [base, refresh],
    { enabled: staff, fallbackError: "Couldn't load My Payroll." },
  )
  const slips = useAsyncResource(
    (signal) =>
      apiRequest<Page<Payslip>>(
        base +
          "/payslips?" +
          new URLSearchParams({
            page: String(slipPage),
            search: payslipQuery,
            status: publication,
          }),
        { signal },
      ),
    [base, slipPage, payslipQuery, publication, refresh, activeTab],
    {
      enabled: !payslipSearchPending && (staff || activeTab === "payslips"),
      fallbackError: "Couldn't load payslips.",
    },
  )
  const relatedPayslips = useAsyncResource(
    async (signal) => {
      const getPage = (page: number) =>
        apiRequest<Page<Payslip>>(
          base + "/payslips?" + new URLSearchParams({ page: String(page) }),
          { signal },
        )
      const first = await getPage(1)
      const totalPages =
        first.pageSize > 0 ? Math.ceil(first.total / first.pageSize) : 1
      if (totalPages <= 1) return first.rows
      const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          getPage(index + 2),
        ),
      )
      return first.rows.concat(...remaining.map((page) => page.rows))
    },
    [base, refresh],
    {
      enabled: staff && create && relatedPayslipTypes.has(type),
      fallbackError: "Couldn't load your published payslips.",
      initialData: [] as Payslip[],
    },
  )
  const requests = useAsyncResource(
    (signal) =>
      apiRequest<Page<Request>>(
        base +
          "/requests?" +
          new URLSearchParams({
            page: String(requestPage),
            status: requestStatus,
            type: requestType,
            search: settledRequestQuery,
          }),
        { signal },
      ),
    [
      base,
      requestPage,
      requestStatus,
      requestType,
      settledRequestQuery,
      activeTab,
      refresh,
    ],
    {
      enabled: !requestSearchPending && (staff || activeTab === "requests"),
      fallbackError: staff
        ? "Couldn't load payroll concerns."
        : "Couldn't load payroll requests.",
    },
  )
  const requestDetail = useAsyncResource(
    (signal) =>
      apiRequest<Request>(
        base + "/requests/" + encodeURIComponent(selected!.id),
        { signal },
      ),
    [base, selected?.id, refresh],
    {
      enabled: Boolean(selected),
      fallbackError: "Couldn't load payroll concern details.",
    },
  )
  const runs = useAsyncResource(
    (signal) =>
      listPayrollRuns({
        page: runPage,
        search: runQuery,
        status: "APPROVED",
        signal,
      }),
    [runPage, runQuery, refresh, activeTab],
    {
      enabled:
        !staff &&
        canAccessPayroll(account) &&
        activeTab === "runs" &&
        !runSearchPending,
      fallbackError: "Couldn't load approved runs.",
    },
  )

  function resetForm() {
    setError("")
    setBody("")
    setBodyTouched(false)
    setType("")
    setRelated("")
    setStatus("")
    setCorrection(undefined)
    setEditing(false)
  }

  async function mutate(path: string, data?: object, method = "POST") {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const result = await apiRequest<
        Request | { changed: number; total: number }
      >(base + path, {
        method,
        ...(data ? { body: JSON.stringify(data) } : {}),
      })
      if ("messages" in result && selected) setSelected(result)
      if ("changed" in result)
        sileo.success({
          title: path.endsWith("/publish-payslips")
            ? "Payslips published"
            : "Payslips generated",
          description: result.changed + " updated · " + result.total + " total",
        })
      else
        sileo.success({
          title: editing
            ? "Payroll concern updated"
            : create
              ? staff
                ? "Payroll concern submitted"
                : "Payroll request submitted"
              : staff
                ? "Payroll concern updated"
                : "Payroll request updated",
        })
      setCreate(false)
      setConfirm(null)
      resetForm()
      setRefresh((value) => value + 1)
    } catch (cause) {
      const message = errorMessage(cause, "Couldn't save the payroll change.")
      setError(message)
      if (!confirm && path.endsWith("/publish-payslips"))
        sileo.error({ title: message })
    } finally {
      setBusy(false)
    }
  }

  async function withdrawConcern() {
    if (!withdrawal || busy) return
    setBusy(true)
    setWithdrawalError("")
    try {
      await apiRequest(
        base + "/requests/" + encodeURIComponent(withdrawal.id),
        {
          method: "DELETE",
        },
      )
      sileo.success({ title: "Payroll concern deleted" })
      setWithdrawal(null)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setWithdrawalError(errorMessage(cause, "Couldn't delete the concern."))
    } finally {
      setBusy(false)
    }
  }

  async function download(row: Payslip) {
    try {
      await downloadAuthenticatedFile(
        base + "/payslips/" + encodeURIComponent(row.id) + "/download",
        row.reference + ".pdf",
      )
    } catch {
      sileo.error({ title: "Couldn't download the payslip" })
    }
  }

  const openRequest =
    selected?.status === "OPEN" || selected?.status === "IN_REVIEW"
  const hasUnsavedResponseChanges = Boolean(
    manage &&
    !create &&
    selected &&
    (status ||
      body.length > 0 ||
      (correction !== undefined &&
        correction !== selected.needsFinancialCorrection)),
  )
  const transitions = (
    selected?.status === "OPEN"
      ? ["IN_REVIEW", "CLOSED"]
      : ["RESOLVED", "CLOSED"]
  ).map((value) => ({ value, label: humanizeEnum(value) }))
  const trimmedConcernBody = body.trim()
  const concernTypeValid = requestTypes.some((option) => option.value === type)
  const concernBodyValid =
    trimmedConcernBody.length >= 5 && trimmedConcernBody.length <= 2000
  const concernFormValid = concernTypeValid && concernBodyValid && !busy
  const concernBodyError =
    bodyTouched && !concernBodyValid
      ? trimmedConcernBody.length === 0
        ? "Enter a description."
        : trimmedConcernBody.length < 5
          ? "Enter at least 5 non-whitespace characters."
          : "Enter no more than 2,000 characters."
      : ""

  function closeSelectedRequest() {
    if (hasUnsavedResponseChanges) {
      setDiscardResponseConfirm(true)
      return
    }
    setCreate(false)
    setSelected(null)
    resetForm()
  }

  const emptyPayslips = Boolean(
    staff &&
    slips.data &&
    slips.data.total === 0 &&
    !slips.loading &&
    !slips.error,
  )
  const emptyConcerns = Boolean(
    staff &&
    requests.data &&
    requests.data.total === 0 &&
    !requests.loading &&
    !requestSearchPending &&
    !requests.error,
  )
  const selectedDetails =
    requestDetail.data?.id === selected?.id ? requestDetail.data : selected
  const selectedRequestDescription = selectedDetails?.messages.find(
    (entry) => !entry.isAdmin,
  )
  const requestConversation = selectedDetails?.messages.filter(
    (entry) => entry.id !== selectedRequestDescription?.id,
  )
  const concernFiltersActive = Boolean(
    requestQuery || requestStatus || requestType,
  )
  const startRequest = () => {
    setSelected(null)
    resetForm()
    setCreate(true)
  }
  const startEdit = (row: Request) => {
    const originalDescription = row.messages.find((entry) => !entry.isAdmin)
    resetForm()
    setSelected(row)
    setType(row.type)
    setRelated(row.payslip?.id ?? "")
    setBody(originalDescription?.body ?? "")
    setCreate(true)
    setEditing(true)
  }

  return {
    account,
    manage,
    preferences,
    setSlipPage,
    setRequestPage,
    setRunPage,
    runSearch,
    setRunSearch,
    search,
    setSearch,
    publication,
    setPublication,
    requestStatus,
    setRequestStatus,
    requestType,
    setRequestType,
    requestSearch,
    setRequestSearch,
    requestSearchPending,
    payslipSearchPending,
    runSearchPending,
    requestQuery,
    refresh,
    setRefresh,
    slip,
    setSlip,
    selected,
    setSelected,
    create,
    setCreate,
    editing,
    withdrawal,
    setWithdrawal,
    withdrawalError,
    setWithdrawalError,
    type,
    setType,
    related,
    setRelated,
    body,
    setBody,
    setBodyTouched,
    status,
    setStatus,
    correction,
    setCorrection,
    busy,
    error,
    setError,
    discardResponseConfirm,
    setDiscardResponseConfirm,
    confirm,
    setConfirm,
    activeTab,
    setActiveTab,
    selectedRunId,
    setSelectedRunId,
    overview,
    slips,
    relatedPayslips,
    requests,
    requestDetail,
    runs,
    resetForm,
    mutate,
    withdrawConcern,
    download,
    openRequest,
    hasUnsavedResponseChanges,
    transitions,
    trimmedConcernBody,
    concernTypeValid,
    concernBodyValid,
    concernFormValid,
    concernBodyError,
    closeSelectedRequest,
    emptyPayslips,
    emptyConcerns,
    selectedDetails,
    selectedRequestDescription,
    requestConversation,
    concernFiltersActive,
    startRequest,
    startEdit,
    staff,
  }
}

export type PayrollDocumentsState = ReturnType<typeof usePayrollDocuments>
