# Sprint 1 Acceptance Criteria

## User Story Acceptance

### Register

Steps:

1. Open the app without a token.
2. Switch to register.
3. Enter callsign, valid 11-digit phone, and password with at least 6 characters.
4. Submit.

Expected:

- User is created.
- Token is stored.
- User lands on home.
- No default admin credential is displayed.

Failure cases:

- Invalid phone shows a readable error.
- Short password shows a readable error.
- Duplicate phone shows a readable error.

### Login / Logout

Steps:

1. Log in with an existing phone/password.
2. Click logout.

Expected:

- Successful login lands on home.
- Logout removes local token and returns to login.

### Home

Steps:

1. Log in as a new user.
2. View home.

Expected:

- Home shows the next recommended week.
- Home shows current learning summary.
- Home has a primary action to continue the week.
- Home has a primary action to start scenario questions.
- Home does not show achievements or full profile analytics.

### Course Map

Steps:

1. Open course tab.
2. Open any week.

Expected:

- Courses are grouped by six phases.
- Each week card shows week, title, and completion state.
- Week detail shows objective, standard, warning, lesson cards, related questions, and completion button.

### Mark Course Complete

Steps:

1. Open a week detail.
2. Click mark complete.
3. Refresh and log back in if needed.

Expected:

- Week is recorded as completed.
- Home moves to the next incomplete week.
- Course map shows completed state.

### Question Bank

Steps:

1. Open question tab.
2. Confirm the page has a clear question-bank title.
3. Choose scenario or course mode.
4. Switch between all questions, course filter, and knowledge-domain tag filter.
5. Answer all visible questions.
6. Submit.

Expected:

- The question-bank title changes with the selected course or tag.
- Course filter shows week chips and filters the set.
- Tag filter shows knowledge-domain chips and filters the set.
- Score is displayed.
- Correct answer is highlighted.
- Each submitted question shows correct/wrong state, analysis, and source.
- Attempts are written to progress.
- The user can retry the set.

### Profile Placeholder

Steps:

1. Open profile tab.

Expected:

- Page displays the user's callsign.
- Page displays simple recorded counts.
- Page clearly states that ability radar arrives in Sprint 2.
- No radar chart or advanced scoring is shown.

## Technical Checks

- `node --check server.js`
- `node --check public/app.js`
- `node --check public/v2.js`
- The app starts with `npm start`.
- `public/training-data.js` can be loaded and exposes phases, weeks, and questionBank.
- Question IDs are unique.
- No default admin account text appears in the learner login UI.

## Definition of Done

Sprint 1 is done only when:

- All in-scope user stories pass.
- Out-of-scope features are not visible as completed product surfaces.
- Course completion and question attempts persist.
- The Sprint 0 docs match the implemented behavior.
