import { PublicInquiryPage } from "@/features/public-services/pages/public-inquiry-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PublicInquiryPage id={id} />
}
