# UX Redesign Brief

## Decision

The current UI is treated as design debt. It remains available as implementation reference only, but Sprint 1 product experience will be redesigned through a separate `v2` prototype before replacing the main app.

## What We Keep

- Course content shape from `training-data.js`.
- Question data shape from `training-data.js`.
- Existing logo asset.
- Existing auth/progress APIs as future integration references.

## What We Do Not Keep

- Current visual style and component hierarchy.
- Current dashboard/card-heavy layout.
- Current "战绩/成就" product surface.
- Tag drill, achievements, admin workflow, AAR, assessment, equipment, and venue flows.
- Any UI that does not directly support learning, answering, or progress recording.

## Core Experience Thesis

The app should feel like a compact field notebook and training console, not a generic dashboard. The first screen must answer one question: "What should I continue now?"

The learner should never need to interpret the product structure before acting. Each screen should provide one primary next action:

- Auth: enter training record.
- Home: continue the next course or start the recommended question set.
- Course: understand the week and mark completion.
- Question: choose question type, filter by course or knowledge-domain tag, answer, submit, learn from the analysis.
- Profile: show recorded counts now, reserve ability radar for Sprint 2.

## Behavioral Design

- Use smart defaults: default to the next incomplete course and scenario questions.
- Reduce friction: no nested menus or advanced filters in Sprint 1.
- Gate learning behind registration/login so every course and question action can be recorded.
- Create progress ownership: show completed weeks and recorded question count, but avoid premature scoring theatrics.
- Bend, not break: empty states should guide the next action instead of judging the learner.
- Save future loss aversion for Sprint 2: ability radar and weak-point history become meaningful only after enough data exists.

## Visual Direction

Direction: industrial field notebook.

Traits:

- Dark paper/graphite base with olive and signal-yellow accents.
- Dense but calm information hierarchy.
- Full-width mobile sections, no nested cards.
- Strong section labels and numbered training blocks.
- Buttons should look like commands, not decoration.
- Avoid purple gradients, floating blobs, and generic SaaS dashboard patterns.

## Sprint 1 Screens

1. Login/register shell
2. Today screen
3. Course map
4. Course detail
5. Question bank with title, type switch, course filter, and knowledge-domain tag filter
6. Question result state
7. Profile placeholder

## Prototype Acceptance

The `v2` prototype is acceptable when:

- It is visually distinct from the old UI.
- It is usable on a phone-width viewport.
- It shows the complete Sprint 1 navigation path.
- It blocks course/question access before login/register.
- It uses real course/question data where practical.
- It allows question browsing by all questions, by course, and by tag.
- It does not expose out-of-scope features as complete functionality.
