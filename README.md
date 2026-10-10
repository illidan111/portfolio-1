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
npm run preview
npm run test:e2e
```

`dist/` is the complete static deployment output; no adapter, server, account, or database is required. The end-to-end suite uses a locally installed Microsoft Edge browser. See `playwright.config.ts` for the preview address and browser settings.

## Explore the world

- The five hotbar slots navigate to Spawn, Projects, Skills, Journey, and Contact. Keys **1–5** do the same outside editable fields and dialogue.
- Filter the project inventory by category and open any item for its case study.
- Hover or focus equipment to reveal a tooltip; click an item to inspect its description. **Escape** dismisses a tooltip.
- Speak with **Pixel the Wanderer** using “Say hello,” the desktop speech bubble, or the campfire invitation. The native dialogue supports keyboard focus, Escape, and returning focus to its opener.
- Toggle day/night in the header. The world also cycles every 90 visible seconds. Automatic cycling and decorative movement are disabled when reduced motion is requested.
- Discover three achievements by exploring all sections, choosing night, and talking to Pixel. Theme and achievement preferences are stored only in the visitor’s browser; storage failures do not prevent exploration.

## Content and design decisions

- No personal identity, employment history, contact address, or real project details were supplied. **Alex is an explicitly disclosed illustrative identity**, and the three projects are complete concept studies rather than claims of shipped client work. The NPC contact answer explains this; no message is sent and no fake contact address is presented.
- `src/content/projects/*.md` contains the project case studies. `src/content/skills/*.json` and `src/content/experience/*.json` contain equipment and practice areas. Zod schemas and glob loaders are in `src/content.config.ts`.
- `src/styles/tokens.css` is the single global token layer. Spacing and sizes derive from `--px: 4px`, with fractional pixel units for thin borders and smaller type. Component styles are scoped in Astro files.
- **Pixelify Sans** is the only font family. Astro’s stable Fonts API uses the local provider against the installed Fontsource font files and copies WOFF2 files into the built assets. There are no runtime font-provider requests.
- Vanilla TypeScript handles the small interactive layer. No client framework or hydrated UI island is needed. Astro’s ClientRouter provides transitions between the inventory and case studies, with `fallback="swap"`. Regular links and all content remain available without JavaScript.
- Browser interaction state is reinitialized after client navigation and listeners, observers, and timers are disposed before swaps.
- The build stays in this repository. npm’s cache is also project-local. No hosting service, backend, authentication, analytics, trackers, or external APIs were added.

## References checked before implementation

- [Official Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/): Node requirements, Vite Environment API, Zod 4, Content Layer migration, stable Fonts API, and transition changes.
- [Astro Fonts API](https://docs.astro.build/en/guides/fonts/): local providers and the `Font` component.
- [Content collections](https://docs.astro.build/en/guides/content-collections/): glob loaders and `astro/zod`.
- [View transitions](https://docs.astro.build/en/guides/view-transitions/): `ClientRouter` and lifecycle events.

Browser screenshots and verification outputs are saved in `artifacts/`.

## Verification completed

Verified on October 10, 2026 with Node 24.14.0 and the installed Microsoft Edge browser:

- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: 4 static pages, with local font assets.
- `npm run test:e2e`: all 18 tests passed against the production preview in one final run.
- Automated axe WCAG A/AA scans reported no violations on the homepage, NPC dialogue, and a case study. This is an automated check, supplemented by manual screenshot review, rather than a full accessibility certification.
- Layouts checked at 360, 390, 768, and 1440 CSS pixels. No horizontal overflow was found.
- Runtime requests remained local. JavaScript-disabled content, client navigation, keyboard controls, reduced motion, automatic day/night cycling, and browser storage failure paths were exercised.
- Seven final screenshots are in `artifacts/screenshots/`; the final Playwright HTML report is generated at `artifacts/playwright-report/index.html`.

To rerun browser tests, keep `npm run dev` running in another terminal, or build and run `npm run preview -- --port 4321`. The suite expects that local port.
