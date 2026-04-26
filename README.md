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
```

Optional frontend API override in `apps/web/.env`:

```env
VITE_API_URL=http://localhost:3000
```

Without `VITE_API_URL`, the frontend defaults to `http://localhost:3000`.

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
