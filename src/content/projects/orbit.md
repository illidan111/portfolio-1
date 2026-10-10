---
title: Orbit
tagline: Less noise. More making.
description: A calm developer dashboard concept for keeping the next task, useful links, and a little breathing room in view.
category: Web apps
rarity: Epic
stack: [React, TypeScript, CSS]
skills: [react, typescript, css, accessibility, git]
voxel:
  palette: ['#937546', '#e8b95e', '#fff0ac', '#b087d6']
  layers:
    - ['.........', '....0....', '...000...', '000000000', '.0000000.', '..00000..', '..00000..', '.00...00.', '.........']
    - ['....2....', '...121...', '...121...', '111222111', '.1122211.', '..12221..', '..11211..', '.11...11.', '.1.....1.']
    - ['.........', '....2....', '....2....', '...222...', '..22222..', '...232...', '....3....', '.........', '.........']
year: '2026'
order: 2
icon: star
image: /art/project-orbit.svg
---

## Concept

Orbit is a self-directed exploration of a developer's start page. Its central question is simple: what would a dashboard look like if it helped someone begin meaningful work? The concept brings a short task list, a current project, and frequently used resources into one calm workspace.

The illustration is a proposed interface, not a connected productivity product. No account integrations, activity data, or performance claims are implied by this case study.

## Design decisions

A strong central column makes the next action obvious. Supporting information stays in smaller, predictable panels, while a muted palette leaves visual emphasis for the task being worked on. Empty states would explain how to get started instead of filling the screen with invented activity.

Keyboard access is part of the interaction model: clear focus states, sensible tab order, and controls with names that make sense without their icons. For a working prototype, small React components would manage task editing while ordinary CSS handles layout and themes.

## What I would build next

I would build a local-only prototype to test whether the overview is useful during a real workday. The first study would focus on finding and choosing the next task. Import and export would follow before any external integrations, giving the workspace a useful, independent foundation.
