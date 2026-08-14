import pool from './db';
import {
  DEFAULT_DEV_TEST_PASSWORD,
  DEV_TEST_ACCOUNTS,
  ensureDevTestAccounts,
  getDevTestPassword,
  localDatabaseConfigured,
} from './utils/devTestAccounts';

async function seedDevAccounts() {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = process.env.DATABASE_URL || '';
  const databaseHost = databaseUrl ? new URL(databaseUrl).hostname : '';
  const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
  const isLiveSeed = isProduction || !isLocalDatabase;
  const allowLiveSeed = process.env.ALLOW_LIVE_DEV_ACCOUNT_SEED === 'true';

  if (isLiveSeed && !allowLiveSeed) {
    console.error('Refusing to seed dev accounts in a live/remote database without ALLOW_LIVE_DEV_ACCOUNT_SEED=true.');
    process.exitCode = 1;
    return;
  }

  if (isLiveSeed && getDevTestPassword() === DEFAULT_DEV_TEST_PASSWORD) {
    console.error('Refusing to seed live dev accounts with the default password. Set DEV_TEST_PASSWORD first.');
    process.exitCode = 1;
    return;
  }

  try {
    const includeSampleGroup = localDatabaseConfigured();
    const accounts = await ensureDevTestAccounts(undefined, { includeSampleGroup });
    console.log(`Seeded ${accounts.length} dev testing account(s):`);
    accounts.forEach((account) => {
      console.log(`- ${account.email} / @${account.username}`);
    });
    if (includeSampleGroup) {
      console.log('Seeded local sample group: Dev Gift Exchange');
    }

    if (!isProduction && getDevTestPassword() === DEFAULT_DEV_TEST_PASSWORD) {
      console.log(`Local password: ${DEFAULT_DEV_TEST_PASSWORD}`);
    } else {
      console.log('Password: set from DEV_TEST_PASSWORD');
    }

    console.log(`Expected accounts: ${DEV_TEST_ACCOUNTS.map((account) => account.email).join(', ')}`);
  } catch (error) {
    console.error('Failed to seed dev testing accounts:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedDevAccounts();
