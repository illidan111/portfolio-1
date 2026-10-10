# Alex’s pixel portfolio

An original woodland developer portfolio built with Astro 6.4.8, strict TypeScript, and plain CSS. The entire site is static. All scene illustrations, interface icons, tiles, and characters are original SVG or CSS artwork; there are no Terraria assets.

## Run locally

Requires Node 22.12 or newer.

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

## Explore the world

- The six hotbar slots open Spawn, Projects, Skills, Journey, Contact, and Settings. Keys **1–6** do the same outside editable fields and dialogue.
- Filter the project inventory by category and open any item for its case study.
- Hover or focus equipment to reveal a tooltip; click an item to inspect its description. **Escape** dismisses a tooltip.
- Speak with **Pixel the Wanderer** using “Say hello,” the desktop speech bubble, or the campfire invitation. The native dialogue supports keyboard focus, Escape, and returning focus to its opener.
- Toggle day/night in the header. The world also cycles every 90 visible seconds. Automatic cycling and decorative movement are disabled when reduced motion is requested.
- Discover three achievements by exploring all sections, choosing night, and talking to Pixel. Theme and achievement preferences are stored only in the visitor’s browser; storage failures do not prevent exploration.
- At night, **Mote the Overthinker**, an original clockwork eye, drifts into the sky. Five deliberate clicks or taps earn its golden-lens achievement and a Journey trophy; Reduced Motion needs just one click. Hits are limited to two per second. Dismiss keeps the sky peaceful for this tab session, or turn Boss encounters off in Settings.
- The corner **World map** reveals landmarks as you explore. It saves visited sections and starts collapsed at every width to keep gameplay and inventory controls clear. Open it to browse; Escape closes it while focus is inside. Its keyboard-accessible equivalent lists every destination, including places you have not visited yet.
- At the Skills **crafting table**, inspect a skill, then choose Add. Combine up to three ingredients to find projects using all of them. Remove an ingredient or Reset to try another recipe. The original inventory filters remain independent.
- Settings has a speaker switch and a low default volume. All ten sound effects are synthesized locally. Sound is off by default; a saved On preference still requires **Resume sound** after reload or background suspension. There are no audio downloads.

### A secret for curious readers

On the home page, enter **↑ ↑ ↓ ↓ ← → ← → B A** outside a text field or dialog. The **Prismatic curiosity** discovery gives the torches gentle rainbow colors for twelve seconds. Reduced Motion uses static colors. This code is intentionally documented only here.

## Content and design decisions

- No personal identity, employment history, contact address, or real project details were supplied. **Alex is an explicitly disclosed illustrative identity**, and the three projects are complete concept studies rather than claims of shipped client work. The NPC contact answer explains this; no message is sent and no fake contact address is presented.
- `src/content/projects/*.md` contains the project case studies. `src/content/skills/*.json` and `src/content/experience/*.json` contain equipment and practice areas. Zod schemas and glob loaders are in `src/content.config.ts`.
- `src/styles/tokens.css` is the single global token layer. Spacing and sizes derive from `--px: 4px`, with fractional pixel units for thin borders and smaller type. Component styles are scoped in Astro files.
- **Pixelify Sans** is the only font family. Astro’s stable Fonts API uses the local provider against the installed Fontsource font files and copies WOFF2 files into the built assets. There are no runtime font-provider requests.
- Vanilla TypeScript handles the small interactive layer. No client framework or hydrated UI island is needed. Astro’s ClientRouter provides transitions between the inventory and case studies, with `fallback="swap"`. Regular links and all content remain available without JavaScript.
- Browser interaction state is reinitialized after client navigation and listeners, observers, and timers are disposed before swaps.
- The build stays in this repository. npm’s cache is also project-local. No hosting service, backend, authentication, analytics, trackers, or external APIs were added.
- Font and Three.js license notices are included in `public/licenses/`.

## References checked before implementation

- [Official Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/): Node requirements, Vite Environment API, Zod 4, Content Layer migration, stable Fonts API, and transition changes.
- [Astro Fonts API](https://docs.astro.build/en/guides/fonts/): local providers and the `Font` component.
- [Content collections](https://docs.astro.build/en/guides/content-collections/): glob loaders and `astro/zod`.
- [View transitions](https://docs.astro.build/en/guides/view-transitions/): `ClientRouter` and lifecycle events.

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

`src/scripts/engine/index.ts` owns the single animation-frame scheduler. Visible engines register small `init`, `update(dt)`, `render`, and `destroy` modules. Physics uses 1/60-second steps, caps catch-up work, and renders at up to 60Hz. Each engine pauses when its observed scene leaves the viewport, the document is hidden, or Reduced Motion is active. DOM interactions, navigation, and block regeneration remain functional without animation.

The hero stays within the visible scene; there is no moving camera, so the portfolio content never shifts while you play. Focus the woodland ground to use **A/D or ←/→** to walk, **Space/W/↑** to jump, and **E** at the doorway to visit Contact. **Escape** releases game focus. Coarse pointers get 48px left, right, and jump buttons. The normal Contact link also works without playing.

The central typed store in `src/scripts/engine/settings.ts` validates persisted settings and tolerates blocked or corrupt storage. **Motion** follows the device or forces Reduced; **Quality** is Auto, High, or Low; **Weather** follows the season, is off, or is locked to a chosen state; **Boss** and **Controls hint** can be disabled. Low disables WebGL, halves lightmap resolution, and uses static weather tint. Auto samples actual engine cadence and downgrades when frames cannot keep up. Reduced uses static lighting, no particles, and no gameplay motion. Sound starts off and requires a Settings gesture.

Auto starts **Low on coarse-pointer screens up to 700px**. Real browser profiling found expensive WebGL driver/extension initialization on the mobile project route, so phones receive the fast SVG fallback by default. Choosing High explicitly enables mobile voxel rotation. Larger screens start High and downgrade if the measured frame cadence is too slow.

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

The excavation module's `Secret` union, `secretNames`, `secretCopy`, and seeded slot list define discoveries. Add a matching ordinary link or explanation to `Digging.astro` so a hidden block is never the only path. The seed and block count last for the tab's session. The downloadable profile is explicitly illustrative; replace `public/alex-profile.txt` and `profile.cv` with your own CV before using this as a personal portfolio.

To add weather, extend the settings weather union and validation list, Settings options, then `descriptions`, `chooseWeather`, and particle behavior in `effects.ts`. Reuse the 150-slot pool; High caps at 150, Low at 50, and Reduced at zero. The low-resolution lightmap and all weather share one canvas. Seasonal Auto chooses winter snow, spring rain, autumn leaves, or clear summer skies with nighttime fireflies; a session-seeded rare night adds the friendly red moon tint.

### Recipes and synthesized sounds

Each project's `skills` frontmatter lists skill collection IDs. Zod validates these references, and `assertRecipeSkills` checks that every ID actually exists during prerendering, including when crafting is switched off. Recipes match every selected ingredient (AND), not just one. Adding a project or skill updates the table from the collections.

Add a named pattern to `tones` in `src/scripts/engine/audio.ts`: `notes` are frequencies in Hz, `step` is seconds per note, and optional `wave` and `gain` choose the oscillator and quiet envelope level. Dispatch `new CustomEvent('pixel:sound', { detail: 'your-sound-name' })` on `document`. The manager applies the persisted master volume, rate limits repeated events, caps concurrent voices at eight, disconnects ended nodes, and suspends on hidden tabs or Off. Never create a second AudioContext or start one from a lifecycle event. The existing names are `click`, `hover`, `jump`, `land`, `block`, `loot`, `craft`, `boss-hit`, `boss-defeated`, and `page-dig`.

## Verification completed

Verified on October 10, 2026 with Node 24.14.0 and the installed Microsoft Edge browser:

- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: 4 static pages, with local font assets.
- **All 71 Playwright tests passed**, including the original 18. Seven additional targeted checks passed after the final collapsed-map and mobile label adjustments. The full-suite HTML report is preserved at `artifacts/verification/full-suite-report/index.html`.
- Automated axe WCAG A/AA scans reported no violations on all four routes in day/night and rainy weather, plus the NPC dialogue. This is an automated check, supplemented by screenshot review, rather than a full accessibility certification.
- Layouts checked at 360, 390, 768, and 1440 CSS pixels. No horizontal overflow was found.
- Runtime requests remained local. JavaScript-disabled content, client navigation, keyboard controls, reduced motion, automatic day/night cycling, and browser storage failure paths were exercised.
- All ten flags disabled together also built without warnings and retained ordinary navigation, Settings, and SVG project art, with no Three.js requests.
- Scene, discovery, voxel, boss, crafting, Settings, minimap, and transition screenshots are in `artifacts/screenshots/`. The twelve rain/snow review images cover 1440, 768, and 360px in both themes. `npm run test:e2e` generates the latest Playwright HTML report at `artifacts/playwright-report/index.html`; its launcher keeps temporary profiles and transform caches project-local.

To rerun browser tests, build and run `npm run preview -- --port 4323` in another terminal. Tests default to this production-preview address; set `PORTFOLIO_TEST_URL` to use a different port. Run `node scripts/measure.mjs --matrix --label=current --routes=/` for the High/Low day/night frame and bundle measurements, and `powershell -File scripts/lighthouse.ps1 -Label current` for the three mobile Lighthouse audits. Tool caches, browser profiles, and reports stay inside this repository.

### Final measured budgets

All ten flags are enabled. Initial home external JavaScript grew from **8,227 to 24,887 gzip bytes**, an increase of **16,660 bytes** against the additional 25,000-byte allowance. Inline JavaScript remains 120 gzip bytes. Three.js was not requested by the home or Skills view.

| Mobile Lighthouse 13.5 | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home | 100 | 100 | 100 | 100 |
| Fieldnotes project | 100 | 100 | 100 | 100 |
| Skills (`/#skills`) | 99 | 100 | 100 | 100 |

The P2 gate also passed before P3 began: 19,651 home JS gzip bytes and 100 in every Lighthouse category on all three targets. Final maximum measured CLS is **0.006382**, below 0.05; no idle gameplay task exceeded 100ms and no application errors were captured.

Actual shared-engine averages were **59.3fps on High** in day and night, with maximum engine work of 0.7/1.0ms. **Low at a mobile viewport with 4× CPU throttling averaged 58.9/58.6fps**, with maximum engine work of 14.0/11.4ms. One 48.4ms monitor-frame interval occurred in the Low night sample and is retained in the evidence. These are Edge measurements on this Windows host and emulated mobile conditions, not a claim of testing physical mid-range phones or laptops.

The machine-readable baseline, P2 gate, and final results are in `artifacts/performance/baseline/summary.json`, `artifacts/performance/p2-final/summary.json`, and `artifacts/performance/final/summary.json`. The final report includes the measured build's SHA-256. Full audit output and local browser evidence remain in `artifacts/`; selected summaries and review screenshots are versioned.

Before presenting this as a personal portfolio, replace the disclosed demo identity, project concepts, and illustrative CV with your own details. A physical phone/browser check is the remaining device-validation step.
