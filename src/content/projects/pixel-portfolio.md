---
title: Pixel Portfolio
tagline: A playable woodland with a readable Classic view.
description: This Terraria-style portfolio is a static Astro 6 site with strict TypeScript and original pixel artwork. A custom canvas game engine adds exploration and day/night lighting, while Classic mode presents the same content in ordinary document flow.
category: Creative tools
rarity: Legendary
stack: [Astro, TypeScript, CSS, Canvas, Playwright]
skills: [astro, typescript, javascript, css, accessibility, git, performance]
voxel:
  palette: ['#71669a', '#b9b3ed', '#e6e0ff', '#b67b4e']
  layers:
    - ['..00000..', '....0000.', '....0..00', '...0....0', '..0......', '.0.......', '0........', '.........', '.........']
    - ['.112221..', '...11221.', '....3.121', '...33..11', '..33....1', '.33......', '33.......', '3........', '.........']
    - ['.........', '....11...', '....3....', '...3.....', '..3......', '.3.......', '3........', '.........', '.........']
year: '2026'
order: 3
icon: pickaxe
image: /art/project-pixel-portfolio.svg
sourceUrl: https://github.com/illidan111/portfolio-1
---

## Implemented features

- A custom canvas engine coordinates movement, day/night lighting, weather and interaction with the world.
- Classic mode, keyboard navigation and reduced-motion fallbacks keep project content accessible.
- Typed Astro collections drive project pages, skill recipes and shared profile metadata; Playwright and axe check interactions and geometry.
- The archived Lighthouse 13.5 report on 10 October 2026 recorded home scores of 100 for Performance, Accessibility, Best Practices and SEO.

## Scope and evidence

The Lighthouse result comes from the [archived performance report](https://github.com/illidan111/portfolio-1/blob/908bd05/artifacts/performance/final/summary.json) before this content update. vercel.json configures static deployment, but a production deployment and URL remain unconfirmed.
