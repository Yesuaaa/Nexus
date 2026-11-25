import { redirect } from "next/navigation"
import {
  parseInquiryService,
  withInquiryService,
} from "@/features/public-services/model/service-inquiry-link"

export default async function Page({
  params,
}: PageProps<"/explore/services/[id]/inquire">) {
  const { id } = await params
  redirect(withInquiryService("/register", parseInquiryService(id)))
}
