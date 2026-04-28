# Sprint 0-1 Requirements

## Product Goal

Build the first usable loop for the Ningbo Yongshi training product: a learner can register, enter the training terminal, study the 30-week course map, answer basic question sets, and leave progress data that can support Sprint 2 profile and ability radar work.

The product is mobile-first. Sprint 1 should feel like a focused training tool, not a portal or admin system.

## Users

| Role | Description | Sprint 1 Capability |
|---|---|---|
| Learner | Team member using the app on mobile before or after training | Register, log in, view courses, complete courses, answer questions, view a profile placeholder |
| Admin | Future internal operator | No Sprint 1 UI. Data must be recorded so a later admin view can inspect users, progress, and question performance |

## Sprint 1 Scope

### In Scope

- Registration and login with phone, callsign/name, and password.
- Logout from the mobile app.
- Home page that answers "what should I continue today?"
- 30-week course map grouped by phase.
- Course detail page with objective, standard, warning, and lesson cards.
- Marking a course week as completed.
- Question bank with two initial modes: scenario questions and course questions.
- Answer submission, score display, correct/wrong state, answer analysis, and source display.
- Recording course completion and question attempts for Sprint 2 profile calculations.
- Profile tab placeholder only, explaining that ability radar arrives in Sprint 2.

### Out of Scope

- Ability radar chart and full profile analytics.
- Backend/admin dashboard UI.
- Achievements.
- Equipment and venue management.
- Instructor operations, mission dispatch, AAR, and assessment workflows.
- Social, leaderboard, export, AI recommendation, or native mobile app.
- Advanced question modes such as tag drills and wrong-question review.

## Core User Stories

1. As a learner, I can register with phone, callsign, and password so the system can create my training record.
2. As a learner, I can log in and return to my latest progress.
3. As a learner, I can see the next recommended course on the home page.
4. As a learner, I can browse the 30-week course map by phase.
5. As a learner, I can open a week and understand the training goal, standard, common warnings, and lessons.
6. As a learner, I can mark a week as completed.
7. As a learner, I can answer scenario or course questions and immediately see the result and explanation.
8. As a learner, I can see that a profile page is coming in Sprint 2 without being shown unfinished analytics.

## Success Metrics

- A new user can complete registration, course viewing, question answering, and logout without help.
- Course completion is persisted and visible after refresh/login.
- Question attempts are persisted and available for Sprint 2 calculations.
- No default admin credentials are visible in the learner UI.
- Sprint 1 UI does not expose achievements, full admin management, or ability radar.

## Scope Control

Every new request during Sprint 1 must be classified as:

- Doing: required for the Sprint 1 learning-question-progress loop.
- Later: supports profile, admin read-only view, analytics, or quality hardening.
- Not Now: equipment, instructor operations, social, leaderboard, AI, export, or unrelated workflows.

