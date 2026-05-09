import express, { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { SecretSantaMatcher } from '../utils/secretSantaMatcher';

const router = express.Router();

// Helper function to generate invite token
function generateInviteToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function groupHasAssignments(groupId: number): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM assignments WHERE group_id = $1 LIMIT 1', [groupId]);
  return result.rows.length > 0;
}

function assignmentLockError() {
  return 'Names have already been drawn for this group.';
}

// Public route: Get group info from invite token (no auth required)
router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;

    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.image_url,
              (1 + COALESCE((SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND (status IS NULL OR status = 'active')), 0)) as member_count,
              EXISTS(SELECT 1 FROM assignments WHERE group_id = g.id) as assignments_created
       FROM groups g
       WHERE g.invite_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    const group = result.rows[0];
    res.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        image_url: group.image_url,
        member_count: parseInt(group.member_count, 10),
        assignments_created: group.assignments_created,
      },
    });
  } catch (error: any) {
    console.error('Error fetching group from invite token:', error);
    res.status(500).json({ error: 'Failed to fetch group info' });
  }
});

// All routes below require authentication
router.use(authenticateToken);

// Join group via invite token
router.post('/join/:token', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const token = req.params.token;

    // Find group by invite token
    const groupResult = await pool.query(
      'SELECT id, name, created_by FROM groups WHERE invite_token = $1',
      [token]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    const group = groupResult.rows[0];
    const groupId = group.id;

    // Check if user is already an active member
    const memberCheck = await pool.query(
      'SELECT id, status FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberCheck.rows.length > 0) {
      const member = memberCheck.rows[0];
      if (member.status !== 'left') {
        return res.json({ message: 'You are already a member of this group', group_id: groupId });
      }

      if (await groupHasAssignments(groupId)) {
        return res.status(400).json({ error: assignmentLockError() });
      }

      // If user has left, reactivate them
      await pool.query(
        "UPDATE group_members SET status = 'active' WHERE id = $1",
        [member.id]
      );
      return res.json({ message: 'Successfully rejoined group', group_id: groupId });
    }

    // Check if user is the owner
    if (group.created_by === userId) {
      return res.json({ message: 'You are the owner of this group', group_id: groupId });
    }

    if (await groupHasAssignments(groupId)) {
      return res.status(400).json({ error: assignmentLockError() });
    }

    // Add user to group (or reactivate if they were left)
    await pool.query(
      "INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active'",
      [groupId, userId]
    );

    res.json({ message: 'Successfully joined group', group_id: groupId });
  } catch (error: any) {
    console.error('Error joining group via invite token:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Get user's groups (both created and joined)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT DISTINCT g.id, g.name, g.description, g.image_url, g.created_at, g.created_by,
              (1 + COALESCE((SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND (status IS NULL OR status = 'active')), 0)) as member_count
       FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND (gm.status IS NULL OR gm.status = 'active')
       WHERE (g.created_by = $1 OR (gm.user_id = $1 AND (gm.status IS NULL OR gm.status = 'active')))
       ORDER BY g.created_at DESC`,
      [userId]
    );

    // Convert member_count from string to number (PostgreSQL returns it as string)
    const groups = result.rows.map((row: any) => ({
      ...row,
      member_count: parseInt(row.member_count, 10),
    }));

    res.json({ groups });
  } catch (error: any) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get single group (with members)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    // Check if user has access to this group (owner or active member, not left)
    const accessCheck = await pool.query(
      `SELECT g.id, g.name, g.description, g.image_url, g.created_at, g.created_by
       FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2 AND (gm.status IS NULL OR gm.status = 'active')
       WHERE g.id = $1 AND (g.created_by = $2 OR gm.user_id = $2)`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = accessCheck.rows[0];

    // Get owner info
    const ownerResult = await pool.query(
      'SELECT id, username, image_url FROM users WHERE id = $1',
      [group.created_by]
    );

    // Get active members only (excluding owner and left members)
    const membersResult = await pool.query(
      `SELECT u.id, u.username, u.image_url, gm.joined_at
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1 AND (gm.status IS NULL OR gm.status = 'active')
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    // Combine owner and members, with owner first
    const owner = ownerResult.rows[0];
    const ownerMember = {
      id: owner.id,
      username: owner.username,
      image_url: owner.image_url,
      joined_at: group.created_at, // Use group creation date as joined_at for owner
    };

    const allMembers = [
      ownerMember,
      ...membersResult.rows.map((m: any) => ({
        id: m.id,
        username: m.username,
        image_url: m.image_url,
        joined_at: m.joined_at,
      })),
    ];

    res.json({
      group: {
        ...group,
        members: allMembers,
        owner: {
          id: owner.id,
          username: owner.username,
          image_url: owner.image_url,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Create group
router.post('/', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const { name, image_url, member_ids = [] } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (!Array.isArray(member_ids)) {
      return res.status(400).json({ error: 'Members must be an array' });
    }

    const memberIds = [...new Set(member_ids.map((id: any) => Number(id)))]
      .filter((id) => Number.isInteger(id) && id > 0 && id !== userId);

    if (memberIds.length > 0) {
      const friendCheck = await client.query(
        `SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END as friend_id
         FROM friendships
         WHERE (user_id = $1 AND friend_id = ANY($2::int[]))
            OR (friend_id = $1 AND user_id = ANY($2::int[]))`,
        [userId, memberIds]
      );
      const friendIds = new Set(friendCheck.rows.map((row: any) => row.friend_id));
      const hasNonFriend = memberIds.some((id) => !friendIds.has(id));

      if (hasNonFriend) {
        return res.status(403).json({ error: 'Groups can only be created with friends' });
      }
    }

    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO groups (name, description, image_url, created_by) VALUES ($1, $2, $3, $4) RETURNING id, name, description, image_url, created_at, created_by',
      [name.trim(), null, image_url || null, userId]
    );

    const group = result.rows[0];
    for (const memberId of memberIds) {
      await client.query(
        "INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active'",
        [group.id, memberId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ group: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
});

// Update group
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);
    const { image_url } = req.body;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Check if group exists and user is the owner
    const groupCheck = await pool.query(
      'SELECT id, created_by FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groupCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Only the group owner can update the group' });
    }

    // Update group image
    const result = await pool.query(
      'UPDATE groups SET image_url = $1 WHERE id = $2 RETURNING id, name, description, image_url, created_at, created_by',
      [image_url || null, groupId]
    );

    res.json({ group: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Get or generate invite link for a group (owner only)
router.get('/:id/invite-link', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Check if group exists and user is the owner
    const groupCheck = await pool.query(
      'SELECT id, created_by, invite_token FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groupCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Only the group owner can access the invite link' });
    }

    let inviteToken = groupCheck.rows[0].invite_token;

    // Generate token if it doesn't exist
    if (!inviteToken) {
      let tokenGenerated = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!tokenGenerated && attempts < maxAttempts) {
        inviteToken = generateInviteToken();
        try {
          await pool.query(
            'UPDATE groups SET invite_token = $1 WHERE id = $2',
            [inviteToken, groupId]
          );
          tokenGenerated = true;
        } catch (error: any) {
          // Token collision, try again
          if (error.code === '23505') { // Unique violation
            attempts++;
            continue;
          }
          throw error;
        }
      }

      if (!tokenGenerated) {
        return res.status(500).json({ error: 'Failed to generate invite link. Please try again.' });
      }
    }

    res.json({ invite_token: inviteToken });
  } catch (error: any) {
    console.error('Error getting invite link:', error);
    res.status(500).json({ error: 'Failed to get invite link' });
  }
});

// Delete group
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    const result = await pool.query(
      'DELETE FROM groups WHERE id = $1 AND created_by = $2 RETURNING id',
      [groupId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ message: 'Group deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Invite user to group
router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);
    const { user_id, username } = req.body;

    if (!user_id && !username) {
      return res.status(400).json({ error: 'Friend is required' });
    }

    // Check if user is owner or active member of the group
    const groupCheck = await pool.query(
      `SELECT g.id, g.created_by FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2 AND (gm.status IS NULL OR gm.status = 'active')
       WHERE g.id = $1 AND (g.created_by = $2 OR gm.user_id = $2)`,
      [groupId, userId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (await groupHasAssignments(groupId)) {
      return res.status(400).json({ error: assignmentLockError() });
    }

    const inviteeResult = user_id
      ? await pool.query('SELECT id, username FROM users WHERE id = $1', [Number(user_id)])
      : await pool.query('SELECT id, username FROM users WHERE username = $1', [username.toLowerCase().trim()]);

    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const inviteeId = inviteeResult.rows[0].id;

    if (inviteeId === userId) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    const firstId = Math.min(userId, inviteeId);
    const secondId = Math.max(userId, inviteeId);
    const friendshipCheck = await pool.query(
      'SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2',
      [firstId, secondId]
    );

    if (friendshipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You can only add friends to a group' });
    }

    // Check if user is already an active member
    const memberCheck = await pool.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND (status IS NULL OR status = \'active\')',
      [groupId, inviteeId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    await pool.query(
      "INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, 'active') ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active'",
      [groupId, inviteeId]
    );

    res.json({ message: 'Friend added to group successfully' });
  } catch (error: any) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Leave group (member can leave, but owner cannot)
router.post('/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    // Check if group exists and get owner
    const groupCheck = await pool.query(
      'SELECT created_by FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const ownerId = groupCheck.rows[0].created_by;

    // Owner cannot leave the group (they must delete it instead)
    if (userId === ownerId) {
      return res.status(400).json({ error: 'Group owner cannot leave the group. Please delete the group instead.' });
    }

    // Check if user is a member
    const memberCheck = await pool.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(400).json({ error: 'You are not a member of this group' });
    }

    if (await groupHasAssignments(groupId)) {
      return res.status(400).json({ error: assignmentLockError() });
    }

    // Mark user as left (soft delete) - keeps them in the group for assignment integrity
    await pool.query(
      "UPDATE group_members SET status = 'left' WHERE group_id = $1 AND user_id = $2",
      [groupId, userId]
    );

    res.json({ message: 'Left group successfully' });
  } catch (error: any) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Remove member from group (owner only)
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);
    const memberId = parseInt(req.params.userId);

    // Check if user is owner
    const groupCheck = await pool.query(
      'SELECT created_by FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groupCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Only group owner can remove members' });
    }

    if (memberId === userId) {
      return res.status(400).json({ error: 'Cannot remove yourself from the group' });
    }

    if (await groupHasAssignments(groupId)) {
      return res.status(400).json({ error: assignmentLockError() });
    }

    await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, memberId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Assign Secret Santa pairs (owner only)
router.post('/:id/assign', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    // Check if user is owner
    const groupCheck = await pool.query(
      'SELECT created_by FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groupCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Only group owner can trigger assignments' });
    }

    if (await groupHasAssignments(groupId)) {
      return res.status(400).json({ error: 'Names have already been drawn. Reset the draw before drawing again.' });
    }

    // Get all active members (including owner, excluding left members)
    const membersResult = await pool.query(
      `SELECT DISTINCT u.id, u.username
       FROM users u
       WHERE (u.id = $1 AND u.id IN (SELECT created_by FROM groups WHERE id = $2))
          OR u.id IN (SELECT user_id FROM group_members WHERE group_id = $2 AND (status IS NULL OR status = 'active'))
       ORDER BY u.id`,
      [userId, groupId]
    );

    const members = membersResult.rows;

    if (members.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 members to create assignments' });
    }

    const memberIds = new Set(members.map((member: any) => member.id));
    const exclusions = Array.isArray(req.body?.exclusions) ? req.body.exclusions : [];
    const exclusionSet = new Set<string>();

    for (const exclusion of exclusions) {
      const firstUserId = Number(exclusion.first_user_id);
      const secondUserId = Number(exclusion.second_user_id);

      if (
        !Number.isInteger(firstUserId) ||
        !Number.isInteger(secondUserId) ||
        firstUserId === secondUserId ||
        !memberIds.has(firstUserId) ||
        !memberIds.has(secondUserId)
      ) {
        return res.status(400).json({ error: 'Invalid exclusion pair' });
      }

      exclusionSet.add(`${firstUserId}-${secondUserId}`);
      exclusionSet.add(`${secondUserId}-${firstUserId}`);
    }

    // Use bipartite matching algorithm with exclusions
    const giverIds = members.map((m: any) => m.id);
    const receiverIds = [...giverIds]; // Same set for Secret Santa

    const matcher = new SecretSantaMatcher(giverIds, receiverIds);

    // Add all valid pairings (exclude self and excluded users)
    for (let i = 0; i < giverIds.length; i++) {
      const giverId = giverIds[i];
      for (let j = 0; j < receiverIds.length; j++) {
        const receiverId = receiverIds[j];
        // Skip self-assignment
        if (giverId === receiverId) {
          continue;
        }
        // Skip exclusions
        if (exclusionSet.has(`${giverId}-${receiverId}`)) {
          continue;
        }
        // Add valid pairing
        matcher.addSecretSantaPairing(i, j);
      }
    }

    // Generate pairs
    const pairs = matcher.generateSecretSantaPairs();

    // Check if we got a complete matching
    if (pairs.size < members.length) {
      return res.status(500).json({
        error: 'Failed to create valid assignments with current exclusions. Some members may have too many exclusions. Please try again or adjust exclusions.',
      });
    }

    // Delete existing assignments for this group
    await pool.query('DELETE FROM assignments WHERE group_id = $1', [groupId]);

    // Create new assignments
    for (const [giverId, receiverId] of pairs.entries()) {
      await pool.query(
        'INSERT INTO assignments (group_id, giver_id, receiver_id) VALUES ($1, $2, $3)',
        [groupId, giverId, receiverId]
      );
    }

    res.json({ message: 'Assignments created successfully' });
  } catch (error: any) {
    console.error('Error creating assignments:', error);
    res.status(500).json({ error: 'Failed to create assignments' });
  }
});

// Get current user's assignment for a group
router.get('/:id/assignment', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    // Check if user has access to this group (owner or active member)
    const accessCheck = await pool.query(
      `SELECT g.id FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2 AND (gm.status IS NULL OR gm.status = 'active')
       WHERE g.id = $1 AND (g.created_by = $2 OR gm.user_id = $2)`,
      [groupId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get user's assignment
    const assignmentResult = await pool.query(
      `SELECT a.receiver_id, a.created_at, u.username as receiver_username, u.image_url as receiver_image_url
       FROM assignments a
       JOIN users u ON a.receiver_id = u.id
       WHERE a.group_id = $1 AND a.giver_id = $2`,
      [groupId, userId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.json({ assignment: null });
    }

    const row = assignmentResult.rows[0];
    res.json({
      assignment: {
        receiver_id: row.receiver_id,
        receiver_username: row.receiver_username,
        receiver_image_url: row.receiver_image_url,
        created_at: row.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// Get all assignments for a group (owner only, for verification)
router.get('/:id/assignments', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    // Check if user is owner
    const groupCheck = await pool.query(
      'SELECT created_by FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groupCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Only group owner can view all assignments' });
    }

    // Get all assignments
    const assignmentsResult = await pool.query(
      `SELECT a.giver_id, a.receiver_id,
              giver.username as giver_username,
              receiver.username as receiver_username
       FROM assignments a
       JOIN users giver ON a.giver_id = giver.id
       JOIN users receiver ON a.receiver_id = receiver.id
       WHERE a.group_id = $1
       ORDER BY giver.username`,
      [groupId]
    );

    const assignments = assignmentsResult.rows.map((row: any) => ({
      giver_id: row.giver_id,
      receiver_id: row.receiver_id,
      giver_username: row.giver_username,
      receiver_username: row.receiver_username,
    }));

    res.json({ assignments });
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Delete all assignments for a group (owner only)
router.delete('/:id/assignments', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Check if user is owner
    const groupCheck = await pool.query(
      'SELECT created_by FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groupCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Only group owner can delete assignments' });
    }

    // Delete all assignments for this group
    await pool.query('DELETE FROM assignments WHERE group_id = $1', [groupId]);

    res.json({ message: 'Assignments deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting assignments:', error);
    res.status(500).json({ error: 'Failed to delete assignments' });
  }
});

// Create gift idea
router.post('/:id/gift-ideas', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);
    const { for_user_id, idea, link } = req.body;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    if (!for_user_id || !idea || idea.trim().length === 0) {
      return res.status(400).json({ error: 'for_user_id and idea are required' });
    }

    // Check if user has access to this group (owner or active member)
    const groupCheck = await pool.query(
      `SELECT g.id FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2 AND (gm.status IS NULL OR gm.status = 'active')
       WHERE g.id = $1 AND (g.created_by = $2 OR gm.user_id = $2)`,
      [groupId, userId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if for_user_id is an active member of the group (owner or active member)
    const memberCheck = await pool.query(
      `SELECT 1 FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2 AND (gm.status IS NULL OR gm.status = 'active')
       WHERE g.id = $1 AND (g.created_by = $2 OR gm.user_id = $2)`,
      [groupId, for_user_id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Target user is not a member of this group' });
    }

    // Create gift idea
    const result = await pool.query(
      `INSERT INTO gift_ideas (group_id, for_user_id, created_by_id, idea, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, group_id, for_user_id, created_by_id, idea, link, created_at, updated_at`,
      [groupId, for_user_id, userId, idea.trim(), link?.trim() || null]
    );

    // Get creator and target user info
    const creatorResult = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );
    const targetResult = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [for_user_id]
    );

    const giftIdea = result.rows[0];
    const creator = creatorResult.rows[0];
    const target = targetResult.rows[0];

    res.status(201).json({
      gift_idea: {
        ...giftIdea,
        created_by: {
          id: creator.id,
          username: creator.username,
        },
        for_user: {
          id: target.id,
          username: target.username,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating gift idea:', error);
    res.status(500).json({ error: 'Failed to create gift idea' });
  }
});

// Get gift ideas for a group
router.get('/:id/gift-ideas', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);
    const forUserId = req.query.for_user_id ? parseInt(req.query.for_user_id as string) : null;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Check if user has access to this group (owner or active member)
    const groupCheck = await pool.query(
      `SELECT g.id FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2 AND (gm.status IS NULL OR gm.status = 'active')
       WHERE g.id = $1 AND (g.created_by = $2 OR gm.user_id = $2)`,
      [groupId, userId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get user's assignment to see who they're assigned to
    const assignmentResult = await pool.query(
      'SELECT receiver_id FROM assignments WHERE group_id = $1 AND giver_id = $2',
      [groupId, userId]
    );
    const assignedToUserId = assignmentResult.rows.length > 0 ? assignmentResult.rows[0].receiver_id : null;

    // Build query - show gift ideas based on context
    let query = `
      SELECT gi.id, gi.group_id, gi.for_user_id, gi.created_by_id, gi.idea, gi.link, gi.created_at, gi.updated_at,
             creator.username as creator_username,
             target.username as target_username
      FROM gift_ideas gi
      JOIN users creator ON gi.created_by_id = creator.id
      JOIN users target ON gi.for_user_id = target.id
      WHERE gi.group_id = $1
    `;
    const queryParams: any[] = [groupId];

    // Filter logic:
    // 1. If for_user_id is specified, show ideas for that user
    // 2. Otherwise, if user has assignment, show ideas for assigned person
    // 3. Also always show ideas created by the current user
    if (forUserId) {
      query += ' AND gi.for_user_id = $2';
      queryParams.push(forUserId);
    } else if (assignedToUserId) {
      // Show ideas for assigned person OR ideas created by current user
      query += ' AND (gi.for_user_id = $2 OR gi.created_by_id = $3)';
      queryParams.push(assignedToUserId, userId);
    } else {
      // No assignment, show ideas created by current user or for current user
      query += ' AND (gi.created_by_id = $2 OR gi.for_user_id = $2)';
      queryParams.push(userId);
    }

    query += ' ORDER BY gi.created_at DESC';

    const result = await pool.query(query, queryParams);

    // Map results
    const giftIdeas = result.rows.map((row: any) => ({
      id: row.id,
      group_id: row.group_id,
      for_user_id: row.for_user_id,
      created_by_id: row.created_by_id,
      idea: row.idea,
      link: row.link,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: {
        id: row.created_by_id,
        username: row.creator_username,
      },
      for_user: {
        id: row.for_user_id,
        username: row.target_username,
      },
    }));

    res.json({ gift_ideas: giftIdeas });
  } catch (error: any) {
    console.error('Error fetching gift ideas:', error);
    res.status(500).json({ error: 'Failed to fetch gift ideas' });
  }
});

// Update gift idea
router.put('/:id/gift-ideas/:ideaId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);
    const ideaId = parseInt(req.params.ideaId);
    const { idea, link } = req.body;

    if (isNaN(groupId) || isNaN(ideaId)) {
      return res.status(400).json({ error: 'Invalid group ID or idea ID' });
    }

    if (!idea || idea.trim().length === 0) {
      return res.status(400).json({ error: 'Idea is required' });
    }

    // Check if gift idea exists and user is the creator
    const ideaCheck = await pool.query(
      'SELECT id, created_by_id FROM gift_ideas WHERE id = $1 AND group_id = $2',
      [ideaId, groupId]
    );

    if (ideaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Gift idea not found' });
    }

    if (ideaCheck.rows[0].created_by_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can update this gift idea' });
    }

    // Update gift idea
    const result = await pool.query(
      `UPDATE gift_ideas 
       SET idea = $1, link = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, group_id, for_user_id, created_by_id, idea, link, created_at, updated_at`,
      [idea.trim(), link?.trim() || null, ideaId]
    );

    // Get creator and target user info
    const creatorResult = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );
    const targetResult = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [result.rows[0].for_user_id]
    );

    const giftIdea = result.rows[0];
    const creator = creatorResult.rows[0];
    const target = targetResult.rows[0];

    res.json({
      gift_idea: {
        ...giftIdea,
        created_by: {
          id: creator.id,
          username: creator.username,
        },
        for_user: {
          id: target.id,
          username: target.username,
        },
      },
    });
  } catch (error: any) {
    console.error('Error updating gift idea:', error);
    res.status(500).json({ error: 'Failed to update gift idea' });
  }
});

// Delete gift idea
router.delete('/:id/gift-ideas/:ideaId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groupId = parseInt(req.params.id);
    const ideaId = parseInt(req.params.ideaId);

    if (isNaN(groupId) || isNaN(ideaId)) {
      return res.status(400).json({ error: 'Invalid group ID or idea ID' });
    }

    // Check if gift idea exists and user is the creator
    const ideaCheck = await pool.query(
      'SELECT id, created_by_id FROM gift_ideas WHERE id = $1 AND group_id = $2',
      [ideaId, groupId]
    );

    if (ideaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Gift idea not found' });
    }

    if (ideaCheck.rows[0].created_by_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can delete this gift idea' });
    }

    // Delete gift idea
    await pool.query('DELETE FROM gift_ideas WHERE id = $1', [ideaId]);

    res.json({ message: 'Gift idea deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting gift idea:', error);
    res.status(500).json({ error: 'Failed to delete gift idea' });
  }
});

export default router;
