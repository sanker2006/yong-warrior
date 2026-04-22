# User Journeys

## Learner Journey

1. Login/register creates a training identity.
2. Today page shows the next course and current record summary.
3. Course map shows 30 weeks by phase.
4. Course detail explains objective, standards, common errors, and drills.
5. Question bank starts from one of three entries: quick practice, by course, by knowledge domain.
6. Result page records score, wrong questions, and tags.
7. Profile shows course completion, answer accuracy, radar data, and weak recommendations from stored records.

## Administrator Journey

1. Administrator logs in through `/admin.html`.
2. User list shows learners, course progress, accuracy, strong tag, weak tag, and achievements count.
3. User detail shows course progress, answer records, skill-domain scores, and latest attempts.

## Guardrails

- No unauthenticated study or answering.
- No fake profile or radar data.
- Admin is read-only.
- New ideas go to backlog unless they directly support the main loop.
