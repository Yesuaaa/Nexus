import { createServer } from "node:http"

const service = {
  id: "service-1",
  name: "Test Service",
  description: "A service available to public visitors.",
  iconKey: "design",
  imageUrl: "/favicon.svg",
  imageAltText: "Service preview",
  clientRequirements: [],
  keyBenefits: [
    { id: "benefit", title: "A clearer identity", description: "Stand out." },
  ],
  packages: [],
  pricing: null,
}

const project = {
  slug: "jollybee",
  name: "Jollybee",
  client: "Jollybee",
  type: "Brand campaign",
  image: "/landing/converyn-product-discover.webp",
  fictional: true,
}

createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://127.0.0.1")
  response.setHeader("Content-Type", "application/json")
  if (pathname === "/api/public/services") {
    response.end(
      JSON.stringify({ services: [service], total: 1, page: 1, pageSize: 12 }),
    )
  } else if (pathname === "/api/public/services/service-1") {
    setTimeout(() => response.end(JSON.stringify({ service })), 1_500)
  } else if (pathname === "/api/public/projects") {
    response.end(JSON.stringify({ projects: [project] }))
  } else if (pathname === "/api/public/projects/jollybee") {
    response.end(
      JSON.stringify({
        project: {
          ...project,
          year: 2026,
          description: "A fictional brand campaign.",
          galleryLayout: "pair-lead",
          additionalImages: ["/landing/converyn-team-design.webp"],
        },
      }),
    )
  } else {
    response.writeHead(404).end(JSON.stringify({ error: "Service not found" }))
  }
}).listen(5274, "127.0.0.1")
