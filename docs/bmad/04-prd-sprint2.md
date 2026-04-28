# PRD Sprint 2

## Objective

Ship the first real ability profile and read-only admin view.

## User Stories

- As a learner, I can see course completion, question count, accuracy, radar data, and weak recommendations.
- As a learner, I can understand that radar data comes from real question attempts.
- As an administrator, I can view registered learners and each learner's progress and question performance.

## Acceptance

- Profile reads from `/api/profile`.
- Radar dimensions are the eight fixed skill domains.
- Weak recommendations are generated from the lowest skill-domain scores.
- `/api/admin/users` lists learners with progress.
- `/api/admin/users/:id` returns one learner's progress, profile, and attempts.
- No admin write operations are exposed.
