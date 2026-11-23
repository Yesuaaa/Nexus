# Converyn landing page

The public homepage is implemented at `/` with Inter and the palette `#F2F1EE`, `#121214`, and `#2F5BFF`. The brand name is plain text; there is no logo artwork.

## Implemented scope

The landing page includes the hero image grid, brief service preview, marquee, Discover/Connect/Create carousel, about section, FAQs, and hover-only footer.

The public Services module is implemented in source at /explore/services, with active-service search, details, public plans, and guest inquiries. The administrative inbox is /service-inquiries. Landing-page service/conversation CTAs open the public catalog. Log in and Sign up keep their existing account routes. Contact navigation opens the homepage contact section; its conversation button opens the public service catalog. Service previews link to the catalog, which provides View details and Inquire actions. All footer entries remain non-clickable.

See docs/features/public-services-inquiries.md for API contracts, schema, permissions, safeguards, and migration requirements. Inquiry submission is separate from booking, projects, employee assignment, invoices, and payments.

No tests, builds, formatters, lint, typecheck, or regression commands were run, as requested. Prisma client generation was run because the database model changed. The additive ServiceInquiry migration was applied to the configured Supabase database on 2026-11-15. This is not a claim of passing application verification.

## Current image assets

Eight referenced images are retained. Unrelated footwear, skincare, and generic camera campaign assets have been removed. The hero uses people and digital-work imagery, treated with charcoal outer ribbons and cobalt inner accents so the future mark's silhouette is clear against the cream page.

The about cards reuse earlier generated portraits of creative and technology professionals, rotating to the right every 2.8 seconds with 650 ms movement. They pause on hover, focus, offscreen, and hidden tabs, and do not autoplay for reduced motion. The marquee has no plus separators, service previews have no icons, and the FAQ uses one native exclusive details group.

| Asset                            | Placement                                              |
| -------------------------------- | ------------------------------------------------------ |
| converyn-grid-mobile.webp        | Hero: first cobalt accent                              |
| converyn-product-discover.webp   | Discover carousel card                                 |
| converyn-product-connect.webp    | Connect carousel card                                  |
| converyn-product-create.webp     | Create carousel card; hero: second cobalt accent       |
| converyn-team-strategy.webp      | About: creative direction; hero: third cobalt accent   |
| converyn-team-conversation.webp  | About: brand storytelling; hero: lower charcoal ribbon |
| converyn-team-design.webp        | About: visual content; hero: diagonal charcoal ribbon  |
| converyn-team-collaboration.webp | Hero: upper charcoal ribbon                            |

These assets were originally generated with the built-in image-generation tool and restored from the saved originals. They are illustrative scenes, not actual employees or client work. No new image-generation request was needed for this update. Palette: #F2F1EE, #121214, #2F5BFF.

## Generation prompts

### converyn-grid-mobile.webp

Use case: product-mockup. Asset type: narrow portrait tile in a digital services homepage hero grid. Close editorial studio photograph of a black smartphone standing slightly angled against a warm off-white sculptural block. The screen shows a beautiful generic abstract website concept in cream, charcoal, and cobalt, simple image tiles and horizontal placeholder lines with no readable text, no numbers, no brand. Tight portrait 2:3 composition, premium product photography, focus on the elegant phone and tactile neutral surroundings. Converyn palette: warm off-white #F2F1EE, near-black #121214, vivid cobalt #2F5BFF. Premium natural product photography, tactile materials, soft directional studio daylight, subtle grain. No people, hands, readable text, logos, watermark or superimposed graphics.

### converyn-product-discover.webp

Use case: product-mockup. Asset type: portrait Discover card image for a digital services homepage carousel. Editorial overhead photograph of an art-directed brand exploration kit: thick off-white paper sheets, cobalt blue color cards, charcoal unbranded booklet, a metal ruler, and printed abstract composition studies neatly arranged on a pale stone table. A visual story about discovery and design direction, focus on materials and carefully arranged objects. Portrait 3:4 composition, main objects in top two thirds leaving dark charcoal paper in lower quarter for an overlay. Converyn palette: warm off-white #F2F1EE, near-black #121214, vivid cobalt #2F5BFF. Premium natural product photography, tactile materials, soft directional studio daylight, subtle grain. No people, hands, readable text, logos, watermark or superimposed graphics.

### converyn-product-connect.webp

Use case: product-mockup. Asset type: portrait Connect card image for a digital services homepage carousel. Elegant premium photograph of a charcoal laptop and black smartphone together on a warm off-white desk, both displaying coordinated abstract cream-and-cobalt digital interface layouts with cards and lines but no readable text. The devices form a complementary pair, a cobalt notebook and small chrome desk object add tactility. Soft side light, warm neutral background, carefully designed product arrangement. Portrait 3:4 framing, screens in upper two thirds and uncluttered dark desk foreground in lower quarter for an overlay. Converyn palette: warm off-white #F2F1EE, near-black #121214, vivid cobalt #2F5BFF. Premium natural product photography, tactile materials, soft directional studio daylight, subtle grain. No people, hands, readable text, logos, watermark or superimposed graphics.

### converyn-product-create.webp

Use case: product-mockup. Asset type: portrait Create card image for a digital services homepage carousel. Premium design studio product photograph of a large desktop screen displaying a beautiful finished abstract website concept with bold cobalt blue sculptural imagery and warm cream layout, next to a charcoal wireless keyboard, pen tablet and stylus on a warm off-white desk. No person or hands. A cobalt ceramic cup adds a restrained accent. Intentional physical product composition, realistic glass and metal, natural daylight. Portrait 3:4 framing with monitor in upper two thirds and dark foreground for website overlay. Converyn palette: warm off-white #F2F1EE, near-black #121214, vivid cobalt #2F5BFF. Premium natural product photography, tactile materials, soft directional studio daylight, subtle grain. No people, hands, readable text, logos, watermark or superimposed graphics.

### converyn-team-strategy.webp

Use case: photorealistic-natural. Asset type: portrait image for the Discover step of Converyn digital services homepage. Premium candid editorial photograph of a Filipino female brand strategist seated at a warm off-white studio desk thoughtfully reviewing pinned visual inspiration, printed website wireframes and a few cobalt blue color swatches. Natural side profile, hands handling paper, soft window light, real skin texture, textured charcoal knit top. Palette warm off-white #F2F1EE, charcoal #121214, occasional cobalt #2F5BFF. Frame subject in upper two thirds leaving uncluttered dark desk area in lower quarter for website overlay. Portrait 3:4 crop, modern independent creative studio, warm editorial film color, no readable text, logos, watermarks, no superimposed graphics. Illustrative photograph, not actual employee.

### converyn-team-conversation.webp

Use case: photorealistic-natural. Asset type: portrait image for the Connect step of Converyn digital services homepage. Premium candid editorial photograph of two Filipino creative professionals having a focused but relaxed project conversation across a small studio table, one gesturing thoughtfully and one listening, visible laptop and notebook, authentic expressions and natural skin texture, no staged handshake. Warm off-white #F2F1EE walls, charcoal #121214 clothes, subtle cobalt blue #2F5BFF notebook accent. Directional daylight, dark foreground in lower quarter for website text overlay, portrait 3:4 composition, modern independent studio, warm documentary film color. No readable text, logos, watermarks, superimposed graphics. Illustrative photograph, not actual employees.

### converyn-team-design.webp

Use case: photorealistic-natural. Asset type: portrait image for the Create step of Converyn digital services homepage. Premium close editorial photograph of a Filipino digital designer working at an uncluttered creative studio desk, three-quarter side view of person and hands drawing a website layout on a pen tablet next to an open laptop with abstract non-readable design panels. Charcoal #121214 clothing, warm off-white #F2F1EE interior, cobalt blue #2F5BFF stationery accent, real skin texture, subtle grain, soft directional window light. Subject in upper two thirds, dark desk foreground in lower quarter for website text overlay. Portrait 3:4 framing, considered tactile atmosphere. No readable text, logos, watermark, superimposed graphics. Illustrative photograph, not actual employee.

### converyn-team-collaboration.webp

Use case: photorealistic-natural. Asset type: Converyn digital services homepage editorial illustration photograph. Three Filipino creative and technology professionals collaborating over a laptop, paper website wireframes and color swatches at a light stone worktable in a contemporary independent studio. Authentic candid gestures and natural expressions, a designer explaining a visual concept while a developer takes notes, no staged handshakes. Warm off-white walls #F2F1EE, charcoal clothing #121214, a few tasteful vivid cobalt blue #2F5BFF accents in a notebook and office objects, subtle chrome desk lamp, soft daylight through a large window. Premium editorial documentary photography, natural skin texture, slightly grainy tactile image, landscape 3:2 composition with all subjects fully in frame. Imagery represents collaboration, not actual employees. No readable text, logos, brand marks, watermarks or superimposed graphics.

## Connected navigation and API recovery

The upper hero ribbon and diagonal arm now share one clipping path, removing the broken join. The local API container was restarted after its watcher had stopped on a route import before that new file existed. Focused read-only requests confirmed that the catalog, service-detail API, service-detail page, and inquiry page respond with HTTP 200 through the web proxy. The catalog returned 20 active services, paginated 12 per page. No inquiry was submitted during diagnosis and no test suites, lint, typecheck, build, or regression commands were run.
