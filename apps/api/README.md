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

Secret Santa chat emails are batched by default so quick message bursts do not send one email per message.

Useful production knobs:

```env
EMAIL_BATCH_DELAY_MINUTES=10
EMAIL_BATCH_MAX_WAIT_MINUTES=30
EMAIL_BATCH_PROCESS_INTERVAL_MS=60000
DISABLE_EMAIL_BATCHING=false
```
