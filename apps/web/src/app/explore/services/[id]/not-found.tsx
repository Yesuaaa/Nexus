import Link from "next/link"

export default function ServiceNotFound() {
  return (
    <>
      <h1>Service not found</h1>
      <p>This service may no longer be available.</p>
      <Link className="mt-6 inline-block underline" href="/explore/services">
        Explore services
      </Link>
    </>
  )
}
