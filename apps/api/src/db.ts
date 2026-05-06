import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
  console.error('Please set DATABASE_URL in your Render environment variables.');
  throw new Error('DATABASE_URL is required');
}

console.log('Database URL configured:', databaseUrl ? `${databaseUrl.split('@')[0]}@***` : 'NOT SET');

const databaseHost = new URL(databaseUrl).hostname;
const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
});

// Test connection
pool.on('error', (err: any) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
