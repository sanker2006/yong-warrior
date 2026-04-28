# Sprint 0-1 Product Design

## Design Principles

- Mobile-first and task-first: the home page should tell the learner what to continue now.
- Low friction: registration and answering should require the fewest decisions possible.
- Immediate feedback: question submission should show score, correct answer, and explanation in place.
- No premature analytics: Sprint 1 records data but does not pretend to have a mature profile system.
- Tactical tone without clutter: dense enough for training, but readable on a phone.

## Information Architecture

```
Auth
  Login
  Register

Mobile App
  Home
  Course Map
    Week Detail
  Question Bank
    Scenario Questions
    Course Questions
    Result State
  Profile Placeholder
```

## Pages

### Login / Register

Purpose: get the learner into the product and create a training record.

Required states:

- Empty form
- Invalid phone
- Password shorter than 6 characters
- Duplicate phone
- Login failure
- Successful register/login

Design notes:

- Do not show default admin credentials.
- Register copy should say "建立训练档案".
- Login copy should say "继续训练".

### Home

Purpose: answer "today I should continue what?"

Content:

- Next recommended week
- Recent learning summary
- Recommended question set
- Profile preview card showing Sprint 2 radar placeholder

Primary actions:

- Continue next week
- Start scenario questions

### Course Map

Purpose: browse the 30-week training structure.

Content:

- Phase blocks
- Week cards
- Completed state
- Lesson count

Primary action:

- Open a week detail.

### Week Detail

Purpose: make one training week understandable and actionable.

Content:

- Phase and week
- Training objective
- Pass standard
- Warning/principle
- Lesson cards with action standard, common error, and drill
- Related questions
- Mark week completed

States:

- Not completed
- Completed
- No related questions
- Save failure

### Question Bank

Purpose: run a simple learning check.

Modes:

- Scenario questions
- Course questions

Content:

- Question count
- Question cards
- Options
- Tags
- Result after submission
- Analysis and source

States:

- No questions in selected mode
- Unsubmitted
- Submitted
- Retry set
- Save failure

### Profile Placeholder

Purpose: create navigation continuity for Sprint 2 without shipping unfinished analytics.

Content:

- Learner callsign
- Course count completed
- Answer count recorded
- Sprint 2 notice: ability radar and weak-point recommendations are coming next.

No radar chart in Sprint 1.

## Navigation

Bottom navigation:

- 首页
- 课程
- 题库
- 档案

The profile tab is a placeholder. It must not show advanced ability scoring before the data model is validated.

