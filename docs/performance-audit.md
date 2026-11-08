# Production performance audit

Date: 2026-11-08. Application: Nexus web, Next.js 16.4.3 / React 19.3.1.

## Scope and measurement conditions

The audit examined the shared layouts, providers, auth flow, frontend imports, assets, polling, formatting, and route loading graph. Next's production analyzer covered all 21 routes, including dynamic routes and the not-found route. Lighthouse sampled public login/registration, both Services roles, Employees, Messages, and department-head Workload. Browser regression tests cover the wider business workflows.

The baseline is the working application at the start of this request, including the earlier auth image and experimental inline-CSS changes. It is not an untouched Git baseline. The supplied screenshot appears to be a development audit; the measurements here use the standalone production server.

- Lighthouse 13.6.0; headless Chromium 151.0.0.0; Node 24.18.0; Windows x64.
- Standard Lighthouse mobile simulation: 412 × 823, 1.75 DPR, 4× CPU slowdown, 150 ms RTT, 1,638.4 Kbit/s throughput.
- Standard desktop simulation: 1350 × 940, 1× CPU, 40 ms RTT, 10,240 Kbit/s throughput.
- A fresh browser context for each navigation. Final measurements run serially, without concurrent builds or test workers. Server/image caches may be warm.
- Auth pages use the actual production frontend without API fixtures. Protected routes use explicit, read-only synthetic API responses with an 80 ms response delay. Services has 24 records, Employees returns ten records with a total of 100, and Workload has 50 staff. These measurements isolate frontend costs; they do not measure live API/database performance.
- Repeated results use three runs and report medians. Single-run exploratory results are identified separately. Scores vary with host load; a 90 target is not a guarantee for every route or deployment.

Raw HTML/JSON reports and run settings are stored in `.tmp/performance/`. They are excluded from source control and repository-wide formatting. Production bundle attribution is in `.tmp/performance/bundle-summary.json`.

## Measured results

### Repeated public mobile measurements

Three runs before and after; all values below are medians. Transfer sizes are actual bytes transferred, including headers where Lighthouse records them.

| Route        | Performance before → after | FCP before → after | LCP before → after | TBT before → after | Transfer before → after | JavaScript before → after |
| ------------ | -------------------------- | ------------------ | ------------------ | ------------------ | ----------------------- | ------------------------- |
| Login        | 86 → 94                    | 1.118 → 1.056 s    | 4.118 → 3.109 s    | 122 → 51 ms        | 2,478,659 → 316,246 B   | 255,535 → 178,714 B       |
| Registration | 86 → 93                    | 1.106 → 1.056 s    | 4.109 → 3.122 s    | 111 → 65 ms        | 2,478,061 → 315,859 B   | 255,535 → 178,714 B       |

Auth transfer fell about 87%, and JavaScript transfer fell about 30%. Final auth CLS is zero. Remaining Lighthouse unused JavaScript is approximately 27 KB, largely framework compatibility/runtime code; the development screenshot's 1,034 KiB estimate is not the production result.

Final auth audits report zero JavaScript/CSS minification savings and all LCP image-discovery checks pass (initial HTML, eager loading, and high fetch priority).

### Protected mobile measurements

| Page / fixture               | Runs before → after | Performance before → after | LCP before → after | TBT before → after | Transfer before → after |
| ---------------------------- | ------------------- | -------------------------- | ------------------ | ------------------ | ----------------------- |
| Service Management / Admin   | 3 → 3               | 76 → 87                    | 4.596 → 3.763 s    | 327 → 192 ms       | 616,114 → 438,078 B     |
| Employees / Admin            | 1 → 3               | 80 → 87                    | 4.421 → 3.761 s    | 258 → 176 ms       | 583,236 → 430,095 B     |
| Empty Messages inbox / Admin | 1 → 3               | 77 → 87                    | 5.042 → 3.912 s    | 253 → 112 ms       | 607,270 → 358,630 B     |

The single-run baseline rows are exploratory, not repeated baselines. Service Management JavaScript fell from a median 352,071 to 282,691 transferred bytes. Its remaining CLS is 0.0334; Employees and Messages have zero final CLS. The 90 target is not met on these mobile portal pages.

| Additional protected page / fixture | Runs before → after | Performance before → after | LCP before → after | TBT before → after | Transfer before → after |
| ----------------------------------- | ------------------- | -------------------------- | ------------------ | ------------------ | ----------------------- |
| Client Services / User              | 1 → 3               | 58 → 85                    | 5.254 → 4.225 s    | 989 → 114 ms       | 614,343 → 482,559 B     |
| Workload / Department head          | — → 3               | — → 86                     | — → 3.760 s        | — → 182 ms         | — → 398,393 B           |

The initial Workload exploratory run encountered an unmocked sidebar endpoint, so it is excluded from before/after claims. Final Workload runs use the complete fixture and have CLS 0.0450. Client Services has CLS approximately 0.000058. Neither meets the mobile 90 target yet.

### Desktop measurements

The public desktop baseline has one run per page; the optimized public results use three runs and medians.

| Page         | Performance before → after | LCP before → after | Final FCP | Final TBT |
| ------------ | -------------------------- | ------------------ | --------- | --------- |
| Login        | 86 → 100                   | 2.369 → 0.680 s    | 0.285 s   | 0 ms      |
| Registration | 88 → 100                   | 2.357 → 0.650 s    | 0.287 s   | 0 ms      |

Public desktop transfer is approximately 388 KB, including the visible, height-aware optimized hero.

The following protected desktop results are single-run smoke measurements, not repeated before/after comparisons:

| Page / Admin fixture | Performance | LCP     | TBT  | Transfer  |
| -------------------- | ----------- | ------- | ---- | --------- |
| Service Management   | 99          | 0.836 s | 0 ms | 438,261 B |
| Employees            | 100         | 0.779 s | 0 ms | 430,306 B |
| Empty Messages inbox | 100         | 0.775 s | 0 ms | 358,669 B |

## Root causes and implemented changes

### Image optimization was silently failing in the standalone deployment

The production `/_next/image` endpoint returned the original 1,979,632-byte PNG even for a 384 px request accepting WebP. Calling the deployed optimizer directly exposed `ERR_DLOPEN_FAILED`: file tracing copied Sharp's `.node` binary but omitted the adjacent Windows libvips DLLs. Next fell back to the source image without failing the request.

`next.config.ts` now explicitly includes the native `@img/sharp-*` library files in standalone tracing. The tested 828 px response is a 32,002-byte WebP. A production browser test checks its MIME type and size so a successful HTTP status cannot hide this regression again. Linux native assets are covered by the glob, but only the Windows runtime was executed in this audit.

The auth panel also preloaded its photo even when CSS hid the entire panel on mobile. A media-qualified preload and `<picture>` source now exclude community images below 850 px, matching Tailwind's strict breakpoint exactly. Rotation stops on mobile, respects reduced motion, and skips hidden-document ticks. Desktop carousel controls and crossfades remain available; only the current and previous slide are mounted.

Responsive sizing accounts for each source's aspect ratio and the panel's full viewport height. Sizing solely from panel width selected an 828 × 466 bitmap for a 940 px tall panel, introducing avoidable enlargement under `object-cover`. The final implementation requests enough detail to cover the height, capped by the original image dimensions. A browser regression checks decoded image height for all three slides. Desktop measurements include this correction rather than benefiting from undersized imagery.

Public service images in cards, tables, showcases, and detail dialogs now use the configured image optimizer rather than bypassing it. Local upload previews and protected attachment/profile image handling were retained.

The logo and favicon embedded a large PNG inside SVG. Their SVG geometry was preserved while the raster encoding changed to lossless WebP with transparent RGB preservation. An exact decoded RGBA comparison passed. Source sizes changed from 75,436 to 35,145 bytes and 75,144 to 34,853 bytes, respectively.

### Auth resources were discovered only after hydration

`AuthPage` initially returned only “Checking your session,” so neither the real form, brand image, nor hero resource was present in server HTML. Public auth content is now server-rendered. Browser session detection still checks an existing session with `/api/auth/me`, preserves transient-error handling and refresh-token behavior, and redirects authenticated users through the existing flow. Protected portal content remains gated by the authoritative account response.

The brand has explicit dimensions and high fetch priority. The desktop hero preload is discoverable in initial HTML. Auth entry effects use the same durations/translations through CSS, so they no longer wait for an animation library to hydrate. Reduced-motion behavior is preserved.

### Shared providers loaded animation engines for unused UI

The root provider eagerly imported the GSAP login loader. The Sileo viewport also imported Motion on every route, even when no notification appeared. Both now load on demand. The original loader animation and toast library are retained.

`lib/toast.ts` activates the persistent toast viewport and loads Sileo only when feedback is requested. Defaults preserve the existing position, colors, title/description classes, and roundness. Sileo retains the first notification before the viewport mounts; a unit test checks this behavior. The two callers retaining dismissal IDs await the actual ID. Other toast call sites received an import migration to the shared loader.

Closed service editors, pricing editors, employee panels, client drawers, conversation panels, and workspace creation now have dynamic boundaries. Large panels show an accessible loading state. Client-only Services code is deferred for administrative users. An exploratory version deferred the management page too; it introduced an extra critical-path chunk request after the account check, so the management page remains eager while its editors remain lazy.

Some CSS-animated panels imported the full animation engine solely to read the OS reduced-motion setting. `usePrefersReducedMotion` uses `matchMedia` and `useSyncExternalStore` instead. Animation libraries remain on routes that actually use their row/interaction animations. Service-card floating icons use a compositor-friendly CSS translation with the existing displacement, duration, and reduced-motion behavior; GSAP hover/reveal/type effects remain.

### Experimental CSS inlining inflated every HTML response

The earlier workaround removed a stylesheet request but duplicated the application CSS in HTML/RSC data and required patching Next's generated runtime to retain CSP nonces. A comparison with cached external production CSS reduced auth HTML from about 80 KB to 6.5 KB transferred. Measured FCP/LCP were slightly faster in the comparison run, with similar scores.

The final build uses Next's normal minified, cacheable stylesheets. The experimental flag and standalone runtime rewrite were removed. No stylesheet is deferred in a way that causes unstyled content, and no CSP directive was weakened. A remaining render-blocking stylesheet warning is a deliberate tradeoff, not an uninvestigated issue.

Tailwind source detection is limited to `src`, excluding tests and tooling. The existing local Latin Inter font is preloaded with `next/font/local` and a metric-adjusted fallback. Fontsource's other Unicode subsets remain available for user-entered text.

#### Follow-up: public route CSS (2026-11-09)

The root Tailwind entry previously scanned every feature, making portal utilities render-blocking on login and registration too. It now explicitly scans public routes, auth, not-found, shared UI primitives, and library helpers. The protected layout imports the complete utility set separately, with the same extracted theme tokens. Preflight and global rules remain in the root stylesheet.

With the same optimized PostCSS compiler, root application CSS fell from 132,401 to 52,325 bytes (60%); gzip fell from 23,542 to 10,956 bytes (53%). The resulting production `/login` HTML references one stylesheet totaling 55,251 bytes, or 11,879 bytes gzipped, including font CSS. These are resource-size measurements, not a new FCP/LCP comparison. Required CSS still blocks first paint; this change reduces its size without deferring styling or reintroducing experimental inlining.

Browser checks cover the public stylesheet size budget, CSP, desktop/mobile layout before JavaScript, and styling across auth/portal navigation.

Follow-up validation: formatting, lint, typechecking, and the web/API production build passed; all 11 targeted auth checks passed. The broader browser suite had 259 passed, five live-account skips, and six failures in existing client mutations, employee status, and department team/status scenarios. Replaying those scenarios with the original compiled application stylesheet reproduced all six failures (missing edit/status actions and a disabled team submit button); they were not caused by the CSS split. Their existing assertions and application behavior were retained.

#### Follow-up: font dependency chain (2026-11-09)

The subsequent screenshot uses development `/app/layout.css?v=...` assets and shows a CSS-discovered font. A fresh production Lighthouse run confirmed that the current local Inter font is already preloaded through the initial response's `Link` header. Its network record has `isLinkPreload: true`; the critical tree contains only `/login → CSS`, with no font child. The font-display audit passes and there are no additional preconnect candidates. The same-origin font does not need a new preconnect.

The existing `next/font/local` preload default is now explicit (`preload: true`), without changing font display or typography. New login and registration browser checks hold stylesheet responses until a font request starts, verify the initial preload header, then release CSS and assert that the preloaded font is reused without a second font download. This guards the existing production behavior; it does not claim another latency improvement or eliminate the required HTML-to-CSS dependency. Audit deployment builds with `pnpm build` followed by `pnpm --filter @nexus/web start`, rather than the development server.

#### Follow-up: unused JavaScript and the 404 boundary (2026-11-09)

The supplied development coverage report includes `app/not-found.js`, `app/layout.js`, and browser-extension scripts. The custom 404 page imported the client Button and Next Link for a static home link. Its link now renders on the server using shared button variants, extracted into a module without a client directive. It retains button styling and keyboard access; following it performs a document navigation to `/` through the existing home redirect. Interactive Button callers retain their existing API and behavior.

Fresh production browser contexts measured encoded JavaScript bodies of 173,089 → 167,969 bytes on login (5.0 KiB less) and 153,836 → 140,038 bytes on the 404 page (13.5 KiB less). These are single-run resource-size comparisons, not statistically established speed improvements. A subsequent production Lighthouse login audit reports 27,273 bytes of unused JavaScript in the shared Next runtime, unchanged from the preceding audit. No claim is made to eliminate framework code or the screenshot's full 224 KiB estimate. Browser-extension scripts are outside the application bundle; use an extension-free browser profile for application performance measurements.

Validation: all 13 targeted auth browser checks and the existing server-HTML/404 regression passed. Additional browser verification covered the 404 status, styling and keyboard focus without JavaScript, and the home link's return to login. Formatting, lint, typechecking, and the production web/API build passed.

#### Follow-up: total payload and duplicate font declarations (2026-11-09)

The next screenshot totals 3,779 KiB and includes a 3,070.6 KiB `main-app.js?v=...` development bundle. Those development assets are not the deployable production payload. The screenshot also shows two Latin font URLs. The root previously imported Fontsource's complete weight stylesheet alongside `next/font/local`; `src/fonts.css` now retains only the six non-Latin subset declarations, with the preloaded Latin face supplied exclusively by Next. Fresh development and production browser contexts each downloaded one initial font. Explicit Greek, Cyrillic, Vietnamese, and extended Latin font loads passed in both modes. Production already reused its preload before this change, so no additional 47 KiB production saving is claimed.

The user's WebP hero conversion is retained. The optimizer regression now requests `community-1.webp` and decodes the response to assert an actual 828 px output width; MIME type and byte limits alone could also pass for the smaller unmodified source file. All 13 targeted auth checks passed against the current WebP assets, including carousel image detail and hidden mobile image behavior. Formatting, lint, typechecking, and the complete production build passed.

Fresh production Lighthouse observations (one run per profile, Chrome 156, Lighthouse 13.6): login transferred 297,200 bytes (290.2 KiB) on mobile and 365,547 bytes (357.0 KiB) on desktop. Both had one 48,714-byte font transfer; desktop image transfer was 95,557 bytes, while mobile image transfer was 27,207 bytes with no hidden hero request. Reports are in `.tmp/performance/payload-{mobile,desktop}/`. These are current production measurements, not a controlled before/after comparison with the development screenshot. Development runtime size is not changed by this fix; audit `pnpm build` followed by `pnpm --filter @nexus/web start` in an extension-free browser profile.

Webpack compatibility correction: bare package URLs in `fonts.css` resolved in Turbopack but failed in Webpack development with `Module not found`. All six URLs now use explicit paths relative to the stylesheet (`../node_modules/@fontsource-variable/inter/files/...`). Webpack development browser verification passed for the rendered login form, one initial font request, four Unicode subset loads, and both login interaction tests. This fixes the compiler compatibility issue without restoring the duplicate Latin face.

#### Follow-up: long main-thread task (2026-11-09)

The supplied screenshot attributes a 592 ms task to development `main-app.js?v=...`. Six fresh production Lighthouse runs (three desktop, then three mobile, without concurrent builds/tests) did not reproduce that task. Desktop TBT was 0 ms in all three runs; the long-task diagnostic contained one unattributable 59 ms task before FCP in the first run and no long tasks in the other two. Throttled mobile TBT was 101, 62, and 65 ms (median 65 ms); the longest individual tasks were 151, 112, and 115 ms. Mobile framework startup/hydration work remains measurable and is not claimed to be eliminated.

The longest attributed production tasks belonged to the shared Next runtime chunks, not a synchronous business-data loop in the auth components. No further application change was justified by this development screenshot. Login animations already use CSS, hidden mobile photos do not rotate, and loader/toast animation engines are loaded on demand. Reports are in `.tmp/performance/main-thread-{desktop,mobile}/`. These measurements describe the current production build and are not a controlled speed comparison with the supplied development run. Use the production server for performance audits; retain development mode for debugging and hot reload.

### Duplicate reads and repeated rendering work

The Messages topbar and open inbox fetched and polled the same active conversation list. The inbox now owns that list and publishes its existing unread-count events; the topbar loads the other chat kind. Visibility/focus/online refreshes remain, as does the 30-second polling cadence. Tests assert a single initial request and verify all four roles' badge updates.

Account polling still validates the session and permissions every five seconds. An unchanged complete server payload now preserves the account context identity instead of rerendering the portal tree. Any changed account/permission field still replaces the value. There is no new authorization cache.

Date/time formatters are shared by the preferences provider instead of creating `Intl.DateTimeFormat` instances for each formatted value. Formatters are rebuilt when preferences change, preserving timezone and formatting behavior.

## Back/forward cache investigation

Production Lighthouse confirmed these reasons:

1. `MainResourceHasCacheControlNoStore`.
2. `JsNetworkRequestReceivedCacheControlNoStoreResource`.

The application uses dynamically rendered nonce-protected pages and `no-store` RSC/prefetch and authenticated API responses. These settings were retained. There are no application `unload` or `beforeunload` handlers to remove. Development-only HMR costs should not be confused with production behavior; the collapsed screenshot does not expose its exact three reasons.

Visible refresh observers now revalidate on a persisted `pageshow`, providing a fresh account check if a browser does restore the page. This does not claim to enable bfcache under the current policy. Selected conversations use authenticated streaming fetch; the synthetic empty-inbox measurements do not characterize bfcache behavior with a live conversation stream.

## Bundle analysis and decisions

The full route/module graph was captured with Next's production analyzer. The summary separates deferred imports from bootstrap/render-dependent module attribution. Attribution is a conservative code graph, not an exact initial-download size: conditional client references may appear in it. Lighthouse network records provide the actual transferred JavaScript figures.

Login, registration, Workload, and the unselected Messages inbox no longer require GSAP/Sileo/Motion in their initial render-dependent graph. Services, Employees, Accounts, and Departments retain Motion where row animations require it. Named Lucide imports already benefit from Next's package optimization; no icon barrel rewrite or dependency removal was justified. GSAP, Sileo, Radix, and Framer Motion still have verified uses and were retained.

The roughly 14 KB legacy-JavaScript diagnostic originates in Next's compatibility code. It was not stripped or bypassed. Production minification is already enabled; the screenshot's unminified-JS/CSS findings are not a reason to add a second minifier.

## Validation

- `pnpm format`, `pnpm lint`, `pnpm typecheck`, and the complete web/API production build passed.
- Frontend unit tests: 47 passed.
- Production Playwright suite: 247 passed, five live-account tests intentionally skipped without live credentials; no failures. After the final image corrections, all eight targeted auth checks passed, including the new exact-850px and decoded cover-image detail cases.
- Explicit regression coverage includes server-rendered auth fields, zero hidden mobile hero requests over a carousel interval, real standalone WebP transformation, reduced-motion/keyboard carousel controls, CSP, first lazy toast delivery, unread-count ownership, and persisted-page revalidation.
- Existing workflow coverage includes login/registration, token renewal/revocation, RBAC, profile/settings, service/pricing editors, employee/client operations, bookings, messages, meetings, quotations, uploads, payments, and staff allocations.

The first broad test run exposed missing read-only fixtures for existing topbar/sidebar requests. Those fixtures were added. The expired-session test now waits for asynchronous token clearing explicitly because a visible server-rendered form is no longer evidence that hydration/session checking has finished. No application assertion was removed.

## Remaining bottlenecks and limits

- Protected pages still require JavaScript hydration, a fresh bearer-authenticated account check, and route data before protected content renders. Tokens remain in `sessionStorage`; there is no cookie/session-policy change to make authenticated SSR possible.
- Framework/Radix code, required table animations, and large interactive page compositions remain material mobile costs. Further splitting must be measured against the extra request waterfalls; the Services experiment demonstrated that smaller bundles alone do not guarantee faster LCP.
- Simple auth entry animations still have a visual duration. Their design was retained rather than suppressing it for a score.
- Image optimization needs a healthy native runtime and server cache. Real Supabase image latency, cold transformations, live database latency, and large/active conversation histories need deployment-level measurements.
- Deployments retaining an old image cache may need to invalidate previously cached PNG fallback responses or allow their TTL to expire.
- Normal external CSS still blocks first paint while it loads, but benefits from independent browser caching and avoids inline CSS duplication and runtime patches.
- `no-store` bfcache restrictions remain intentional. No private response was made publicly cacheable.
- Lab results are not field Core Web Vitals. The 90+ target is met only on the routes/profiles shown in the final table; remaining misses are reported explicitly.

## Reproducing the audit

Run from the repository root. Use the same Chrome executable and fixture/profile settings for comparisons.

```powershell
npm.cmd install --prefix .tmp/lighthouse --no-save --package-lock=false lighthouse@13.6.0
pnpm.cmd build
$env:PORT = '5373'
$env:HOSTNAME = '127.0.0.1'
pnpm.cmd --filter @nexus/web start
```

In a second terminal:

```powershell
node apps/web/scripts/audit-performance.mjs --label=public-mobile --runs=3 --chrome=C:/path/to/chrome.exe
node apps/web/scripts/audit-performance.mjs --label=public-desktop --profile=desktop --runs=3 --chrome=C:/path/to/chrome.exe
node apps/web/scripts/audit-performance.mjs --label=admin-mobile --fixture=admin --routes=/services,/employees,/messages --runs=3 --chrome=C:/path/to/chrome.exe
node apps/web/scripts/audit-performance.mjs --label=client-mobile --fixture=user --routes=/services --runs=3 --chrome=C:/path/to/chrome.exe
node apps/web/scripts/audit-performance.mjs --label=head-mobile --fixture=head --routes=/staff-workload --runs=3 --chrome=C:/path/to/chrome.exe
```

Bundle analysis (run separately from the measured browser sessions):

```powershell
pnpm.cmd --filter @nexus/web exec next experimental-analyze --output --snapshot=production-audit
node apps/web/scripts/summarize-bundles.mjs
```

## Modified files

| Files                                                                                                                   | Purpose                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/web/next.config.ts`                                                                                               | Native Sharp tracing and supported auth image quality.                                                           |
| `apps/web/src/app/layout.tsx`, `src/index.css`                                                                          | Local font preload/fallback, scoped Tailwind scanning, CSS entry/floating animations; remove eager Sileo styles. |
| `src/features/auth/pages/auth-page.tsx`                                                                                 | Server-render public auth content while preserving existing-session validation.                                  |
| `src/features/auth/components/auth-{visuals,form,fields}.tsx`                                                           | Responsive/media-qualified imagery, visible LCP resources, stable dimensions, and native auth animations.        |
| `src/features/auth/providers/auth-provider.tsx`, `components/toast-viewport.tsx`, `src/lib/toast.ts`                    | Demand-loaded loader/notifications with persistent cross-route feedback.                                         |
| `src/features/auth/hooks/use-account.ts`, `src/lib/visible-refresh.ts`                                                  | Stable unchanged account identity and restored-page revalidation.                                                |
| `src/lib/use-prefers-reduced-motion.ts`, `src/components/ui/use-animated-panel-close.ts`                                | Read accessibility preference without loading Motion.                                                            |
| Services page files                                                                                                     | Defer client-only branch, editors, dialogs, and later booking steps.                                             |
| Services card/table/showcase/detail components                                                                          | Optimized public images and CSS idle icon motion.                                                                |
| Employee and Client page files, workspace list page                                                                     | Load closed forms/drawers only when opened.                                                                      |
| Messages page and `components/messages-link.tsx`                                                                        | Deferred conversation panels and one owner per active inbox read.                                                |
| `src/components/ui/panel-loading.tsx`                                                                                   | Accessible pending state for deferred overlays.                                                                  |
| `src/features/settings/providers/preferences-provider.tsx`                                                              | Share date/time formatters across consumers.                                                                     |
| Existing Sileo call sites across features/layout                                                                        | Import the shared lazy API; preserve two returned toast IDs asynchronously.                                      |
| `public/auth/exp-logo.svg`, `public/favicon.svg`                                                                        | Lossless re-encoding; geometry and decoded pixels preserved.                                                     |
| `scripts/{audit-performance,performance-fixtures,summarize-bundles,optimize-brand-assets}.mjs`                          | Reproducible measurement, explicit fixtures, graph attribution, and verified asset encoding.                     |
| `e2e/auth-{performance,styles}.spec.ts`, `e2e/messages-topbar.spec.ts`, `test/{toast-loading,visible-refresh}.test.mjs` | Performance/security/functionality regression coverage.                                                          |
| `e2e/regression-support.ts`, `e2e/regression.spec.ts`                                                                   | Complete existing API fixtures and wait for asynchronous session validation.                                     |
| `.gitignore`, `.prettierignore`                                                                                         | Exclude generated performance reports.                                                                           |

Paths beginning with `src/`, `public/`, `scripts/`, `test/`, or `e2e/` in this table are relative to `apps/web/`.
