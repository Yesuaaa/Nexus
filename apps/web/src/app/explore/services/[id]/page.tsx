import { PublicServiceDetails } from "@/features/public-services/pages/public-services-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PublicServiceDetails id={id} />
}
