# Geschenk

Geschenk is a PWA frontend with an Express API backend in one npm workspace repo.

## Structure

```txt
.
├── apps/web   # React/Vite PWA
├── apps/api   # Express/Postgres API
├── package.json
└── deploy      # VM deployment config
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

For common local UI work against the live API, run:

```bash
npm run dev
```

This uses `apps/web/.env.live`.

For local API work, run the API against `apps/api/.env` and the web app against localhost:

```bash
npm run dev:local-api
```

This starts the web app with `VITE_API_URL=http://localhost:3000` and the API with the local database URL.

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
For live, add `https://geschenk.mteschke.com/api/auth/google/callback`.

Magic-link emails are rate limited by default:

```env
AUTH_EMAIL_COOLDOWN_SECONDS=60
AUTH_EMAIL_MAX_PER_HOUR=5
AUTH_EMAIL_IP_MAX_PER_HOUR=20
```

## Notifications

Transactional email notifications use the same Resend settings as magic links:

```env
RESEND_API_KEY=...
EMAIL_FROM=Geschenk <help@example.com>
```

Notification emails include a one-click unsubscribe link and can also be disabled from the Profile screen. Sign-in and account emails are not affected by this preference.

PWA push notifications need VAPID keys on the API service:

```bash
npm run generate-vapid-keys --workspace @geschenk/api
```

Then set:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:help@example.com
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

Run the Playwright smoke tests:

```bash
npm run e2e
```

The smoke tests start the local API/web stack, run migrations, seed dev accounts, and use `dev.alex@geschenk.test` with the local default password. To test against an already-running app, set `PLAYWRIGHT_SKIP_WEBSERVER=true` and optionally override `PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_API_URL`.

## Deployment

The live app runs on the shared VM at `https://geschenk.mteschke.com`.

Deploy with:

```bash
./deploy/update-vm.sh
```

Live database maintenance commands should be run inside the API container on the VM, for example:

```bash
ssh root@165.227.2.163
cd /opt/apps/geschenk25/deploy
docker compose exec -T geschenk-api npm run seed-dev-accounts --workspace @geschenk/api
```
