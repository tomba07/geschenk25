import express, { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

function generateInviteToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function friendshipPair(userId: number, friendId: number): [number, number] {
  return userId < friendId ? [userId, friendId] : [friendId, userId];
}

// Public route: Get friend invite info from token.
router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;

    const result = await pool.query(
      `SELECT u.id, u.username, u.image_url
       FROM friend_invites fi
       JOIN users u ON u.id = fi.user_id
       WHERE fi.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    res.json({ user: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching friend invite:', error);
    res.status(500).json({ error: 'Failed to fetch invite' });
  }
});

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT u.id, u.username, u.image_url, f.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
       WHERE f.user_id = $1 OR f.friend_id = $1
       ORDER BY u.username ASC`,
      [userId]
    );

    res.json({ friends: result.rows });
  } catch (error: any) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

router.get('/invite-link', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const existing = await pool.query(
      'SELECT token FROM friend_invites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.json({ invite_token: existing.rows[0].token });
    }

    let attempts = 0;
    while (attempts < 5) {
      const token = generateInviteToken();
      try {
        await pool.query(
          'INSERT INTO friend_invites (user_id, token) VALUES ($1, $2)',
          [userId, token]
        );
        return res.json({ invite_token: token });
      } catch (error: any) {
        if (error.code === '23505') {
          attempts += 1;
          continue;
        }
        throw error;
      }
    }

    res.status(500).json({ error: 'Failed to generate invite link. Please try again.' });
  } catch (error: any) {
    console.error('Error getting friend invite link:', error);
    res.status(500).json({ error: 'Failed to get invite link' });
  }
});

router.post('/join/:token', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const token = req.params.token;

    const inviteResult = await pool.query(
      `SELECT fi.user_id, u.username
       FROM friend_invites fi
       JOIN users u ON u.id = fi.user_id
       WHERE fi.token = $1`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    const inviterId = inviteResult.rows[0].user_id;
    if (inviterId === userId) {
      return res.status(400).json({ error: 'This is your own friend link' });
    }

    const [firstId, secondId] = friendshipPair(userId, inviterId);
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, friend_id) DO NOTHING`,
      [firstId, secondId]
    );

    res.json({
      message: `You are now friends with @${inviteResult.rows[0].username}`,
      friend_id: inviterId,
    });
  } catch (error: any) {
    console.error('Error accepting friend invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const friendId = parseInt(req.params.id, 10);

    if (Number.isNaN(friendId)) {
      return res.status(400).json({ error: 'Invalid friend ID' });
    }

    const [firstId, secondId] = friendshipPair(userId, friendId);
    await pool.query(
      'DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2',
      [firstId, secondId]
    );

    res.json({ message: 'Friend removed' });
  } catch (error: any) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

export default router;
