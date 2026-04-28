# Architecture

## Runtime

Native Node HTTP server with static H5 assets and SQLite persistence.

## Storage

`lib/store.js` owns all SQLite reads and writes. API handlers do not read or write JSON directly.

## API Compatibility

Existing learner APIs stay stable:

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `POST /api/progress`

New read APIs:

- `GET /api/profile`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`

## Frontend

`v2.js` remains framework-free and consumes `/api/profile` for Profile data. Admin uses `/admin.html` and `admin.js`.
