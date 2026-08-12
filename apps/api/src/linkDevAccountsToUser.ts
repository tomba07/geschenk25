import pool from './db';
import { DEV_TEST_ACCOUNTS } from './utils/devTestAccounts';

async function linkDevAccountsToUser() {
  const targetEmail = (process.argv[2] || process.env.TARGET_EMAIL || '').trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL || '';
  const databaseHost = databaseUrl ? new URL(databaseUrl).hostname : '';
  const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
  const allowLiveLink = process.env.ALLOW_LIVE_DEV_FRIEND_LINK === 'true';

  if (!targetEmail) {
    console.error('Usage: TARGET_EMAIL=user@example.com npm run link-dev-accounts:api');
    process.exitCode = 1;
    return;
  }

  if (!isLocalDatabase && !allowLiveLink) {
    console.error('Refusing to link dev accounts in a live/remote database without ALLOW_LIVE_DEV_FRIEND_LINK=true.');
    process.exitCode = 1;
    return;
  }

  let client: any = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const targetResult = await client.query(
      'SELECT id, email, username FROM users WHERE lower(email) = $1',
      [targetEmail]
    );

    if (targetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`No user found for ${targetEmail}`);
      process.exitCode = 1;
      return;
    }

    const targetUser = targetResult.rows[0];
    const devEmails = DEV_TEST_ACCOUNTS.map((account) => account.email);
    const devUsersResult = await client.query(
      'SELECT id, email, username FROM users WHERE email = ANY($1::text[]) ORDER BY email',
      [devEmails]
    );

    if (devUsersResult.rows.length !== DEV_TEST_ACCOUNTS.length) {
      const foundEmails = new Set(devUsersResult.rows.map((user: any) => user.email));
      const missingEmails = devEmails.filter((email) => !foundEmails.has(email));
      await client.query('ROLLBACK');
      console.error(`Missing dev account(s): ${missingEmails.join(', ')}`);
      console.error('Seed the dev accounts first, then run this command again.');
      process.exitCode = 1;
      return;
    }

    for (const devUser of devUsersResult.rows) {
      const firstId = Math.min(targetUser.id, devUser.id);
      const secondId = Math.max(targetUser.id, devUser.id);
      if (firstId !== secondId) {
        await client.query(
          'INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [firstId, secondId]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Linked ${devUsersResult.rows.length} dev account(s) as friends with ${targetUser.email} (${targetUser.username || 'no username'}).`);
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Failed to link dev accounts to user:', error);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

linkDevAccountsToUser();
