# PRD Sprint 1.5

## Objective

Stabilize data, design, and code structure before Sprint 2 expands profile and admin.

## User Stories

- As a learner, my existing JSON progress is preserved after the SQLite migration.
- As a learner, my course completion and question attempts are saved in SQLite.
- As a product team, we have a fixed mobile UI baseline before adding Profile depth.
- As a developer, server storage is isolated behind a store layer.

## Acceptance

- Existing APIs keep their response shape.
- `data/app.db` is created on first start.
- Legacy JSON is imported once and no longer used as runtime storage.
- `npm run check` passes.
- Question-bank v2 fields are tolerated by the front end.
