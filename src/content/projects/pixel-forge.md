---
title: Pixel Forge
tagline: Small canvas. Big possibilities.
description: A browser pixel editor concept with a focused toolbelt, thoughtful keyboard controls, and room to experiment.
category: Creative tools
rarity: Legendary
stack: [TypeScript, Canvas, CSS]
skills: [typescript, css, performance, accessibility, figma]
voxel:
  palette: ['#71669a', '#b9b3ed', '#e6e0ff', '#b67b4e']
  layers:
    - ['..00000..', '....0000.', '....0..00', '...0....0', '..0......', '.0.......', '0........', '.........', '.........']
    - ['.112221..', '...11221.', '....3.121', '...33..11', '..33....1', '.33......', '33.......', '3........', '.........']
    - ['.........', '....11...', '....3....', '...3.....', '..3......', '.3.......', '3........', '.........', '.........']
year: '2026'
order: 3
icon: pickaxe
image: /art/project-pixel-forge.svg
---

## Concept

Pixel Forge is a self-directed creative-tool concept built around the pleasure of placing one deliberate pixel. A small canvas, a limited palette, and a familiar toolbelt make it easy to start drawing without a long setup. The concept would support quick sprite studies, tiny landscapes, and experiments in color.

The project artwork shows the intended editor layout. This is a design case study rather than a released editor, and the tools described here are proposed behavior.

## Design decisions

The canvas receives the most space; drawing tools stay close to it. Integer zoom levels preserve crisp edges, and the selected color has both a visual swatch and a readable value. Undo and redo would be visible controls as well as keyboard shortcuts, so experimentation feels recoverable.

A TypeScript drawing model would keep image data separate from the canvas rendering. That separation would make operations such as fills, palette changes, and history easier to reason about. Focusable controls and a keyboard cursor would give more people a way to participate in making pixel art.

## What I would build next

I would validate the smallest complete drawing loop: choose a color, place pixels, correct a mistake, and export a PNG. After testing pointer and keyboard interaction, the next exploration would be an animation timeline with onion-skin previews and a clear limit on complexity.
