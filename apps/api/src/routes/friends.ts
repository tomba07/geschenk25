import express, { Request, Response } from 'express';
import pool from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendNotificationToUser } from '../utils/notifications';

const router = express.Router();

function friendshipPair(userId: number, friendId: number): [number, number] {
  return userId < friendId ? [userId, friendId] : [friendId, userId];
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function findUserByUsername(username: string) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return null;

  const result = await pool.query(
    'SELECT id, username, image_url FROM users WHERE LOWER(username) = $1 AND is_test_account = false',
    [normalizedUsername]
  );

  return result.rows[0] || null;
}

async function createFriendship(userId: number, friendId: number) {
  const [firstId, secondId] = friendshipPair(userId, friendId);
  await pool.query(
    `INSERT INTO friendships (user_id, friend_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, friend_id) DO NOTHING`,
    [firstId, secondId]
  );
}

// Public route: Get friend invite info from username.
router.get('/user/:username', async (req: Request, res: Response) => {
  try {
    const user = await findUserByUsername(req.params.username);

    if (!user) {
      return res.status(404).json({ error: 'Invalid friend link' });
    }

    res.json({ user });
  } catch (error: any) {
    console.error('Error fetching friend link user:', error);
    res.status(500).json({ error: 'Failed to fetch friend link' });
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

router.get('/requests', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const incoming = await pool.query(
      `SELECT fr.id, fr.created_at, u.id as user_id, u.username, u.image_url
       FROM friend_requests fr
       JOIN users u ON u.id = fr.requester_id
       WHERE fr.addressee_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    const outgoing = await pool.query(
      `SELECT fr.id, fr.created_at, u.id as user_id, u.username, u.image_url
       FROM friend_requests fr
       JOIN users u ON u.id = fr.addressee_id
       WHERE fr.requester_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    res.json({ incoming: incoming.rows, outgoing: outgoing.rows });
  } catch (error: any) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    if (!query) {
      return res.json({ users: [] });
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.image_url,
              CASE
                WHEN f.id IS NOT NULL THEN 'friend'
                WHEN outgoing.id IS NOT NULL THEN 'outgoing_pending'
                WHEN incoming.id IS NOT NULL THEN 'incoming_pending'
                ELSE 'none'
              END as friendship_status
       FROM users u
       LEFT JOIN friendships f
         ON (f.user_id = LEAST($1, u.id) AND f.friend_id = GREATEST($1, u.id))
       LEFT JOIN friend_requests outgoing
         ON outgoing.requester_id = $1 AND outgoing.addressee_id = u.id AND outgoing.status = 'pending'
       LEFT JOIN friend_requests incoming
         ON incoming.requester_id = u.id AND incoming.addressee_id = $1 AND incoming.status = 'pending'
       WHERE u.id != $1
         AND u.username IS NOT NULL
         AND u.is_test_account = false
         AND LOWER(u.username) LIKE $2
       ORDER BY u.username
       LIMIT 20`,
      [userId, `%${query}%`]
    );

    res.json({ users: result.rows });
  } catch (error: any) {
    console.error('Error searching friends:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.post('/requests', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetUserId = Number(req.body.user_id);

    if (!Number.isInteger(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    const targetResult = await pool.query('SELECT id, username FROM users WHERE id = $1 AND username IS NOT NULL AND is_test_account = false', [targetUserId]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [firstId, secondId] = friendshipPair(userId, targetUserId);
    const friendshipResult = await pool.query(
      'SELECT id FROM friendships WHERE user_id = $1 AND friend_id = $2',
      [firstId, secondId]
    );

    if (friendshipResult.rows.length > 0) {
      return res.status(400).json({ error: 'You are already friends' });
    }

    const incomingResult = await pool.query(
      `SELECT id FROM friend_requests
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [targetUserId, userId]
    );

    if (incomingResult.rows.length > 0) {
      return res.status(409).json({ error: `@${targetResult.rows[0].username} already sent you a request` });
    }

    const requestUpsertResult = await pool.query(
      `INSERT INTO friend_requests (requester_id, addressee_id, status, created_at, responded_at)
       VALUES ($1, $2, 'pending', NOW(), NULL)
       ON CONFLICT (requester_id, addressee_id)
       DO UPDATE SET status = 'pending', created_at = NOW(), responded_at = NULL
       WHERE friend_requests.status != 'pending'
       RETURNING id`,
      [userId, targetUserId]
    );

    if (requestUpsertResult.rows.length > 0) {
      const requesterResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const requesterUsername = requesterResult.rows[0]?.username || 'Someone';
      sendNotificationToUser(targetUserId, {
        title: 'New friend request',
        body: `@${requesterUsername} wants to add you on Geschenk.`,
        url: `${process.env.APP_BASE_URL || ''}/friends`,
        emailSubject: `@${requesterUsername} sent you a friend request`,
        emailText: `@${requesterUsername} wants to add you on Geschenk. Open Geschenk to accept or decline the request.`,
        emailActionLabel: 'View friend request',
      }).catch((error) => console.error('Failed to send friend request notification:', error));
    }

    res.json({ message: `Friend request sent to @${targetResult.rows[0].username}` });
  } catch (error: any) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

router.post('/requests/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const requestId = Number(req.params.id);

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({ error: 'Invalid friend request' });
    }

    const requestResult = await pool.query(
      `SELECT fr.id, fr.requester_id, u.username
       FROM friend_requests fr
       JOIN users u ON u.id = fr.requester_id
       WHERE fr.id = $1 AND fr.addressee_id = $2 AND fr.status = 'pending'`,
      [requestId, userId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const requesterId = requestResult.rows[0].requester_id;
    await createFriendship(userId, requesterId);
    await pool.query(
      `UPDATE friend_requests
       SET status = 'accepted', responded_at = NOW()
       WHERE id = $1`,
      [requestId]
    );

    const accepterResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    const accepterUsername = accepterResult.rows[0]?.username || 'Someone';
    sendNotificationToUser(requesterId, {
      title: 'Friend request accepted',
      body: `@${accepterUsername} accepted your friend request.`,
      url: `${process.env.APP_BASE_URL || ''}/friends`,
      emailSubject: `@${accepterUsername} accepted your friend request`,
      emailText: `@${accepterUsername} accepted your friend request on Geschenk.`,
      emailActionLabel: 'View friends',
    }).catch((error) => console.error('Failed to send friend accepted notification:', error));

    res.json({ message: `You are now friends with @${requestResult.rows[0].username}` });
  } catch (error: any) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

router.post('/requests/:id/decline', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const requestId = Number(req.params.id);

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({ error: 'Invalid friend request' });
    }

    const result = await pool.query(
      `UPDATE friend_requests
       SET status = 'declined', responded_at = NOW()
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
       RETURNING id`,
      [requestId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request declined' });
  } catch (error: any) {
    console.error('Error declining friend request:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

router.post('/user/:username', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetUser = await findUserByUsername(req.params.username);

    if (!targetUser) {
      return res.status(404).json({ error: 'Invalid friend link' });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ error: 'This is your own friend link' });
    }

    const [firstId, secondId] = friendshipPair(userId, targetUser.id);
    const existingFriendship = await pool.query(
      'SELECT id FROM friendships WHERE user_id = $1 AND friend_id = $2',
      [firstId, secondId]
    );
    const alreadyFriends = existingFriendship.rows.length > 0;

    await createFriendship(userId, targetUser.id);

    if (!alreadyFriends) {
      const currentUserResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const currentUsername = currentUserResult.rows[0]?.username || 'Someone';
      sendNotificationToUser(targetUser.id, {
        title: 'New friend added',
        body: `@${currentUsername} added you as a friend on Geschenk.`,
        url: `${process.env.APP_BASE_URL || ''}/friends`,
        emailSubject: `@${currentUsername} added you as a friend`,
        emailText: `@${currentUsername} added you as a friend on Geschenk.`,
        emailActionLabel: 'View friends',
      }).catch((error) => console.error('Failed to send friend link notification:', error));
    }

    res.json({
      message: `You are now friends with @${targetUser.username}`,
      friend_id: targetUser.id,
    });
  } catch (error: any) {
    console.error('Error accepting friend link:', error);
    res.status(500).json({ error: 'Failed to accept friend link' });
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
