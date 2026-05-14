# Geschenk

Geschenk is a PWA frontend with an Express API backend in one npm workspace repo.

## Structure

```txt
.
├── apps/web   # React/Vite PWA
├── apps/api   # Express/Postgres API
├── package.json
└── render.yaml
```

The repository root owns workspace scripts and deployment config. App code lives under `apps/*`.

## Setup

Install all workspace dependencies from the repo root:

```bash
npm install
```

Create API environment variables in `apps/api/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/geschenk25
JWT_SECRET=your-super-secret-jwt-key
PORT=3000
NODE_ENV=development
RUN_MIGRATIONS_ON_START=false
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000
```

For common local UI work against the deployed API, run:

```bash
npm run dev
```

This uses `apps/web/.env.deployed`.

For local API work against the deployed database, create `apps/api/.env.deployed-db` from `apps/api/.env.deployed-db.example`, then run:

```bash
npm run dev:local-api
```

This starts the web app with `VITE_API_URL=http://localhost:3000` and the API with the deployed database URL.

Optional frontend API override in `apps/web/.env`:

```env
VITE_API_URL=http://localhost:3000
```

Without `VITE_API_URL`, the frontend defaults to `http://localhost:3000`.

## Google OAuth

Create OAuth credentials in Google Cloud and add these API environment variables:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
API_BASE_URL=http://localhost:3000
APP_BASE_URL=http://localhost:5173
```

For local development, add `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI.
For Render, add `https://geschenk25-api.onrender.com/api/auth/google/callback` or your API custom domain equivalent.

Magic-link emails are rate limited by default:

```env
AUTH_EMAIL_COOLDOWN_SECONDS=60
AUTH_EMAIL_MAX_PER_HOUR=5
AUTH_EMAIL_IP_MAX_PER_HOUR=20
```

## Development

Run the web app:

```bash
npm run dev
```

Run the API:

```bash
npm run dev:api
```

Build both:

```bash
npm run build:all
```
