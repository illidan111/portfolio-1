# Akzhol’s pixel portfolio

An original woodland developer portfolio built with Astro 6.4.8, strict TypeScript, and plain CSS. The entire site is static. All scene illustrations, interface icons, tiles, and characters are original SVG or CSS artwork; there are no Terraria assets.

## Run locally

Use Node **22.12.0 or newer within the 22.x release line**, matching the production deployment target.

```sh
npm install
npm run dev
```

Open the printed local URL (normally http://127.0.0.1:4321).

```sh
npm run check
npm run build
npm run preview -- --port 4323
npm run test:e2e
```

`dist/` is the complete static deployment output; no adapter, server, account, or database is required. The end-to-end suite uses a locally installed Microsoft Edge browser. See `playwright.config.ts` for the preview address and browser settings.

## Classic and Game views

The header's **Classic view / Game view** link switches presentation on every page. Share `/?mode=classic` for the readable recruiter view, or `/?mode=game` for the woodland. Project pages accept the same parameters, for example `/projects/fieldnotes/?mode=classic`. Both presentations use the same content collections and `src/site.config.ts`.

An explicit valid URL parameter wins and is saved as `pixel-view` in localStorage. Without a mode parameter, a short coarse-pointer landscape viewport (500 CSS pixels high or less) uses Classic and explains the fallback. Otherwise the saved choice wins; a first visit with Reduced Motion or browser-reported Save-Data defaults to Classic, and other first visits default to Game. An explicit `?mode=game` remains available even in a short landscape viewport. In short landscape viewports the header flows with the document instead of remaining sticky, preserving room to read and scroll. Storage reads and writes are guarded; blocked storage preserves the current explicit URL's behavior but cannot remember a future visit.

The small **“Prefer a classic view?”** notice appears once per browser and can be dismissed. Reduced Motion does not suppress it. The short-landscape explanation can appear when that fallback is needed. The notice and collapsed World map share a toolbar in normal document flow, above the world and clear of its controls.

Classic keeps the palette, pixel headings, and restrained borders, with system sans-serif body text and ordinary document flow. Project filters, skill inspection, navigation, and contact links remain available. It does not import the Game entry, shared engine, audio manager, or Three.js; there is no animated world, lighting, weather, digging, boss, movement, or 3D. Its page transition is at most a simple fade. Switching modes performs a full document navigation so running Game resources are torn down; navigation within a mode uses Astro's client router.

**Email** and **CV** stay in the header in both views and on project pages. Email opens the visitor's mail app; CV downloads `/cv.pdf`. Neither requires speaking to an NPC or reaching the house. The current address and PDF are clearly disclosed placeholders; replace them before sharing.

## Explore the Game view

- The six hotbar slots open Spawn, Projects, Skills, Journey, Contact, and Settings. Keys **1–6** do the same outside editable fields and dialogue.
- Filter the project inventory by category and open any item for its case study.
- Hover or focus equipment to reveal a tooltip; click an item to inspect its description. **Escape** dismisses a tooltip.
- Speak with **Pixel the Wanderer** using “Say hello,” the desktop speech bubble, or the campfire invitation. The native dialogue supports keyboard focus, Escape, and returning focus to its opener.
- Toggle day/night in the header. The world also cycles every 90 visible seconds. Automatic cycling pauses while the home world is offscreen or the tab is hidden. Automatic cycling and decorative movement are disabled when reduced motion is requested.
- Discover three achievements by exploring all sections, choosing night, and talking to Pixel. Theme and achievement preferences are stored only in the visitor’s browser; storage failures do not prevent exploration.
- At night, **Mote the Overthinker**, an original clockwork eye, drifts into the sky. Five deliberate clicks or taps earn its golden-lens achievement and a Journey trophy; Reduced Motion needs just one click. Hits are limited to two per second. Dismiss keeps the sky peaceful for this tab session, or turn Boss encounters off in Settings.
- The toolbar's **World map** reveals landmarks as you explore. It saves visited sections and starts collapsed at every width to keep gameplay and inventory controls clear. Open it to browse; Escape closes it while focus is inside. Its keyboard-accessible equivalent lists every destination, including places you have not visited yet.
- At the Skills **crafting table**, inspect a skill, then choose Add. Combine up to three ingredients to find projects using all of them. Remove an ingredient or Reset to try another recipe. The original inventory filters remain independent.
- Settings has a speaker switch and a low default volume. All ten sound effects are synthesized locally. Sound is off by default; a saved On preference still requires **Resume sound** after reload or background suspension. There are no audio downloads.

### A secret for curious readers

On the home page, enter **↑ ↑ ↓ ↓ ← → ← → B A** outside a text field or dialog. The **Prismatic curiosity** discovery gives the torches gentle rainbow colors for twelve seconds. Reduced Motion uses static colors. This code is intentionally documented only here.

## Content and design decisions

- The supplied developer name is **Akzhol**. Employment history, contact address, and real project details have not been supplied; the three projects are complete concept studies rather than claims of shipped client work. `you@example.com` is a visible placeholder, not a working owner contact. The site has no message form or sending service.
- `src/content/projects/*.md` contains the project case studies. `src/content/skills/*.json` and `src/content/experience/*.json` contain equipment and practice areas. Zod schemas and glob loaders are in `src/content.config.ts`.
- `src/styles/tokens.css` is the single global token layer. Spacing and sizes derive from `--px: 4px`, with fractional pixel units for thin borders and smaller type. Component styles are scoped in Astro files.
- **Pixelify Sans** is the only downloaded font. Game uses it throughout; Classic uses it for headings and navigation with Arial/Helvetica/system sans-serif body text. Astro's stable Fonts API uses the local provider against the installed Fontsource files and copies WOFF2 assets into the build. There are no runtime font-provider requests.
- Vanilla TypeScript handles the small interactive layer. No client framework or hydrated UI island is needed. Astro’s ClientRouter provides transitions between the inventory and case studies, with `fallback="swap"`. Regular links and all content remain available without JavaScript.
- Browser interaction state is reinitialized after client navigation and listeners, observers, and timers are disposed before swaps.
- The build stays in this repository and tool caches are project-local. The deployment target is Vercel static hosting. The site has no backend, authentication, analytics, trackers, third-party scripts, or external data APIs. The deployment status and required checks are documented below.
- Font and Three.js license notices are included in `public/licenses/`.

## Replace with your real info

The shared `profile` object in `src/site.config.ts` drives the header, hero's factual line, summary, contact links, `Person` JSON-LD, `rel="me"`, and generated PDF. Review every field:

| Field | Current value / meaning | Replace or confirm |
| --- | --- | --- |
| `name` | `Akzhol` | Supplied public name. |
| `role` | `Frontend engineer (placeholder)` | Your actual role. |
| `experience` | `Experience: add years` | A truthful experience summary; no years have been assumed. |
| `coreStack` | `TypeScript`, `Astro` | Your actual core technologies; this is an illustrative selection. |
| `availability` | `Availability: add status` | Your current availability. |
| `email` | `you@example.com` | Your public contact address; the current value is deliberately non-personal. |
| `github` | `https://github.com/illidan111` | Confirm this is the profile you want to publish, or replace it. |
| `cv` | `/cv.pdf` | Keep the public download path and replace `public/cv.pdf` with your real CV. |
| `summary` | Explicitly illustrative developer/profile description | Your own factual introduction. |
| `isPlaceholder` | `true` | Keep true until the profile and CV are genuinely personalized; false removes the generator's placeholder labeling. |

Additional content to review before publishing as your own portfolio:

- **Fieldnotes, Orbit, and Pixel Forge** in `src/content/projects/` are original concept studies. Their descriptions, implementation plans, technologies, and screenshots are illustrative, not verified employment outcomes or deployed products. Replace them with projects you can accurately describe, or retain clear concept labels.
- The eight skill entries in `src/content/skills/` (Accessibility, Astro, CSS, Figma, Git, Performance, React, TypeScript), their descriptions, and game rarity labels are illustrative selections, not evidence of a person's proficiency.
- `src/content/experience/` contains **Interface craft**, **Building for the web**, and **Always exploring**: practice areas and habits, not employers, dates, or job history. Replace them with accurate experience or keep them explicitly framed as interests.
- The About section in `src/pages/index.astro` includes “Frontend explorer,” “People first,” “Always growing,” and “Detail driven,” plus concept-portfolio copy. Review these personal claims, the avatar, NPC dialogue in `src/scripts/world.ts`, and demo labels in the layout/contact section when replacing the identity.
- `public/cv.pdf` is a **one-page placeholder CV generated from the shared profile**, not an employment record. It visibly says so. `public/akzhol-profile.txt` is a legacy illustrative download; replace or remove it if retaining that URL.
- The deployment `SITE_URL` fallback is intentionally a non-production placeholder. Set it to your verified production origin; never share placeholder canonical, sitemap, robots, or Open Graph URLs as if they were a live domain.

### Regenerate the placeholder/profile PDF

`node scripts/generate-cv.mjs` reads the real TypeScript profile and invokes `scripts/generate-cv.py`. It writes `public/cv.pdf` and a preview at `artifacts/screenshots/placeholder-cv.png`, and checks the one-page output and expected text. Review that preview after any content change.

This optional authoring tool needs Python, ReportLab, PyMuPDF, and pypdf. Keep their installation and cache inside the project; for PowerShell:

```powershell
New-Item -ItemType Directory -Force artifacts/pdf-temp | Out-Null
$env:TEMP = (Resolve-Path artifacts/pdf-temp).Path
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
python -m pip install --target artifacts/pdf-tools --cache-dir artifacts/pdf-cache reportlab pymupdf pypdf
node scripts/generate-cv.mjs
```

Set `PYTHON` to a local Python executable if `python` is unavailable on PATH. These are local PDF-authoring tools, not application dependencies. **`npm run build` and Vercel do not require Python or regenerate the PDF**; the generated static PDF is included in `public/`.

## References checked before implementation

- [Official Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/): Node requirements, Vite Environment API, Zod 4, Content Layer migration, stable Fonts API, and transition changes.
- [Astro Fonts API](https://docs.astro.build/en/guides/fonts/): local providers and the `Font` component.
- [Content collections](https://docs.astro.build/en/guides/content-collections/): glob loaders and `astro/zod`.
- [View transitions](https://docs.astro.build/en/guides/view-transitions/): `ClientRouter` and lifecycle events.
- [Astro on Vercel](https://docs.astro.build/en/guides/deploy/vercel/): static output needs no adapter.
- [Astro environment variables](https://docs.astro.build/en/guides/environment-variables/): use inherited `process.env` or explicit `loadEnv` in the config; do not assume `.env` has already loaded there.
- [Astro CSP configuration](https://docs.astro.build/en/reference/configuration-reference/#securitycsp): the built-in CSP feature does not support the existing `ClientRouter`, so deployment headers must be tested with the router.
- [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [project configuration](https://vercel.com/docs/project-configuration/vercel-json), and [cache headers](https://vercel.com/docs/caching/cache-control-headers).
- [Vercel CLI deployment](https://vercel.com/docs/cli/deploy) and [non-interactive options](https://vercel.com/docs/cli/global-options#non-interactive).

Browser screenshots and verification outputs are saved in `artifacts/`.

## Feature switches

All ten enhancements are enabled in `src/site.config.ts`. Set any switch to `false` and rebuild to omit that feature; ordinary portfolio content and navigation remain available.

| Priority | Switch | Enhancement |
| --- | --- | --- |
| P1 | `hero` | Focus-scoped movement, jumping, collisions, reachable doorway |
| P1 | `lighting` | Pixel lightmap, warm torches, cursor light and fireflies |
| P1 | `voxels` | Lazy procedural Three.js project items and SVG fallbacks |
| P2 | `digging` | Session loot, four seeded discoveries, regrowing tiles |
| P2 | `weather` | Seasonal rain, snow, leaves, fog and friendly red moon |
| P2 | `transitions` | 520ms dirt-and-stone route transitions with fallback |
| P3 | `boss` | Mote, trophy shelf, one-time achievement and secret colors |
| P3 | `minimap` | Persistent fog-of-war navigation |
| P3 | `crafting` | Collection-backed recipes with accessible results |
| P3 | `audio` | Gesture-enabled synthesized effects |

## Living-world architecture

`src/scripts/app.ts` mounts the common content controls and conditionally imports `game.ts` only in Game view. Engine modules form the named `game-engine` chunk; the optional voxel and Three.js chunks stay behind their separate visibility/quality import. A fresh Classic document must not request any of these files. The network tests and mode-measurement runner check this boundary; simply hiding Game markup would not satisfy it.

`src/scripts/engine/index.ts` owns the single animation-frame scheduler. Visible engines register small `init`, `update(dt)`, `render`, and `destroy` modules. Physics uses 1/60-second steps, caps catch-up work, and renders at up to 60Hz. Each engine pauses when its observed scene leaves the viewport, the document is hidden, or Reduced Motion is active. DOM interactions, navigation, and block regeneration remain functional without animation.

The hero stays within the visible scene; there is no moving camera, so the portfolio content never shifts while you play. Focus the woodland ground to use **A/D or ←/→** to walk, **Space/W/↑** to jump, and **E** at the doorway to visit Contact. **Escape** releases game focus. Coarse pointers get 48px left, right, and jump buttons. The normal Contact link also works without playing.

The central typed store in `src/scripts/engine/settings.ts` validates persisted settings and tolerates blocked or corrupt storage. **Motion** follows the device or forces Reduced; **Quality** is Auto, High, or Low; **Weather** follows the season, is off, or is locked to a chosen state; **Boss** and **Controls hint** can be disabled. Low disables WebGL, halves lightmap resolution, and uses static weather tint. Auto samples actual engine cadence and downgrades when frames cannot keep up. Reduced uses static lighting, no particles, and no gameplay motion. Sound starts off and requires a Settings gesture.

The mobile hardening policy is **Auto stays Low on all coarse pointers**. It deliberately does not upgrade automatically; choose High explicitly to opt into graphics when supported. Low retains the fast SVG fallback and never starts 3D. Fine-pointer devices start High and can downgrade when measured frame cadence is too slow. The earlier implementation limited the initial Low policy to screens up to 700px; its historical measurements are preserved below, separately from this update's measurements.

The digging band observes its own visibility through the same scheduler. Cracks finish and flying loot is removed when the band leaves view; a functional timer restores blocks after six seconds, even while motion is paused. Loot persists for the tab session and follows navigation into project pages. The count is capped at 9,999 to keep the HUD tidy.

Page changes use original dirt/stone snapshots and a pickaxe for a 520ms transition. Browsers without native View Transitions use the same CSS curtain; Reduced Motion skips it. Heading focus and the polite page-title announcement happen immediately after the DOM swap, without waiting for the animation.

`src/site.config.ts` contains build-time feature switches. Change a boolean and rebuild; disabled enhancements retain the site's ordinary links and content. Each project model is loaded only when its detail-page icon is visible and graphics are allowed. Home never imports Three.js. WebGL contexts, instanced meshes, materials, and geometry are disposed on navigation or when graphics are disabled.

The all-disabled fallback is also checked in a real browser. With the preview server running and other checks stopped, `node scripts/verify-flags.mjs` temporarily disables all ten flags, builds, verifies ordinary navigation/Settings and the SVG item fallback, then restores the original flags and rebuilds in a `finally` block.

## Extending the world

### Voxel models

Add `voxel.palette` and `voxel.layers` to a project Markdown frontmatter. Layers are front-to-back slices; rows read left-to-right, top-to-bottom. A dot means empty space and digits index the hex color palette. Every slice must be rectangular and the same size, at most 16×16×8, with 1–10 colors and at least one occupied voxel. Zod validates all dimensions and palette references. Keep the SVG `icon` for the static fallback.

```yaml
voxel:
  palette: ['#96c8ff', '#33496b']
  layers:
    - ['.0.', '010', '.0.']
    - ['.1.', '111', '.1.']
```

### Discoveries and weather

The excavation module's `Secret` union, `secretNames`, `secretCopy`, and seeded slot list define discoveries. Add a matching ordinary link or explanation to `Digging.astro` so a hidden block is never the only path. The seed and block count last for the tab's session. The CV discovery uses `profile.cv`, the same `/cv.pdf` as the persistent header; replace the placeholder PDF before sharing.

To add weather, extend the settings weather union and validation list, Settings options, then `descriptions`, `chooseWeather`, and particle behavior in `effects.ts`. Reuse the 150-slot pool; High caps at 150, Low at 50, and Reduced at zero. The low-resolution lightmap and all weather share one canvas. Seasonal Auto chooses winter snow, spring rain, autumn leaves, or clear summer skies with nighttime fireflies; a session-seeded rare night adds the friendly red moon tint.

### Recipes and synthesized sounds

Each project's `skills` frontmatter lists skill collection IDs. Zod validates these references, and `assertRecipeSkills` checks that every ID actually exists during prerendering, including when crafting is switched off. Recipes match every selected ingredient (AND), not just one. Adding a project or skill updates the table from the collections.

Add a named pattern to `tones` in `src/scripts/engine/audio.ts`: `notes` are frequencies in Hz, `step` is seconds per note, and optional `wave` and `gain` choose the oscillator and quiet envelope level. Dispatch `new CustomEvent('pixel:sound', { detail: 'your-sound-name' })` on `document`. The manager applies the persisted master volume, rate limits repeated events, caps concurrent voices at eight, disconnects ended nodes, and suspends on hidden tabs or Off. Never create a second AudioContext or start one from a lifecycle event. The existing names are `click`, `hover`, `jump`, `land`, `block`, `loot`, `craft`, `boss-hit`, `boss-defeated`, and `page-dig`.

## Deploy to Vercel

**Deployment stopped at Vercel login.** The CLI attempt used Vercel **63.1.2** on Node **22.23.3** after local verification passed. The final build's local results are recorded below. The attempted command was:

```sh
npx --yes vercel@63.1.2 --non-interactive --global-config ./artifacts/vercel-cli
```

It exited with code 1: **“No existing credentials found.”** The exact output is preserved in `artifacts/verification/vercel-attempt.log`. Automated deployment stopped at that authentication boundary as requested; neither a temporary deployment nor `--prod` was attempted. No production URL was obtained or verified. The Vercel build, remote Node/project settings, live canonical origin, actual response/cache headers, and live smoke/Lighthouse results remain unverified. Complete the numbered login/link steps below; never put credentials in this repository. The local CLI state and caches are ignored project-local artifacts.

This is Astro static output. Keep `output: 'static'`; no Vercel adapter or server runtime is needed. Use these project settings:

| Setting | Value |
| --- | --- |
| Framework preset | Astro |
| Node.js version | **22.x**, at least 22.12.0; package engines must exclude 23+ |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Build environment variable | `SITE_URL=https://your-production-origin.example` — replace the example |

`SITE_URL` is public build-time configuration, not a secret. `astro.config.mjs` reads the inherited variable or a local environment file, validates an HTTP(S) origin without credentials/path/query/hash, and falls back to `https://portfolio.example` for local/demo builds. Canonical URLs, sitemap, robots.txt, Open Graph URLs, and structured profile URLs share this base. Canonicals omit `?mode=...` and anchors because both views present the same content. The Open Graph image reuses the original `/art/world.svg`; some social services do not render SVG previews, so this does not guarantee universal social-card support. Set the variable in Vercel's project environment settings; setting it only in a local terminal does not configure remote builds.

`vercel.json` sets `npm run build`, `dist`, consistent trailing slashes, immutable caching for fingerprinted `/_astro/` assets, and security headers. HTML and the unversioned `/cv.pdf` retain Vercel's documented default revalidation policy; verify the deployed headers instead of assuming them. The configured headers are `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` for unused camera/microphone/location/payment access, and a CSP compatible with the site's inline startup/style needs. It permits neither `unsafe-eval` nor third-party script origins. Inline permission is a compatibility tradeoff, not strict hash-only protection. Astro's built-in CSP is incompatible with this `ClientRouter`; the deployment tests inject the configured response policy for browser validation. Astro preview alone does not apply `vercel.json` headers, and injected local headers do not establish Vercel's live routing or cache behavior.

### CLI workflow, after local verification

1. For any further source changes, run `npm run check`, `npm run build`, the **entire** Playwright suite against production preview, screenshot review, and the four mobile Lighthouse targets below. These local gates passed for the committed build. Resolve failures before deployment. Vercel's first deployment of a new project can already be production even without `--prod`.
2. Keep npm downloads local (`$env:npm_config_cache = "$PWD/.npm-cache"` in PowerShell). From this project, try `npx --yes vercel --non-interactive`. This is the requested initial CLI deploy, with prompts disabled. Inspect the result and build logs, including Node 22.x, `npm run build`, and `dist`.
3. **If authentication or project linking is required, stop automated deployment.** Do not guess an account/project, request a token in chat, or put tokens, credentials, or auth files in the repository. Keep `.vercel/` ignored; it is machine-specific deployment metadata, not source to commit.
4. If the initial deployment succeeds, inspect that URL, then run `npx --yes vercel --prod --non-interactive` for the requested production deployment. Record the stable production origin shown by Vercel, not an invented domain or a localhost address.
5. Set `SITE_URL` to that production origin in the project's Production environment (and Preview if previews should canonicalize to production), then redeploy with `npx --yes vercel --prod --non-interactive`. Verify the rebuilt canonical/OG/sitemap/robots values and actual security/cache headers.
6. Run `node scripts/live-smoke.mjs --url=https://YOUR-PRODUCTION-ORIGIN --label=production --devices --themes=day,night`, review its screenshots, and run `powershell -File scripts/lighthouse.ps1 -BaseUrl https://YOUR-PRODUCTION-ORIGIN -Label production`. Check all page statuses, missing-route 404, both views, hotbar navigation, contact downloads, console/network errors, and real live Lighthouse results. A successful upload is not the live verification result.

### If the CLI stops at login or linking

Complete these steps yourself in a terminal; no token needs to be pasted into chat:

1. From the repository, run `npx vercel login` and complete Vercel's account sign-in flow. Use the CLI's normal credential storage; never create a token file in this project.
2. Run `npx vercel link`. Choose your own account/team and the intended existing project, or deliberately create a project. Confirm the local root directory is this repository and keep `.vercel/` untracked.
3. In the project settings, select Node **22.x**, Astro, build command `npm run build`, output directory `dist`, and the appropriate `SITE_URL`. Then follow the initial/production deployment and verification order above.

Alternatively, use the dashboard:

1. Sign in to Vercel and choose **Add New → Project → Import Git Repository**. Connect the intended GitHub account and select this repository.
2. Confirm the repository root, Astro preset, Node **22.x**, `npm ci`, `npm run build`, and `dist`. Set `SITE_URL` if the final production origin is already known; otherwise replace the placeholder as soon as Vercel supplies it.
3. Deploy, inspect the build log, and record the production URL. Update `SITE_URL` to that origin and redeploy.
4. Run the live smoke/screenshot and Lighthouse commands against that URL. Do not report local audit numbers as live results.

## Current-update verification

The recorded measurements below describe commit `908bd05`, before the profile rename. Historical reports and screenshots retain the former name; they are not served by the site. The package identifier remains unchanged; the profile download uses Akzhol.

Local verification ran on October 10–11, 2026 with **Node 22.23.3**, Astro 6.4.8, and installed Microsoft Edge:

- `npm run build`: five static HTML pages plus sitemap and robots endpoints; `npm run check`: 55 files, zero errors, warnings, or hints.
- **129/129 Playwright tests passed in 7.9 minutes**, including 55 axe analyses with zero violations, all eight deployment checks, both modes, and the seven requested layout widths in both themes.
- All 19 mobile tests passed. The final 24 viewport screenshots cover iPhone 13, Pixel 7, and 360×640 Android in portrait/landscape, both modes and both themes; all were visually reviewed with no material clipping, overlap, or readability issues.
- The final localhost smoke passed **34/34 checks**: all four content routes returned 200, the missing route returned 404, navigation/mode/contact checks passed, and no page, console, or failed-network errors were captured. Its 26 full-page captures cover two desktop views and the same 24 phone combinations; all were visually reviewed with no material issues.
- The configured response CSP passed real browser checks for filters, skills, repeated ClientRouter navigation, CV downloads, mode changes, lazy High graphics, and gesture-activated audio. This validates the policy locally, not Vercel's deployed headers.
- All ten features disabled together passed the ordinary-navigation/Settings/SVG fallback check. The restored shipping build matched **all 30 files** from the full-suite-tested build exactly. Home SHA-256: `ffeae008f3a402cc894311af8e817619d654da865a484bcca2106ecfd40f3633`.

The following are **localhost mobile Lighthouse 13.5.0** results, using its simulated mobile network/CPU throttling. Every audit had no runtime error or run warning.

| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Game home | 99 | 100 | 100 | 100 | 1.805s | 0.000966 |
| Fieldnotes, Game | 99 | 100 | 100 | 100 | 1.893s | 0 |
| Skills anchor, Game | 99 | 100 | 100 | 100 | 1.810s | 0.000966 |
| Classic home | 100 | 100 | 100 | 100 | 1.249s | 0.0005225 |

Before this update, Game home and Fieldnotes scored 100 Performance and Skills scored 99; their other three categories were 100. Classic is new and has no earlier score. Both current home modes exceed the requested 95-category, LCP <2.5s, and CLS <0.05 gates.

| Initial home JavaScript, gzip bytes | External | Inline executable | Total |
| --- | ---: | ---: | ---: |
| Starting Game baseline | 24,887 | 121 | 25,008 |
| Current Game | 26,301 | 512 | 26,813 |
| Current Classic | 8,192 | 512 | 8,704 |

Game grew by **1,805 total gzip bytes** (1,414 external), within the additional 5,000-byte allowance. Desktop and 4× CPU-throttled mobile runs produced the same script sizes. Classic requested no Game/engine/voxel/Three.js chunks and ran no engine or visible game canvas. Native observed LCP was 468/408ms for desktop Game/Classic and 928/664ms for mobile; all native CLS values were below 0.0012. Both runs captured zero runtime, console, or failed-network errors. These native observations are separate from Lighthouse's simulated figures above.

Evidence is in `artifacts/verification/current-full-suite.log`, `current-tested-build.json`, `current-restored-build.json`, and `flags-off.json`; `artifacts/performance/current/summary.json` and `lighthouse-summary.json`; the two `current-modes*/mode-measurements.json` files; and `artifacts/live-smoke/local-final/smoke.json` with its screenshots. No physical phone has been tested. Deployment and live verification are reported separately above.

Use the production preview in another terminal: `npm run preview -- --port 4323`. Browser tests use that address by default; `PORTFOLIO_TEST_URL` can override it. Keep other browser tests stopped during performance measurement.

```sh
npm run check
npm run build
npm run test:e2e
node scripts/measure-modes.mjs --url=http://127.0.0.1:4323 --label=current-modes
node scripts/measure-modes.mjs --url=http://127.0.0.1:4323 --label=current-modes-mobile --mobile --cpu=4
node scripts/measure.mjs --matrix --label=current-game --routes=/?mode=game
```

```powershell
powershell -File scripts/lighthouse.ps1 -Label current
```

The Lighthouse runner audits **`/?mode=game`**, **`/projects/fieldnotes/?mode=game`**, **`/?mode=game#skills`**, and **`/?mode=classic`**. Skills is a home-page anchor, not a separate route. Explicit mode URLs matter because Reduced Motion/Save-Data can select Classic automatically. The optional `--devices` live-smoke matrix covers iPhone 13, Pixel 7, and a custom 360×640 Android viewport, each in portrait and landscape; dedicated mobile tests cover fallback behavior and interactions separately.

The new budget baseline is **24,887 external JS gzip bytes**, with **121 inline gzip bytes** recorded at the start of this update. The additional allowance is 5,000 bytes. `measure-modes.mjs` reports external and inline scripts separately, their total, and the like-for-like total delta; it conservatively checks the combined total against **29,887 bytes**. Classic must be lighter and must request no Game/engine/voxel/Three.js chunks. The runner uses fresh profiles and records actual requested response bodies compressed with Node's gzip; these are comparable gzip sizes, not wire-transfer estimates. Native LCP/CLS observations complement the separate Lighthouse mobile reports. New reports are written only when a runner executes; preparing a script is not a measured pass.

Required current gates are Lighthouse mobile ≥95 in Performance, Accessibility, Best Practices, and SEO for home in both modes; CLS <0.05; LCP <2.5s; no Classic engine downloads; passing axe/behavior/geometry tests in both themes and modes; and no console or failed-network errors. Performance artifacts, temporary profiles, and tool caches stay within the project.

### Short physical-phone checklist

Chromium viewport, touch, user-agent, and CPU emulation do **not** reproduce physical phone performance or iOS Safari. The iPhone descriptor in Edge remains Chromium, not Safari. Check the deployed site on a real iPhone/Safari and Android/Chrome before relying on phone coverage:

1. Open both explicit mode URLs in portrait and landscape, rotate while viewing, and check the short-landscape notice, normal scrolling, no horizontal overflow, and no overlap between the map, CTAs, door prompt, or NPC. Check the notch and home-indicator safe areas with browser bars expanded and collapsed.
2. On a fresh browser state, enable Reduced Motion or an available data-saving mode and confirm the Classic default and visible dismissible notice. Choose Game explicitly, reload, and confirm the URL/saved-choice behavior. Save-Data only applies when the browser exposes that signal.
3. Tap navigation, filters, skills, and tooltip targets; tap outside a tooltip to dismiss it. Try the Game movement buttons, then scroll normally outside them. Check that controls and the header never hide page content or contact actions. With VoiceOver or TalkBack, reach the mode switch, Email, CV, and navigation in a sensible order.
4. Try **Email** and **CV** from home and a project in both modes. Confirm the intended mail address and a readable PDF. Replace the demo email/PDF before sending real correspondence.
5. Try day/night and Low quality; background/restore the tab and scroll the world offscreen. Optional sound must remain silent until a deliberate Settings gesture, with a usable Resume action afterward. Note heat, battery use, or stutter that desktop emulation cannot establish.

## Historical verification: ten-feature Game baseline

These checks were completed on October 10, 2026 **before the current Classic/contact/mobile/deployment update**, with Node 24.14.0 and the installed Microsoft Edge browser. They are retained as evidence of the earlier build, not as results for the new Node 22/Vercel target:

- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: 4 static pages, with local font assets.
- **All 71 Playwright tests passed**, including the original 18. Seven additional targeted checks passed after the final collapsed-map and mobile label adjustments. The full-suite HTML report is preserved at `artifacts/verification/full-suite-report/index.html`.
- Automated axe WCAG A/AA scans reported no violations on all four routes in day/night and rainy weather, plus the NPC dialogue. This is an automated check, supplemented by screenshot review, rather than a full accessibility certification.
- Layouts checked at 360, 390, 768, and 1440 CSS pixels. No horizontal overflow was found.
- Runtime requests remained local. JavaScript-disabled content, client navigation, keyboard controls, reduced motion, automatic day/night cycling, and browser storage failure paths were exercised.
- All ten flags disabled together also built without warnings and retained ordinary navigation, Settings, and SVG project art, with no Three.js requests.
- Scene, discovery, voxel, boss, crafting, Settings, minimap, and transition screenshots are in `artifacts/screenshots/`. The twelve rain/snow review images cover 1440, 768, and 360px in both themes. `npm run test:e2e` generates the latest Playwright HTML report at `artifacts/playwright-report/index.html`; its launcher keeps temporary profiles and transform caches project-local.

The original measurements used the then-default Game URLs `/`, `/projects/fieldnotes/`, and `/#skills`. The updated runners now require the explicit mode URLs listed above to make comparable measurements.

### Historical final measured budgets

All ten flags were enabled in that measured build. Initial home external JavaScript grew from **8,227 to 24,887 gzip bytes**, an increase of **16,660 bytes** against the earlier additional 25,000-byte allowance. Its recorded inline JavaScript was 120 gzip bytes; the new task's starting inline measurement is 121 bytes. Three.js was not requested by that build's home or Skills view.

| Mobile Lighthouse 13.5 | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home | 100 | 100 | 100 | 100 |
| Fieldnotes project | 100 | 100 | 100 | 100 |
| Skills (`/#skills`) | 99 | 100 | 100 | 100 |

The P2 gate also passed before P3 began: 19,651 home JS gzip bytes and 100 in every Lighthouse category on all three targets. Final maximum measured CLS is **0.006382**, below 0.05; no idle gameplay task exceeded 100ms and no application errors were captured.

Actual shared-engine averages were **59.3fps on High** in day and night, with maximum engine work of 0.7/1.0ms. **Low at a mobile viewport with 4× CPU throttling averaged 58.9/58.6fps**, with maximum engine work of 14.0/11.4ms. One 48.4ms monitor-frame interval occurred in the Low night sample and is retained in the evidence. These are Edge measurements on this Windows host and emulated mobile conditions, not a claim of testing physical mid-range phones or laptops.

The historical machine-readable baseline, P2 gate, and final results are in `artifacts/performance/baseline/summary.json`, `artifacts/performance/p2-final/summary.json`, and `artifacts/performance/final/summary.json`. The historical final report includes its measured build's SHA-256. Full audit output and local browser evidence remain in `artifacts/`; artifact availability in a fresh checkout depends on which evidence files were committed.

Before presenting this as a personal portfolio, replace the remaining profile placeholders, concept content, contact address, and illustrative CV. The current local gate passed; Vercel sign-in/linking, live deployment verification, and physical phone/browser validation remain to be completed.
