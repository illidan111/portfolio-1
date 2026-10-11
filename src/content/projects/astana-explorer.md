---
title: Astana Explorer
tagline: A catalogue and map for exploring Astana.
description: Astana Explorer is a city guide built with plain JavaScript, HTML and CSS. A searchable place catalogue and Leaflet map share the same selection, with favourites and shareable place links.
category: Web apps
rarity: Rare
stack: [JavaScript, Leaflet, CSS]
skills: [javascript, css, accessibility, git]
voxel:
  palette: ['#467c42', '#86c45c', '#c6e88a', '#e7d69a']
  layers:
    - ['.........', '.....00..', '...0000..', '..00000..', '..0000...', '.0000....', '.000.....', '..0......', '..0......']
    - ['.....11..', '...1122..', '..11221..', '.112211..', '.12211...', '12211....', '1211.....', '31.......', '3........']
    - ['.........', '.....2...', '....21...', '...21....', '..21.....', '.21......', '.1.......', '.........', '.........']
year: '2026'
order: 1
icon: leaf
image: /art/project-astana-explorer.svg
sourceUrl: https://github.com/illidan111/astana-explorer
---

## Implemented features

- Search and category filters coordinate the catalogue, map markers and place inspector.
- Leaflet marker clustering uses OpenStreetMap tiles; the catalogue remains usable if map loading fails.
- Favourites and theme preferences use guarded localStorage with cross-tab updates; place links use URL hashes.
- Keyboard controls, focus restoration and reduced motion are covered by Playwright and axe tests.

## Scope and evidence

The repository contains curated place data and explicitly marked sample events, not a live events feed. Map tiles and optional Google Maps directions require external services.
