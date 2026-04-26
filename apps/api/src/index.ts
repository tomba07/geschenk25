import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import groupsRoutes from './routes/groups';
import { runMigrations } from './migrate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit to 10MB for image uploads

// Health check
app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);

// Error handling middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  if (process.env.RUN_MIGRATIONS_ON_START === 'true') {
    await runMigrations();
    console.log('Startup migrations completed successfully');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  }).on('error', (err: any) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
