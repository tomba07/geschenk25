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

## Deployment to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables:
   - `DATABASE_URL` (from your Render PostgreSQL database)
   - `JWT_SECRET` (generate a random string)
   - `NODE_ENV=production`
6. After deployment, run migrations: `npm run migrate`
