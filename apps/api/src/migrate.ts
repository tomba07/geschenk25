import pool from './db';

export async function runMigrations() {
  // Create users table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE,
        password_hash VARCHAR(255),
        image_url TEXT,
        email_verified_at TIMESTAMPTZ,
        is_test_account BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

  // Add email column if it doesn't exist (for existing databases).
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'email'
        ) THEN
          ALTER TABLE users ADD COLUMN email VARCHAR(255);
          UPDATE users SET email = username || '+legacy@geschenk.local' WHERE email IS NULL;
          ALTER TABLE users ALTER COLUMN email SET NOT NULL;
          ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
        END IF;
      END $$;
    `);

  // New signups verify email first, then choose a username during profile setup.
  await pool.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'username' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
        END IF;
      END $$;
    `);

  // Add image_url column if it doesn't exist (for existing databases)
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'image_url'
        ) THEN
          ALTER TABLE users ADD COLUMN image_url TEXT;
        END IF;
      END $$;
    `);

  // Passwords are optional when users authenticate by magic link.
  await pool.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'password_hash' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        END IF;
      END $$;
    `);

  // Add email verification timestamp if it doesn't exist.
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'email_verified_at'
        ) THEN
          ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
        END IF;
      END $$;
    `);

  // Mark seeded test accounts explicitly so production behavior does not rely on email heuristics.
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'is_test_account'
        ) THEN
          ALTER TABLE users ADD COLUMN is_test_account BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;
    `);

  await pool.query(`
      UPDATE users
      SET is_test_account = true
      WHERE email LIKE 'dev.%@geschenk.test'
         OR username LIKE 'dev\\_%' ESCAPE '\\'
    `);

  await pool.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'email_verified_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE users ALTER COLUMN email_verified_at TYPE TIMESTAMPTZ USING email_verified_at AT TIME ZONE 'UTC';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'created_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
        END IF;
      END $$;
    `);

  // Create magic links table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS magic_links (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        username VARCHAR(50),
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

  await pool.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'magic_links' AND column_name = 'expires_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE magic_links ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'magic_links' AND column_name = 'used_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE magic_links ALTER COLUMN used_at TYPE TIMESTAMPTZ USING used_at AT TIME ZONE 'UTC';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'magic_links' AND column_name = 'created_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE magic_links ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'password_reset_tokens' AND column_name = 'expires_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE password_reset_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'password_reset_tokens' AND column_name = 'used_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE password_reset_tokens ALTER COLUMN used_at TYPE TIMESTAMPTZ USING used_at AT TIME ZONE 'UTC';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'password_reset_tokens' AND column_name = 'created_at' AND data_type != 'timestamp with time zone'
        ) THEN
          ALTER TABLE password_reset_tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
        END IF;
      END $$;
    `);

  // Create groups table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

  // Add image_url column if it doesn't exist (for existing databases)
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'groups' AND column_name = 'image_url'
        ) THEN
          ALTER TABLE groups ADD COLUMN image_url TEXT;
        END IF;
      END $$;
    `);

  // Add invite_token column if it doesn't exist (for existing databases)
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'groups' AND column_name = 'invite_token'
        ) THEN
          ALTER TABLE groups ADD COLUMN invite_token VARCHAR(32) UNIQUE;
        END IF;
      END $$;
    `);

  // Create group_members table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, user_id)
      )
    `);

  // Create invitations table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, invitee_id)
      )
    `);

  // Create friendships table. A friendship is stored once with the smaller
  // user id in user_id and the larger user id in friend_id.
  await pool.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id),
        CHECK (user_id < friend_id)
      )
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMPTZ,
        UNIQUE(requester_id, addressee_id),
        CHECK (requester_id != addressee_id)
      )
    `);

  await pool.query('DROP TABLE IF EXISTS friend_invites');

  await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email_enabled BOOLEAN NOT NULL DEFAULT true,
        unsubscribe_token VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

  // Create assignments table for Secret Santa
  await pool.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        giver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, giver_id)
      )
    `);

  // Create gift_ideas table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS gift_ideas (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        for_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        idea TEXT NOT NULL,
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

  await pool.query('DROP TABLE IF EXISTS exclusions');

  // Add link column if it doesn't exist (for existing databases)
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'gift_ideas' AND column_name = 'link'
        ) THEN
          ALTER TABLE gift_ideas ADD COLUMN link TEXT;
        END IF;
      END $$;
    `);

  // Add status column to group_members if it doesn't exist (for soft leave functionality)
  await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'group_members' AND column_name = 'status'
        ) THEN
          ALTER TABLE group_members ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'left'));
        END IF;
      END $$;
    `);

  // Create indexes
  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_is_test_account ON users(is_test_account)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invitations_group_id ON invitations(group_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON invitations(invitee_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_id ON friend_requests(requester_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee_id ON friend_requests(addressee_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_preferences_unsubscribe_token ON notification_preferences(unsubscribe_token)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_group_id ON assignments(group_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_giver_id ON assignments(giver_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_receiver_id ON assignments(receiver_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gift_ideas_group_id ON gift_ideas(group_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gift_ideas_for_user_id ON gift_ideas(for_user_id)
    `);

  await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gift_ideas_created_by_id ON gift_ideas(created_by_id)
    `);

}

async function migrate() {
  try {
    await runMigrations();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
}
