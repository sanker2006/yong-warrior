# Database

## SQLite File

`data/app.db`

## Tables

- `users`: identity, role, level, password hash.
- `sessions`: bearer tokens with expiry.
- `lesson_progress`: user course/week completion.
- `quiz_attempts`: submitted question-set summary.
- `question_attempts`: per-question results, tags, skill classification, lesson mapping.
- `aar_records`: compatibility storage for existing API.
- `assessments`: compatibility storage for existing API.

## Migration

On first startup, existing JSON data is imported once into SQLite and `meta.legacy_json_migrated` is set. After that, runtime writes go to SQLite.

## Profile Derivation

Profile uses latest attempt per question to calculate:

- total answered
- correct count
- accuracy
- tag stats
- eight skill-domain radar scores
- weak recommendations
