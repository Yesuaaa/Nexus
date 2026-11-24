import { redirect } from "next/navigation"

/**
 * Keep stale Next.js module graphs pointed at the new inquiry flow while the
 * removed public inquiry form is no longer part of the services experience.
 */
export function PublicInquiryPage(props: { id: string }) {
  void props.id
  redirect("/register")
}
