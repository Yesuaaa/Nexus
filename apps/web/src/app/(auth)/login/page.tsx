import { AuthPage } from "@/features/auth/pages/auth-page"
import { parseInquiryService } from "@/features/public-services/model/service-inquiry-link"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthPage
      mode="login"
      inquiryService={parseInquiryService((await searchParams).service)}
    />
  )
}
