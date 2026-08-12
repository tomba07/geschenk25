import express, { NextFunction, Response } from 'express';
import pool from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { SecretSantaMatcher } from '../utils/secretSantaMatcher';
import {
  DEV_TEST_ACCOUNTS,
  devToolsEnabled,
  ensureDevTestAccounts,
  getDevTestPassword,
} from '../utils/devTestAccounts';

const router = express.Router();
const RANDOM_GIFT_IDEAS = [
  'Cozy wool socks',
  'Insulated travel mug',
  'Board game night pick',
  'Local coffee beans',
  'Nice notebook',
  'Desk plant',
  'Puzzle book',
  'Favorite candy sampler',
  'Reusable tote bag',
  'Scented candle',
  'Bookstore gift card',
  'Movie night snacks',
  'Kitchen gadget',
  'Warm beanie',
  'Tea variety box',
  'Phone stand',
  'Art print',
  'Cookie mix kit',
  'Mini Bluetooth tracker',
  'Craft chocolate bar',
];

function requireDevTools(_req: AuthRequest, res: Response, next: NextFunction) {
  if (!devToolsEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  next();
}

async function getGroupMembers(groupId: number) {
  const result = await pool.query(
    `SELECT u.id, u.username, u.email, u.image_url, g.created_at as joined_at, 'owner' as role
     FROM groups g
     JOIN users u ON u.id = g.created_by
     WHERE g.id = $1
     UNION ALL
     SELECT u.id, u.username, u.email, u.image_url, gm.joined_at, 'member' as role
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND (gm.status IS NULL OR gm.status = 'active')
     ORDER BY role DESC, joined_at ASC`,
    [groupId]
  );

  return result.rows;
}

async function getDevState() {
  const [usersResult, groupsResult] = await Promise.all([
    pool.query(
      `SELECT id, email, username, image_url, created_at
       FROM users
       WHERE username IS NOT NULL
       ORDER BY username ASC`
    ),
    pool.query(
      `SELECT g.id, g.name, g.description, g.image_url, g.created_at, g.created_by,
              owner.username as owner_username,
              COUNT(gm.user_id) FILTER (WHERE gm.status IS NULL OR gm.status = 'active') + 1 as member_count
       FROM groups g
       JOIN users owner ON owner.id = g.created_by
       LEFT JOIN group_members gm ON gm.group_id = g.id
       GROUP BY g.id, owner.username
       ORDER BY g.created_at DESC`
    ),
  ]);

  const groups = await Promise.all(groupsResult.rows.map(async (group: any) => {
    const [members, assignmentsResult, giftIdeasResult] = await Promise.all([
      getGroupMembers(group.id),
      pool.query(
        `SELECT a.giver_id, a.receiver_id,
                giver.username as giver_username,
                receiver.username as receiver_username
         FROM assignments a
         JOIN users giver ON giver.id = a.giver_id
         JOIN users receiver ON receiver.id = a.receiver_id
         WHERE a.group_id = $1
         ORDER BY giver.username ASC`,
        [group.id]
      ),
      pool.query(
        `SELECT gi.id, gi.group_id, gi.for_user_id, gi.created_by_id, gi.idea, gi.link, gi.created_at, gi.updated_at,
                creator.username as created_by_username,
                target.username as for_user_username
         FROM gift_ideas gi
         JOIN users creator ON creator.id = gi.created_by_id
         JOIN users target ON target.id = gi.for_user_id
         WHERE gi.group_id = $1
         ORDER BY gi.created_at DESC`,
        [group.id]
      ),
    ]);

    return {
      ...group,
      member_count: Number(group.member_count),
      members,
      assignments: assignmentsResult.rows,
      gift_ideas: giftIdeasResult.rows,
    };
  }));

  return {
    users: usersResult.rows,
    groups,
    test_accounts: DEV_TEST_ACCOUNTS.map((account) => ({ ...account, password: getDevTestPassword() })),
  };
}

async function userIsInGroup(groupId: number, userId: number) {
  const result = await pool.query(
    `SELECT 1
     FROM groups g
     LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2 AND (gm.status IS NULL OR gm.status = 'active')
     WHERE g.id = $1 AND (g.created_by = $2 OR gm.user_id = $2)`,
    [groupId, userId]
  );
  return result.rows.length > 0;
}

router.use(requireDevTools);
router.use(authenticateToken);

router.get('/state', async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await getDevState());
  } catch (error: any) {
    console.error('Error loading dev state:', error);
    res.status(500).json({ error: 'Failed to load dev state' });
  }
});

router.post('/test-accounts', async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await ensureDevTestAccounts(req.userId!);
    res.status(201).json({
      accounts,
      state: await getDevState(),
    });
  } catch (error: any) {
    console.error('Error creating dev test accounts:', error);
    res.status(500).json({ error: 'Failed to create test accounts' });
  }
});

router.post('/groups', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { name, owner_id, member_ids = [] } = req.body;
    const ownerId = Number(owner_id || req.userId);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const ownerResult = await client.query('SELECT id FROM users WHERE id = $1', [ownerId]);
    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    const memberIds = Array.isArray(member_ids)
      ? [...new Set(member_ids.map((id: any) => Number(id)))]
        .filter((id) => Number.isInteger(id) && id > 0 && id !== ownerId)
      : [];

    await client.query('BEGIN');
    const groupResult = await client.query(
      'INSERT INTO groups (name, description, image_url, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [name.trim(), null, null, ownerId]
    );
    const groupId = groupResult.rows[0].id;

    for (const memberId of memberIds) {
      await client.query(
        "INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active'",
        [groupId, memberId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ group_id: groupId, state: await getDevState() });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating dev group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
});

router.post('/groups/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = Number(req.body.user_id);

    if (isNaN(groupId) || !Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Group and user are required' });
    }

    if (await userIsInGroup(groupId, userId)) {
      return res.json({ message: 'User already in group', state: await getDevState() });
    }

    await pool.query(
      "INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active'",
      [groupId, userId]
    );

    res.json({ message: 'Member added', state: await getDevState() });
  } catch (error: any) {
    console.error('Error adding dev group member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/groups/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const memberId = parseInt(req.params.userId);

    const groupResult = await pool.query('SELECT created_by FROM groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    if (groupResult.rows[0].created_by === memberId) {
      return res.status(400).json({ error: 'Owner cannot be removed as a member' });
    }

    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, memberId]);
    await pool.query('DELETE FROM assignments WHERE group_id = $1 AND (giver_id = $2 OR receiver_id = $2)', [groupId, memberId]);
    await pool.query('DELETE FROM gift_ideas WHERE group_id = $1 AND (for_user_id = $2 OR created_by_id = $2)', [groupId, memberId]);

    res.json({ message: 'Member removed', state: await getDevState() });
  } catch (error: any) {
    console.error('Error removing dev group member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.post('/groups/:id/gift-ideas', async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const forUserId = Number(req.body.for_user_id);
    const createdById = Number(req.body.created_by_id || req.userId);
    const idea = typeof req.body.idea === 'string' ? req.body.idea.trim() : '';
    const link = typeof req.body.link === 'string' ? req.body.link.trim() : '';

    if (isNaN(groupId) || !Number.isInteger(forUserId) || !Number.isInteger(createdById) || !idea) {
      return res.status(400).json({ error: 'For, creator, and idea are required' });
    }

    if (!(await userIsInGroup(groupId, forUserId)) || !(await userIsInGroup(groupId, createdById))) {
      return res.status(400).json({ error: 'Gift idea users must be group members' });
    }

    await pool.query(
      `INSERT INTO gift_ideas (group_id, for_user_id, created_by_id, idea, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [groupId, forUserId, createdById, idea, link || null]
    );

    res.status(201).json({ message: 'Gift idea added', state: await getDevState() });
  } catch (error: any) {
    console.error('Error adding dev gift idea:', error);
    res.status(500).json({ error: 'Failed to add gift idea' });
  }
});

router.post('/groups/:id/gift-ideas/random', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const groupId = parseInt(req.params.id);
    const members = await getGroupMembers(groupId);

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    if (members.length === 0) {
      return res.status(400).json({ error: 'Group has no members' });
    }

    await client.query('BEGIN');
    let createdCount = 0;

    for (const member of members) {
      const shuffledIdeas = [...RANDOM_GIFT_IDEAS].sort(() => Math.random() - 0.5);
      const ideaCount = 2 + Math.floor(Math.random() * 2);
      const creators = members.filter((creator: any) => creator.id !== member.id);

      for (let index = 0; index < ideaCount; index += 1) {
        const creator = creators[index % creators.length] || member;
        await client.query(
          `INSERT INTO gift_ideas (group_id, for_user_id, created_by_id, idea, link)
           VALUES ($1, $2, $3, $4, NULL)`,
          [groupId, member.id, creator.id, shuffledIdeas[index]]
        );
        createdCount += 1;
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: `${createdCount} gift ideas added`, state: await getDevState() });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error adding random dev gift ideas:', error);
    res.status(500).json({ error: 'Failed to add random gift ideas' });
  } finally {
    client.release();
  }
});

router.delete('/groups/:id/gift-ideas/:ideaId', async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const ideaId = parseInt(req.params.ideaId);
    await pool.query('DELETE FROM gift_ideas WHERE group_id = $1 AND id = $2', [groupId, ideaId]);
    res.json({ message: 'Gift idea removed', state: await getDevState() });
  } catch (error: any) {
    console.error('Error removing dev gift idea:', error);
    res.status(500).json({ error: 'Failed to remove gift idea' });
  }
});

router.post('/groups/:id/assign', async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const members = await getGroupMembers(groupId);

    if (members.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 members to create assignments' });
    }

    const giverIds = members.map((member: any) => member.id);
    const receiverIds = [...giverIds];
    const matcher = new SecretSantaMatcher(giverIds, receiverIds);

    for (let i = 0; i < giverIds.length; i += 1) {
      for (let j = 0; j < receiverIds.length; j += 1) {
        if (giverIds[i] !== receiverIds[j]) {
          matcher.addSecretSantaPairing(i, j);
        }
      }
    }

    const pairs = matcher.generateSecretSantaPairs();
    if (pairs.size < members.length) {
      return res.status(500).json({ error: 'Failed to create assignments' });
    }

    await pool.query('DELETE FROM assignments WHERE group_id = $1', [groupId]);
    for (const [giverId, receiverId] of pairs.entries()) {
      await pool.query(
        'INSERT INTO assignments (group_id, giver_id, receiver_id) VALUES ($1, $2, $3)',
        [groupId, giverId, receiverId]
      );
    }

    res.json({ message: 'Assignments created', state: await getDevState() });
  } catch (error: any) {
    console.error('Error creating dev assignments:', error);
    res.status(500).json({ error: 'Failed to create assignments' });
  }
});

router.delete('/groups/:id/assignments', async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    await pool.query('DELETE FROM assignments WHERE group_id = $1', [groupId]);
    res.json({ message: 'Assignments removed', state: await getDevState() });
  } catch (error: any) {
    console.error('Error removing dev assignments:', error);
    res.status(500).json({ error: 'Failed to remove assignments' });
  }
});

export default router;
