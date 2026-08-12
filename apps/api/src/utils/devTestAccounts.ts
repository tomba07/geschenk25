import bcrypt from 'bcryptjs';
import pool from '../db';

export const DEV_TEST_PASSWORD = 'password123';
export const DEV_TEST_ACCOUNTS = [
  { email: 'dev.alex@geschenk.test', username: 'dev_alex' },
  { email: 'dev.bailey@geschenk.test', username: 'dev_bailey' },
  { email: 'dev.casey@geschenk.test', username: 'dev_casey' },
  { email: 'dev.drew@geschenk.test', username: 'dev_drew' },
  { email: 'dev.elliot@geschenk.test', username: 'dev_elliot' },
];

export function devToolsEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_TOOLS === 'true';
}

async function createFriendship(client: any, firstUserId: number, secondUserId: number) {
  const firstId = Math.min(firstUserId, secondUserId);
  const secondId = Math.max(firstUserId, secondUserId);
  if (firstId === secondId) return;

  await client.query(
    'INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [firstId, secondId]
  );
}

export async function ensureDevTestAccounts(friendUserId?: number) {
  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(DEV_TEST_PASSWORD, 10);
    const createdAccounts = [];

    await client.query('BEGIN');
    for (const account of DEV_TEST_ACCOUNTS) {
      const result = await client.query(
        `INSERT INTO users (email, username, password_hash, email_verified_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (email) DO UPDATE
         SET username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             email_verified_at = COALESCE(users.email_verified_at, NOW())
         RETURNING id, email, username, image_url`,
        [account.email, account.username, passwordHash]
      );
      createdAccounts.push(result.rows[0]);

      if (friendUserId) {
        await createFriendship(client, friendUserId, result.rows[0].id);
      }
    }

    for (let i = 0; i < createdAccounts.length; i += 1) {
      for (let j = i + 1; j < createdAccounts.length; j += 1) {
        await createFriendship(client, createdAccounts[i].id, createdAccounts[j].id);
      }
    }

    await client.query('COMMIT');
    return createdAccounts.map((account) => ({ ...account, password: DEV_TEST_PASSWORD }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
