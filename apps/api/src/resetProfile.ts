import pool from './db';

async function resetProfile() {
  const email = process.argv[2]?.trim().toLowerCase() || process.env.EMAIL?.trim().toLowerCase();

  if (!email) {
    console.error('Usage: npm run reset-profile:api -- email@example.com');
    process.exit(1);
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET username = NULL,
           password_hash = NULL,
           image_url = NULL
       WHERE lower(email) = $1
       RETURNING id, email`,
      [email]
    );

    if (result.rows.length === 0) {
      console.error(`No user found for ${email}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Reset profile for ${result.rows[0].email} (user id ${result.rows[0].id})`);
  } catch (error) {
    console.error('Failed to reset profile:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

resetProfile();
