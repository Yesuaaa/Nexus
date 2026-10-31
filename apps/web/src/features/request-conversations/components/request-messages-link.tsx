import Link from "next/link"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RequestMessagesLink({ requestId }: { requestId: string }) {
  return (
    <Button asChild variant="outline" className="mt-4 text-xs">
      <Link href={`/messages?request=${encodeURIComponent(requestId)}`}>
        <MessageSquare size={15} aria-hidden="true" />
        Open request workspace
      </Link>
    </Button>
  )
}
