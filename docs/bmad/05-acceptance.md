# Acceptance Matrix

## Sprint 1.5

- Register, login, logout work.
- SQLite stores new users, sessions, lessons, quiz attempts, and question attempts.
- JSON migration preserves existing users and progress.
- Question attempts include tags, skill classification when available, and lesson mapping when available.
- Admin placeholder is replaced with read-only access.
- Mobile pages keep 48px minimum key touch targets.

## Sprint 2

- Profile is generated from real progress and attempts.
- Empty Profile state points users back to course or question training.
- Admin can inspect users and detail data.
- Admin has two separate pages: `#/overview` and `#/users/:id`.
- Admin overview falls back to mobile user cards on narrow screens.
- API errors return clear JSON messages.
- Local performance remains usable for 100 users with 300 attempts each.

## Sprint 2.5 Question Bank Alignment

- `改版规格-题库-v2.md` can be imported without hand-editing generated data.
- Generated question bank includes title, question text, options, answer index, analysis, lesson mapping, skill classification, time estimate, knowledge point, difficulty, and source.
- H5 learner question bank and admin views load the same generated v2 question bank.
- Structural checks validate field presence, answer indexes, lesson coverage, and skill-domain coverage.
- Content correctness is treated as trusted source material and is not re-judged by code.
- Full course lesson-content replacement from `改版规格-课程内容.md` is out of this story.

## Sprint 2.6 Course Content Alignment

- `改版规格-课程内容.md` can be imported without hand-editing generated data.
- Generated course content includes phases, weeks, lesson codes, lesson titles, lesson manuals, deep dives when present, and course-detail display fields.
- H5 learner course map and admin views load the same generated v2 course content.
- Course detail pages show the full learner manual and deep-dive content from the markdown source.
- Structural checks validate 6 phases, 30 weeks, at least 60 lessons, unique lesson codes, and required manual content.
- Missing `deepDives` blocks are reported as source-data gaps, not silently fabricated.

## Verification Commands

- `npm run check`: syntax and Sprint 1/2 structural checks.
- `npm run import:data`: regenerate both course content and question bank runtime files.
- `npm run import:course`: regenerate runtime course content from `改版规格-课程内容.md`.
- `npm run import:qbank`: regenerate the runtime question bank from `改版规格-题库-v2.md`.
- `npm run test:api`: register/login/progress/profile/admin API smoke test.
- `npm run test:perf`: SQLite/Profile performance smoke with 100 users and 30,000 attempts.
