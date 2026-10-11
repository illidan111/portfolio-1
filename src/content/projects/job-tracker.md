---
title: Job Tracker
tagline: Applications, next actions and interview preparation.
description: Job Tracker, branded Waypoint in the repository, is a personal career workspace. Its React and TypeScript frontend connects to an Express API with SQLite persistence for applications and related career records.
category: Web apps
rarity: Epic
stack: [React, TypeScript, Express, SQLite, Zod, Zustand]
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
image: /art/project-job-tracker.svg
sourceUrl: https://github.com/illidan111/job-tracker
---

## Implemented features

- Application search, filtering and a Kanban board support drag-and-drop and keyboard status changes.
- Tasks, contacts, saved jobs and interview preparation keep next actions beside application records.
- Authentication uses scrypt password hashing and HttpOnly session cookies; database queries scope records to the signed-in owner.
- Shared Zod validation, version-checked writes and transactional JSON import/export protect persisted data.

## Scope and evidence

New accounts start empty. Optional seed records are fictional; the repository documents a local full-stack product, without a verified hosted service or live job-board feed.
