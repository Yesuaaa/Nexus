import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import type { ServiceRequestSummary } from "../api/client-services-api"
import {
  requestDate,
  serviceRequestStatuses,
} from "../model/service-request-status"

export function RequestStatus({
  status,
}: {
  status: ServiceRequestSummary["status"]
}) {
  const value = serviceRequestStatuses[status]
  return <Pill className={value.className}>{value.label}</Pill>
}

export function ClientRequestsTable({
  requests,
  onView,
}: {
  requests: ServiceRequestSummary[]
  onView: (request: ServiceRequestSummary) => void
}) {
  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[#e8ebef] @max-[900px]:hidden">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <caption className="sr-only">Your service requests</caption>
          <thead className="bg-[#e8eef2] text-[#52627a]">
            <tr>
              {["Request", "Service & package", "Status", "Submitted", ""].map(
                (label, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={
                      index === 4
                        ? "w-20 px-3 py-3 font-medium"
                        : "px-4 py-3 font-medium"
                    }
                  >
                    {label || <span className="sr-only">Actions</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className="border-t border-[#eceef1] align-top hover:bg-[#f8fafd]"
              >
                <td className="px-4 py-4">
                  <button
                    onClick={() => onView(request)}
                    className="cursor-pointer rounded text-left font-semibold text-[#244993] hover:underline focus-visible:outline-2 focus-visible:outline-[#294c96]"
                  >
                    {request.title}
                  </button>
                  <p className="mt-1 mb-0 break-all text-[10px] text-[#738096]">
                    {request.referenceNumber || request.id}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <span className="block break-words font-medium">
                    {request.service.name}
                  </span>
                  <span className="mt-1 block text-[11px] text-[#738096]">
                    {request.packageName ||
                      request.package?.name ||
                      "Standard service"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <RequestStatus status={request.status} />
                </td>
                <td className="px-4 py-4 text-[#52627a]">
                  <time dateTime={request.createdAt}>
                    {requestDate(request.createdAt)}
                  </time>
                </td>
                <td className="px-3 py-3">
                  <Button
                    variant="outline"
                    className="size-8 p-0"
                    aria-label={`View ${request.title}`}
                    onClick={() => onView(request)}
                  >
                    <Eye size={15} aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="hidden gap-3 @max-[900px]:grid"
        role="list"
        aria-label="Your service requests"
      >
        {requests.map((request) => (
          <article
            key={request.id}
            role="listitem"
            className="min-w-0 rounded-lg border border-[#e1e4ea] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="m-0 min-w-0 break-words text-sm font-semibold">
                {request.title}
              </h2>
              <RequestStatus status={request.status} />
            </div>
            <p className="mt-1 mb-3 break-all text-[10px] text-[#738096]">
              {request.referenceNumber || request.id}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[#738096]">Service</dt>
                <dd className="mt-1 ml-0 break-words font-medium">
                  {request.service.name}
                </dd>
              </div>
              <div>
                <dt className="text-[#738096]">Package</dt>
                <dd className="mt-1 ml-0 break-words font-medium">
                  {request.packageName ||
                    request.package?.name ||
                    "Standard service"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#eceef1] pt-3">
              <time
                className="text-[11px] text-[#52627a]"
                dateTime={request.createdAt}
              >
                {requestDate(request.createdAt)}
              </time>
              <Button
                variant="outline"
                className="h-9 text-xs"
                aria-label={`View ${request.title}`}
                onClick={() => onView(request)}
              >
                <Eye size={14} aria-hidden="true" />
                View details
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
