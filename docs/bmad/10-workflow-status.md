# BMAD Workflow Status

## Routing Brief

- Packet type: brownfield-resume-packet
- Project type: web app
- Project level: 3
- Runtime context: Codex
- Current phase: implementation
- Confidence: high

## Why

The repo has active code, SQLite persistence, Sprint 1.5 docs, Profile APIs, admin APIs, and smoke/performance checks. The next reducer of ambiguity is not another PRD; it is execution status plus a small Sprint 2 story slice.

## Recommended Next Move

Story packet: Sprint 2.6 course content v2 structured import and runtime alignment.

## Current State

- Sprint 1 learner loop exists: register/login, course, question bank, progress records.
- SQLite storage exists via `lib/store.js`.
- Profile aggregation exists via `/api/profile`.
- Admin read APIs exist: `/api/admin/users` and `/api/admin/users/:id`.
- QA commands exist: `npm run check`, `npm run test:api`, `npm run test:perf`.
- Profile usability slice is implemented: data source, latest attempt, empty-state actions.
- Admin information architecture is split into two routes: `#/overview` and `#/users/:id`.
- Admin overview has a mobile card layout below 520px.
- Question bank v2 is imported from `改版规格-题库-v2.md` into `public/question-bank-v2.js`.
- Runtime question bank now exposes 160 questions, 61 lesson mappings, and 10 skill classifications.
- Course content v2 is imported from `改版规格-课程内容.md` into `public/course-content-v2.js`.
- Runtime course content now exposes 6 phases, 30 weeks, and 61 lessons.
- Source-course facts: W1 has 3 lessons; 16 lessons do not contain `deepDives` blocks in the markdown source.

## Active Story

Align the running H5 and admin course content with the v2 markdown source while keeping the importer repeatable for ongoing course edits.

## Definition of Done

- Admin list shows learner status/risk.
- Admin detail shows next action, ability-domain scores, recent course records, recent question records, and weak recommendations.
- Overview page shows core metrics plus one row per registered learner.
- Detail page is reachable by URL hash and browser navigation.
- Narrow screens use cards instead of forcing the overview table.
- No admin write operation is introduced.
- `npm run import:course` regenerates `public/course-content-v2.js` from the markdown source.
- `npm run import:qbank` regenerates `public/question-bank-v2.js` from the markdown source.
- `npm run import:data` regenerates both generated runtime data files.
- `npm run check` validates the generated v2 course structure.
- `npm run check` validates the generated v2 question structure.
- `npm run check` and `npm run test:api` pass.

## What Not To Do Yet

- Do not add admin write operations.
- Do not add a new framework.
- Do not modify SQLite schema unless a failing story requires it.
- Do not silently invent missing `deepDives`; missing source sections must be surfaced as source-data gaps.
