# Geschenk API

Express/Postgres backend API for the Geschenk PWA.

## Setup

From the repository root, install all workspace dependencies:

```bash
npm install
```

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/geschenk25
JWT_SECRET=your-super-secret-jwt-key
PORT=3000
NODE_ENV=development
```

Run database migrations:

```bash
npm run build:api
npm run migrate:api
```

Start the server:

```bash
npm run dev:api
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
  - Body: `{ username: string, password: string }`
  - Returns: `{ token: string, user: { id, username } }`

- `POST /api/auth/login` - Login
  - Body: `{ username: string, password: string }`
  - Returns: `{ token: string, user: { id, username } }`

- `GET /api/auth/me` - Get current user (requires Authorization header)
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ user: { id, username } }`

### Groups

All group endpoints require authentication (Authorization header).

- `GET /api/groups` - Get user's groups
- `GET /api/groups/:id` - Get single group
- `POST /api/groups` - Create group
  - Body: `{ name: string, description?: string }`
- `DELETE /api/groups/:id` - Delete group

## Deployment

The API is deployed as the `geschenk-api` service in the VM Docker Compose stack.

From the repository root:

```bash
./deploy/update-vm.sh
```

The live API is available behind Caddy at `https://geschenk.mteschke.com/api/*`.

### Notification Email Batching

Routine notifications (friend requests, friend acceptances, friend additions, group additions,
and unread Secret Santa messages) are combined across groups into one digest per recipient.
The first queued event starts a 12-hour window; later events do not extend it. Delivery is
limited to once every 12 hours per recipient, and empty digests are never sent. Reading a
chat removes its pending reminder. Push notifications remain immediate.

Name-draw announcements, login links, and password resets are sent immediately, outside
the digest limit. Notification email preferences and unsubscribe links still apply to digests.
The old delay/max-wait and disable-batching settings are no longer used.

```env
EMAIL_BATCH_PROCESS_INTERVAL_MS=60000
```

Digest integration tests use a dedicated local PostgreSQL database whose name ends in
`_email_test`. Email HTTP calls are mocked; no real emails are sent:

```sh
npm run build:api
DATABASE_URL=postgres://.../geschenk_email_test node --test tests/api/email-digest.test.cjs
```
