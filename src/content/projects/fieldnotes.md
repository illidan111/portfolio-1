---
title: Fieldnotes
tagline: A little room to grow.
description: A mindful garden journal concept that turns small observations into a living record of the things you grow.
category: Web apps
rarity: Rare
stack: [Astro, TypeScript, CSS]
skills: [astro, typescript, css, accessibility, figma]
voxel:
  palette: ['#467c42', '#86c45c', '#c6e88a', '#e7d69a']
  layers:
    - ['.........', '.....00..', '...0000..', '..00000..', '..0000...', '.0000....', '.000.....', '..0......', '..0......']
    - ['.....11..', '...1122..', '..11221..', '.112211..', '.12211...', '12211....', '1211.....', '31.......', '3........']
    - ['.........', '.....2...', '....21...', '...21....', '..21.....', '.21......', '.1.......', '.........', '.........']
year: '2026'
order: 1
icon: leaf
image: /art/project-fieldnotes.svg
---

## Concept

Fieldnotes is a self-directed product concept for people who enjoy gardening more than maintaining spreadsheets. A plant has a simple timeline: the day it was planted, a new leaf, the first flower, and the occasional lesson learned. The idea is to make noticing feel worthwhile, even when there is nothing to harvest yet.

The illustrated interface explores a compact journal, a seasonal overview, and a gentle prompt to record one observation. This case study describes the concept and its design direction; it is not a launched service.

## Design decisions

Warm paper tones and leafy accents give the journal a quiet character. Plant names lead each card, with the latest observation nearby so that useful information is easy to find. Care reminders would remain optional: a garden journal should offer encouragement without turning every missed watering into a notification.

The proposed frontend uses semantic HTML, a responsive card layout, and explicit text labels alongside icons. An entry starts with a short note; details such as weather and a photograph can be added when they help tell the story.

## What I would build next

I would prototype the entry flow with gardeners who keep paper notes, then compare how quickly they can find the last watering or a recurring problem. An offline-first journal with a simple export would be the next technical exploration, allowing personal observations to stay useful beyond a single interface.
