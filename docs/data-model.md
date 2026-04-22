# Sprint 0-1 Data Model

## User

```json
{
  "id": "uuid",
  "phone": "18800000000",
  "name": "一班-01",
  "role": "member",
  "level": "L0",
  "salt": "...",
  "passwordHash": "...",
  "createdAt": "2026-04-22T00:00:00.000Z"
}
```

Rules:

- `phone` is unique.
- `role` is `member` for normal registration.
- Password is never stored as plain text.
- Sprint 1 UI does not expose admin credentials.

## Course

```json
{
  "id": "w1",
  "phaseId": "p1",
  "week": "W1",
  "title": "开训建制与通讯呼号",
  "objective": "...",
  "standard": "...",
  "warning": "...",
  "lessons": []
}
```

## Lesson

```json
{
  "id": "w1-l1",
  "code": "W1-L1",
  "title": "大纲发布与训练纪律",
  "goal": "L1 大纲发布与训练纪律",
  "actionStandard": "...",
  "commonError": "...",
  "drill": "..."
}
```

## Question

This is the stable template for the user's prepared question bank.

```json
{
  "id": "s-001",
  "type": "scenario",
  "title": "姿势选择",
  "scenario": "题干或场景描述",
  "options": ["A", "B", "C", "D"],
  "answer": 1,
  "analysis": "答案解析",
  "tags": ["射击", "姿势", "决策"],
  "difficulty": 2,
  "source": "W1 / lesson source"
}
```

Rules:

- `id` must be unique.
- `type` is `scenario` or `course` in Sprint 1.
- `answer` is a zero-based option index.
- `options` should contain at least 2 options and normally 4 options.
- `tags` are required because Sprint 2 profile/radar depends on them.
- `source` should identify the week, lesson, or source document.

## Progress

```json
{
  "lessons": {
    "w1": {
      "completed": true,
      "updatedAt": "2026-04-22T00:00:00.000Z"
    }
  },
  "quizzes": {},
  "quizAttempts": [],
  "questionAttempts": [],
  "tagStats": {}
}
```

Rules:

- Sprint 1 records week completion, not per-lesson completion.
- `tagStats` is derived from question attempts.
- Achievements are not a Sprint 1 product surface.

## QuestionAttempt

```json
{
  "questionId": "s-001",
  "title": "姿势选择",
  "type": "scenario",
  "correct": true,
  "tags": ["射击", "姿势", "决策"],
  "answeredAt": "2026-04-22T00:00:00.000Z"
}
```

Rules:

- Attempts are append-only from the user's perspective.
- Sprint 2 can compute ability radar using latest answer by question plus tag accuracy.

