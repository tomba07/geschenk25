import bcrypt from 'bcryptjs';
import pool from '../db';

export const DEFAULT_DEV_TEST_PASSWORD = 'password123';
export const DEV_TEST_ACCOUNTS = [
  { email: 'dev.alex@geschenk.test', username: 'dev_alex' },
  { email: 'dev.bailey@geschenk.test', username: 'dev_bailey' },
  { email: 'dev.casey@geschenk.test', username: 'dev_casey' },
  { email: 'dev.drew@geschenk.test', username: 'dev_drew' },
  { email: 'dev.elliot@geschenk.test', username: 'dev_elliot' },
];
const DEV_SAMPLE_GROUP_NAME = 'Dev Gift Exchange';
const DEV_SAMPLE_GROUP_DESCRIPTION = 'Seeded local Secret Santa group for development and QA.';
const DEV_SAMPLE_GIFT_IDEAS = [
  {
    forEmail: 'dev.alex@geschenk.test',
    createdByEmail: 'dev.bailey@geschenk.test',
    idea: 'Local coffee beans',
    link: 'https://example.com/local-coffee',
  },
  {
    forEmail: 'dev.alex@geschenk.test',
    createdByEmail: 'dev.casey@geschenk.test',
    idea: 'Desk plant',
    link: null,
  },
  {
    forEmail: 'dev.bailey@geschenk.test',
    createdByEmail: 'dev.drew@geschenk.test',
    idea: 'Insulated travel mug',
    link: null,
  },
  {
    forEmail: 'dev.bailey@geschenk.test',
    createdByEmail: 'dev.elliot@geschenk.test',
    idea: 'Board game night pick',
    link: 'https://example.com/board-game',
  },
  {
    forEmail: 'dev.casey@geschenk.test',
    createdByEmail: 'dev.alex@geschenk.test',
    idea: 'Nice notebook',
    link: null,
  },
  {
    forEmail: 'dev.drew@geschenk.test',
    createdByEmail: 'dev.casey@geschenk.test',
    idea: 'Warm beanie',
    link: null,
  },
  {
    forEmail: 'dev.elliot@geschenk.test',
    createdByEmail: 'dev.drew@geschenk.test',
    idea: 'Movie night snacks',
    link: null,
  },
];

interface DevSeedOptions {
  includeSampleGroup?: boolean;
}

export function devToolsEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_TOOLS === 'true';
}

export function getDevTestPassword() {
  return process.env.DEV_TEST_PASSWORD || DEFAULT_DEV_TEST_PASSWORD;
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

export function localDatabaseConfigured() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) return false;

  const databaseHost = new URL(databaseUrl).hostname;
  return ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
}

async function ensureDevSampleGroup(client: any, accounts: any[]) {
  const accountsByEmail = new Map(accounts.map((account) => [account.email, account]));
  const owner = accountsByEmail.get('dev.alex@geschenk.test');
  if (!owner) return null;

  const existingGroupResult = await client.query(
    'SELECT id FROM groups WHERE name = $1 AND created_by = $2 ORDER BY id ASC LIMIT 1',
    [DEV_SAMPLE_GROUP_NAME, owner.id]
  );

  let groupId = existingGroupResult.rows[0]?.id;
  if (groupId) {
    await client.query(
      'UPDATE groups SET description = $1 WHERE id = $2',
      [DEV_SAMPLE_GROUP_DESCRIPTION, groupId]
    );
  } else {
    const groupResult = await client.query(
      'INSERT INTO groups (name, description, image_url, created_by) VALUES ($1, $2, NULL, $3) RETURNING id',
      [DEV_SAMPLE_GROUP_NAME, DEV_SAMPLE_GROUP_DESCRIPTION, owner.id]
    );
    groupId = groupResult.rows[0].id;
  }

  for (const account of accounts) {
    if (account.id === owner.id) continue;
    await client.query(
      "INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active'",
      [groupId, account.id]
    );
  }

  for (const giftIdea of DEV_SAMPLE_GIFT_IDEAS) {
    const target = accountsByEmail.get(giftIdea.forEmail);
    const creator = accountsByEmail.get(giftIdea.createdByEmail);
    if (!target || !creator) continue;

    const existingIdeaResult = await client.query(
      `SELECT id FROM gift_ideas
       WHERE group_id = $1 AND for_user_id = $2 AND created_by_id = $3 AND idea = $4
       LIMIT 1`,
      [groupId, target.id, creator.id, giftIdea.idea]
    );
    if (existingIdeaResult.rows.length > 0) continue;

    await client.query(
      `INSERT INTO gift_ideas (group_id, for_user_id, created_by_id, idea, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [groupId, target.id, creator.id, giftIdea.idea, giftIdea.link]
    );
  }

  return groupId;
}

export async function ensureDevTestAccounts(friendUserId?: number, options: DevSeedOptions = {}) {
  const client = await pool.connect();
  try {
    const password = getDevTestPassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAccounts = [];

    await client.query('BEGIN');
    for (const account of DEV_TEST_ACCOUNTS) {
      const result = await client.query(
        `INSERT INTO users (email, username, password_hash, email_verified_at, is_test_account)
         VALUES ($1, $2, $3, NOW(), true)
         ON CONFLICT (email) DO UPDATE
         SET username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             email_verified_at = COALESCE(users.email_verified_at, NOW()),
             is_test_account = true
         RETURNING id, email, username, image_url, is_test_account`,
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

    if (options.includeSampleGroup) {
      await ensureDevSampleGroup(client, createdAccounts);
    }

    await client.query('COMMIT');
    return createdAccounts.map((account) => ({ ...account, password }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
