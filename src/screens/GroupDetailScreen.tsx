import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { groupService, GroupServiceError } from '../services/groupService';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { confirmDestructive } from '../utils/confirm';
import { Assignment, Exclusion, GiftIdea, Group } from '../types/group';

interface GroupDetailScreenProps {
  groupId: string;
  onBack: () => void;
}

interface SearchUser {
  id: number;
  username: string;
  display_name: string;
}

export default function GroupDetailScreen({ groupId, onBack }: GroupDetailScreenProps) {
  const { userId } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [giftIdeas, setGiftIdeas] = useState<GiftIdea[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [giftIdeaText, setGiftIdeaText] = useState('');
  const [giftIdeaLink, setGiftIdeaLink] = useState('');
  const [giftIdeaForUserId, setGiftIdeaForUserId] = useState<number | ''>('');
  const [exclusionGiverId, setExclusionGiverId] = useState<number | ''>('');
  const [exclusionReceiverId, setExclusionReceiverId] = useState<number | ''>('');

  const loadGroup = useCallback(async () => {
    setLoading(true);
    try {
      const groupData = await groupService.getGroupById(groupId);
      if (!groupData) {
        window.alert('Group not found');
        onBack();
        return;
      }

      setGroup(groupData);
      const [assignmentData, ideas, exclusionsResponse] = await Promise.all([
        groupService.getAssignment(groupId),
        groupService.getGiftIdeas(groupId),
        apiClient.getExclusions(Number(groupId)),
      ]);
      setAssignment(assignmentData);
      setGiftIdeas(userId ? ideas.filter((idea) => idea.created_by_id === userId) : ideas);
      if (exclusionsResponse.data) setExclusions(exclusionsResponse.data.exclusions);
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [groupId, onBack, userId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const cleanQuery = searchQuery.trim().replace(/^@/, '');
      if (!inviteOpen || cleanQuery.length < 2 || !group) {
        setSearchResults([]);
        return;
      }

      const response = await apiClient.searchUsers(cleanQuery);
      const memberIds = new Set(group.members?.map((member) => member.id) || []);
      setSearchResults(
        (response.data?.users || []).filter(
          (user) => user.id !== userId && user.id !== group.created_by && !memberIds.has(user.id)
        )
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [group, inviteOpen, searchQuery, userId]);

  const isOwner = Boolean(group && userId === group.created_by);
  const members = group?.members || [];

  const handleGetInviteLink = async () => {
    if (inviteLink) return;
    const response = await apiClient.getInviteLink(Number(groupId));
    if (response.error) {
      window.alert(response.error);
      return;
    }
    if (response.data) setInviteLink(`${window.location.origin}/join/${response.data.invite_token}`);
  };

  const handleInvite = async (username: string) => {
    setBusy(true);
    try {
      await groupService.inviteUser(groupId, username);
      setInviteOpen(false);
      setSearchQuery('');
      await loadGroup();
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = () => {
    if (!group) return;
    if ((group.members?.length || 0) < 2) {
      window.alert('Need at least 2 members to create Secret Santa assignments');
      return;
    }
    confirmDestructive('Assign Secret Santa', 'This will randomly assign each member to another member.', 'Assign', async () => {
      setBusy(true);
      try {
        await groupService.assignSecretSanta(groupId);
        await loadGroup();
      } catch (error) {
        window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    });
  };

  const handleDeleteAssignments = () => {
    confirmDestructive('Clear Assignments', 'This will remove all assignments for this group.', 'Clear', async () => {
      setBusy(true);
      try {
        await groupService.deleteAssignments(groupId);
        await loadGroup();
      } catch (error) {
        window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    });
  };

  const handleLeaveOrDelete = () => {
    if (!group) return;
    if (isOwner) {
      confirmDestructive('Delete Group', `Delete "${group.name}"? This cannot be undone.`, 'Delete', async () => {
        await groupService.deleteGroup(groupId);
        onBack();
      });
      return;
    }
    confirmDestructive('Leave Group', `Leave "${group.name}"?`, 'Leave', async () => {
      await groupService.leaveGroup(groupId);
      onBack();
    });
  };

  const handleRemoveMember = (memberId: number, name: string) => {
    confirmDestructive('Remove Member', `Remove ${name} from this group?`, 'Remove', async () => {
      await groupService.removeMember(groupId, memberId);
      await loadGroup();
    });
  };

  const handleCancelInvitation = (invitationId: number, name: string) => {
    confirmDestructive('Remove Invitation', `Remove the invitation for ${name}?`, 'Remove', async () => {
      await groupService.cancelInvitation(groupId, invitationId);
      await loadGroup();
    });
  };

  const handleSaveGiftIdea = async (event: FormEvent) => {
    event.preventDefault();
    const forUserId = giftIdeaForUserId || userId;
    if (!forUserId || !giftIdeaText.trim()) return;

    setBusy(true);
    try {
      await groupService.createGiftIdea(groupId, Number(forUserId), giftIdeaText.trim(), giftIdeaLink.trim() || undefined);
      setGiftIdeaText('');
      setGiftIdeaLink('');
      setGiftIdeaForUserId('');
      await loadGroup();
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGiftIdea = (ideaId: number) => {
    confirmDestructive('Delete Gift Idea', 'Delete this gift idea?', 'Delete', async () => {
      await groupService.deleteGiftIdea(groupId, ideaId);
      await loadGroup();
    });
  };

  const handleAddExclusion = async (event: FormEvent) => {
    event.preventDefault();
    if (!exclusionGiverId || !exclusionReceiverId || exclusionGiverId === exclusionReceiverId) return;

    setBusy(true);
    try {
      const response = await apiClient.addExclusion(Number(groupId), Number(exclusionReceiverId), Number(exclusionGiverId));
      if (response.error) window.alert(response.error);
      setExclusionGiverId('');
      setExclusionReceiverId('');
      await loadGroup();
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveExclusion = async (exclusionId: number) => {
    await apiClient.removeExclusion(Number(groupId), exclusionId);
    await loadGroup();
  };

  if (loading || !group) {
    return (
      <section className="screen">
        <header className="topbar">
          <button className="link-button" type="button" onClick={onBack}>Back</button>
          <h1>Group</h1>
          <div className="topbar-spacer" />
        </header>
        <div className="center-state"><span className="spinner" /></div>
      </section>
    );
  }

  return (
    <section className="screen">
      <header className="topbar">
        <button className="link-button" type="button" onClick={onBack}>Back</button>
        <h1>{group.name}</h1>
        <button className="secondary-button compact" type="button" onClick={loadGroup}>Refresh</button>
      </header>

      <section className="group-hero">
        <div className="group-image large">{group.image_url ? <img src={group.image_url} alt="" /> : <span>G</span>}</div>
        <div>
          <h2>{group.name}</h2>
          {group.description && <p>{group.description}</p>}
          <small>{members.length} {members.length === 1 ? 'member' : 'members'}</small>
        </div>
      </section>

      <section className="assignment-panel">
        <h2>Your Assignment</h2>
        {assignment ? (
          <p>You are buying for <strong>{assignment.receiver_display_name || assignment.receiver_username}</strong>.</p>
        ) : (
          <p>Assignments have not been created yet, or yours is not available.</p>
        )}
      </section>

      <section className="action-grid">
        {isOwner && <button className="primary-button" type="button" onClick={() => setInviteOpen(true)}>Invite People</button>}
        {isOwner && <button className="secondary-button" type="button" onClick={handleAssign} disabled={busy}>Assign Secret Santa</button>}
        {isOwner && <button className="secondary-button" type="button" onClick={handleDeleteAssignments} disabled={busy}>Clear Assignments</button>}
        <button className="danger-button" type="button" onClick={handleLeaveOrDelete}>{isOwner ? 'Delete Group' : 'Leave Group'}</button>
      </section>

      <section className="content-section">
        <h2>Members</h2>
        <div className="stack-list">
          {members.map((member) => (
            <div className="person-row" key={member.id}>
              <div className="small-avatar">{member.image_url ? <img src={member.image_url} alt="" /> : <span>{(member.display_name || member.username).charAt(0).toUpperCase()}</span>}</div>
              <div>
                <strong>{member.display_name || member.username}</strong>
                <small>@{member.username}</small>
              </div>
              {isOwner && member.id !== userId && (
                <button className="link-button danger-text" type="button" onClick={() => handleRemoveMember(member.id, member.display_name || member.username)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {isOwner && group.pending_invitations && group.pending_invitations.length > 0 && (
        <section className="content-section">
          <h2>Pending Invites</h2>
          <div className="stack-list">
            {group.pending_invitations.map((invite) => (
              <div className="person-row" key={invite.invitation_id}>
                <div>
                  <strong>{invite.display_name || invite.username}</strong>
                  <small>@{invite.username}</small>
                </div>
                <button className="link-button danger-text" type="button" onClick={() => handleCancelInvitation(invite.invitation_id, invite.display_name || invite.username)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="content-section">
        <h2>Gift Ideas</h2>
        <form className="inline-form" onSubmit={handleSaveGiftIdea}>
          <select value={giftIdeaForUserId} onChange={(event) => setGiftIdeaForUserId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">For me</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.display_name || member.username}</option>
            ))}
          </select>
          <input value={giftIdeaText} onChange={(event) => setGiftIdeaText(event.target.value)} placeholder="Gift idea" required />
          <input value={giftIdeaLink} onChange={(event) => setGiftIdeaLink(event.target.value)} placeholder="Link" />
          <button className="primary-button compact" type="submit" disabled={busy}>Add</button>
        </form>
        <div className="stack-list">
          {giftIdeas.map((idea) => (
            <div className="idea-row" key={idea.id}>
              <div>
                <strong>{idea.idea}</strong>
                {idea.link && <a href={idea.link} target="_blank" rel="noreferrer">{idea.link}</a>}
                <small>for {idea.for_user.display_name || idea.for_user.username}</small>
              </div>
              <button className="link-button danger-text" type="button" onClick={() => handleDeleteGiftIdea(idea.id)}>Delete</button>
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <section className="content-section">
          <h2>Exclusions</h2>
          <form className="inline-form" onSubmit={handleAddExclusion}>
            <select value={exclusionGiverId} onChange={(event) => setExclusionGiverId(event.target.value ? Number(event.target.value) : '')} required>
              <option value="">Giver</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.display_name || member.username}</option>)}
            </select>
            <select value={exclusionReceiverId} onChange={(event) => setExclusionReceiverId(event.target.value ? Number(event.target.value) : '')} required>
              <option value="">Cannot receive</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.display_name || member.username}</option>)}
            </select>
            <button className="primary-button compact" type="submit" disabled={busy}>Add</button>
          </form>
          <div className="stack-list">
            {exclusions.map((exclusion) => (
              <div className="person-row" key={exclusion.id}>
                <span>{exclusion.giver_display_name || exclusion.giver_username} cannot draw {exclusion.excluded_display_name || exclusion.excluded_username}</span>
                <button className="link-button danger-text" type="button" onClick={() => handleRemoveExclusion(exclusion.id)}>Remove</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {inviteOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <header>
              <h2>Invite People</h2>
              <button type="button" className="icon-button" onClick={() => setInviteOpen(false)} aria-label="Close">x</button>
            </header>
            <label>
              <span>Search username</span>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="@username" />
            </label>
            <div className="stack-list">
              {searchResults.map((user) => (
                <button className="person-row selectable" type="button" key={user.id} onClick={() => handleInvite(user.username)} disabled={busy}>
                  <div>
                    <strong>{user.display_name || user.username}</strong>
                    <small>@{user.username}</small>
                  </div>
                  <span>Invite</span>
                </button>
              ))}
            </div>
            <hr />
            <button className="secondary-button" type="button" onClick={handleGetInviteLink}>Create Invite Link</button>
            {inviteLink && (
              <div className="copy-field">
                <input value={inviteLink} readOnly />
                <button className="primary-button compact" type="button" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
