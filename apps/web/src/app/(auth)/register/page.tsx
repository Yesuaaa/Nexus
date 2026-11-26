import { AuthPage } from "@/features/auth/pages/auth-page"
import { parseInquiryService } from "@/features/public-services/model/service-inquiry-link"

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  return (
    <AuthPage
      mode="register"
      inquiryService={parseInquiryService((await searchParams).service)}
    />
  )
}
