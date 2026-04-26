import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import groupsRoutes from './routes/groups';
import { runMigrations } from './migrate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const MIGRATION_RETRY_DELAY_MS = 5000;
const MIGRATION_MAX_ATTEMPTS = 12;
let migrationsReady = process.env.RUN_MIGRATIONS_ON_START !== 'true';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit to 10MB for image uploads

// Health check
app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'ok' });
});

app.use((req: any, res: any, next: any) => {
  if (migrationsReady || req.path === '/health') {
    next();
    return;
  }

  res.status(503).json({ error: 'Server is starting. Please try again shortly.' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);

// Error handling middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function runStartupMigrationsWithRetry() {
  for (let attempt = 1; attempt <= MIGRATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      await runMigrations();
      migrationsReady = true;
      console.log('Startup migrations completed successfully');
      return;
    } catch (error) {
      console.error(`Startup migrations failed (attempt ${attempt}/${MIGRATION_MAX_ATTEMPTS}):`, error);

      if (attempt === MIGRATION_MAX_ATTEMPTS) {
        console.error('Startup migrations failed after all retry attempts');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, MIGRATION_RETRY_DELAY_MS));
    }
  }
}

function startServer() {
  app.listen(Number(PORT), HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);

    if (process.env.RUN_MIGRATIONS_ON_START === 'true') {
      runStartupMigrationsWithRetry();
    }
  }).on('error', (err: any) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

startServer();
