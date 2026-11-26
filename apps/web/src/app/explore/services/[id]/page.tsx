import { notFound } from "next/navigation"
import { readPublicService } from "@/features/public-services/api/public-service-detail.server"
import { parseInquiryService } from "@/features/public-services/model/service-inquiry-link"
import { PublicServiceDetails } from "@/features/public-services/pages/public-services-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!parseInquiryService(id)) notFound()
  const result = await readPublicService(id)
  if (result.status === "missing") notFound()
  return (
    <PublicServiceDetails
      service={result.status === "available" ? result.service : null}
    />
  )
}
