import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { groupService, GroupServiceError } from '../services/groupService';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { confirmDestructive } from '../utils/confirm';
import { fileToDataUrl } from '../utils/file';
import { Assignment, Exclusion, GiftIdea, Group } from '../types/group';

interface GroupDetailScreenProps {
  groupId: string;
  onBack: () => void;
}

interface SearchUser {
  id: number;
  username: string;
}

export default function GroupDetailScreen({ groupId, onBack }: GroupDetailScreenProps) {
  const { userId } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [giftIdeas, setGiftIdeas] = useState<GiftIdea[]>([]);
  const [assignedPersonGiftIdeas, setAssignedPersonGiftIdeas] = useState<GiftIdea[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [giftIdeaOpen, setGiftIdeaOpen] = useState(false);
  const [exclusionOpen, setExclusionOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [imageDirty, setImageDirty] = useState(false);
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
      const receiverIdeas = assignmentData
        ? await groupService.getGiftIdeas(groupId, assignmentData.receiver_id)
        : [];
      setAssignment(assignmentData);
      setGiftIdeas(userId ? ideas.filter((idea) => idea.created_by_id === userId) : ideas);
      setAssignedPersonGiftIdeas(receiverIdeas);
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
  const assignmentsLocked = Boolean(assignment);

  const openDetails = () => {
    setEditingImage(group?.image_url || null);
    setImageDirty(false);
    setDetailsOpen(true);
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditingImage(await fileToDataUrl(file));
    setImageDirty(true);
  };

  const handleSaveImage = async () => {
    setBusy(true);
    try {
      const updatedGroup = await groupService.updateGroup(groupId, editingImage || undefined);
      setGroup(updatedGroup);
      setImageDirty(false);
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleGetInviteLink = async () => {
    if (inviteLink) return;
    setInviteLinkLoading(true);
    const response = await apiClient.getInviteLink(Number(groupId));
    setInviteLinkLoading(false);
    if (response.error) {
      window.alert(response.error);
      return;
    }
    if (response.data) setInviteLink(`${window.location.origin}/join/${response.data.invite_token}`);
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 1800);
  };

  const handleShareInviteLink = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      await navigator.share({
        title: group ? `Join ${group.name} on Geschenk` : 'Join my Geschenk group',
        text: group ? `Join my Secret Santa group "${group.name}".` : 'Join my Secret Santa group.',
        url: inviteLink,
      });
      return;
    }

    await handleCopyInviteLink();
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
      setGiftIdeaOpen(false);
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
      setExclusionOpen(false);
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
      <section className="screen group-detail-screen">
        <header className="topbar detail-topbar">
          <button className="detail-back-button" type="button" onClick={onBack}>← Groups</button>
          <h1>Group</h1>
          <span className="detail-action-spacer" />
        </header>
        <div className="detail-layout detail-loading-layout">
          <section className="detail-page-hero detail-skeleton-card">
            <div className="skeleton-avatar" />
            <div className="skeleton-stack">
              <span className="skeleton-line wide" />
              <span className="skeleton-line" />
            </div>
          </section>
          <div className="detail-main">
            <section className="detail-section assignments-section detail-skeleton-card">
              <span className="skeleton-line heading" />
              <span className="skeleton-block" />
            </section>
            <section className="detail-section ideas-section detail-skeleton-card">
              <span className="skeleton-line heading" />
              <span className="skeleton-block" />
            </section>
          </div>
          <aside className="detail-sidebar">
            <section className="detail-section members-section detail-skeleton-card">
              <span className="skeleton-line heading" />
              <span className="skeleton-row" />
              <span className="skeleton-row" />
            </section>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="screen group-detail-screen">
      <header className="topbar detail-topbar">
        <button className="detail-back-button" type="button" onClick={onBack}>← Groups</button>
        <h1>{group.name}</h1>
        <button className="secondary-button compact detail-action-button" type="button" onClick={openDetails}>Details</button>
      </header>

      <div className="detail-layout">
        <section className="detail-page-hero">
          <div className="group-image large">{group.image_url ? <img src={group.image_url} alt="" /> : <span>G</span>}</div>
          <div>
            <h2>{group.name}</h2>
            {group.description && <p>{group.description}</p>}
            <small>{members.length} {members.length === 1 ? 'member' : 'members'}</small>
          </div>
        </section>

        <div className="detail-main">
          <section className="detail-section assignments-section">
            <h2>Assignments</h2>
            {assignment ? (
              <>
                <article className="native-card assignment-card">
                  <div className="empty-card-icon">🎁</div>
                  <p>You are buying for <strong>@{assignment.receiver_username}</strong>.</p>
                </article>
                <div className="assigned-ideas-panel">
                  <h3>Gift Ideas for @{assignment.receiver_username}</h3>
                  {assignedPersonGiftIdeas.length === 0 ? (
                    <p className="empty-inline">No gift ideas shared for this person yet.</p>
                  ) : (
                    <div className="native-list">
                      {assignedPersonGiftIdeas.map((idea) => (
                        <article className="native-card idea-native-card" key={idea.id}>
                          <div>
                            <strong>{idea.idea}</strong>
                            {idea.link && <a href={idea.link} target="_blank" rel="noreferrer">{idea.link}</a>}
                            <small>from @{idea.created_by.username}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <article className="native-card empty-card">
                <div className="empty-card-icon">🎁</div>
                <p>
                  {members.length < 2
                    ? 'Add at least one more member to create Secret Santa assignments.'
                    : 'Assignments have not been created yet.'}
                </p>
                {isOwner && members.length >= 2 && (
                  <button className="primary-button compact" type="button" onClick={handleAssign} disabled={busy}>Assign</button>
                )}
              </article>
            )}
            {isOwner && assignment && (
              <button className="secondary-button compact standalone-action" type="button" onClick={handleDeleteAssignments} disabled={busy}>
                Clear Assignments
              </button>
            )}
          </section>

          <section className="detail-section ideas-section">
            <div className="native-section-header">
              <h2>My Gift Ideas</h2>
              <button className="primary-button compact pill-action" type="button" onClick={() => setGiftIdeaOpen(true)}>+ Add Idea</button>
            </div>
            {giftIdeas.length === 0 ? (
              <article className="native-card empty-card">
                <div className="empty-card-icon">💡</div>
                <p>You haven't created any gift ideas yet. Add some ideas for group members!</p>
              </article>
            ) : (
              <div className="native-list">
                {giftIdeas.map((idea) => (
                  <article className="native-card idea-native-card" key={idea.id}>
                    <div>
                      <strong>{idea.idea}</strong>
                      {idea.link && <a href={idea.link} target="_blank" rel="noreferrer">{idea.link}</a>}
                      <small>for @{idea.for_user.username}</small>
                    </div>
                    <button className="link-button danger-text" type="button" onClick={() => handleDeleteGiftIdea(idea.id)}>Delete</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-sidebar">
          <section className="detail-section members-section">
            <div className="native-section-header">
              <h2>Members</h2>
              {isOwner && !assignmentsLocked && (
                <button
                  className="primary-button compact pill-action"
                  type="button"
                  onClick={() => setInviteOpen(true)}
                >
                  + Invite
                </button>
              )}
            </div>
            <div className="native-list">
              {members.map((member) => (
                <article className="native-card member-native-card" key={member.id}>
                  <div className="small-avatar">{member.image_url ? <img src={member.image_url} alt="" /> : <span>{member.username.charAt(0).toUpperCase()}</span>}</div>
                  <div className="member-native-text">
                    <div>
                      <strong>@{member.username}</strong>
                      {member.id === group.created_by && <span className="owner-badge">Owner</span>}
                    </div>
                    <small>@{member.username}</small>
                  </div>
                  {isOwner && !assignmentsLocked && member.id !== userId && (
                    <button className="link-button danger-text" type="button" onClick={() => handleRemoveMember(member.id, member.username)}>
                      Remove
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>

          {isOwner && group.pending_invitations && group.pending_invitations.length > 0 && (
            <section className="detail-section pending-section">
              <h2>Pending Invites</h2>
              <div className="stack-list">
                {group.pending_invitations.map((invite) => (
                  <div className="person-row" key={invite.invitation_id}>
                    <div>
                      <strong>@{invite.username}</strong>
                      <small>@{invite.username}</small>
                    </div>
                    <button className="link-button danger-text" type="button" onClick={() => handleCancelInvitation(invite.invitation_id, invite.username)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isOwner && (
            <section className="detail-section exclusions-section">
              <div className="native-section-header">
                <h2>Exclusions</h2>
                {!assignmentsLocked && (
                  <button
                    className="primary-button compact pill-action"
                    type="button"
                    onClick={() => setExclusionOpen(true)}
                  >
                    + Add Pair
                  </button>
                )}
              </div>
              {exclusions.length === 0 ? (
                <p className="empty-inline">No exclusions set</p>
              ) : (
                <div className="native-list">
                  {exclusions.map((exclusion) => (
                    <article className="native-card exclusion-native-card" key={exclusion.id}>
                      <span>@{exclusion.giver_username} cannot draw @{exclusion.excluded_username}</span>
                      <button className="link-button danger-text" type="button" onClick={() => handleRemoveExclusion(exclusion.id)}>Remove</button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {inviteOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <header>
              <h2>Invite People</h2>
              <button type="button" className="icon-button" onClick={() => setInviteOpen(false)} aria-label="Close">x</button>
            </header>
            <section className="invite-link-panel">
              <div>
                <h3>Share invite link</h3>
                <p>Anyone with this link can join this group.</p>
              </div>
              {!inviteLink ? (
                <button className="primary-button" type="button" onClick={handleGetInviteLink} disabled={inviteLinkLoading}>
                  {inviteLinkLoading ? 'Creating...' : 'Create Invite Link'}
                </button>
              ) : (
                <>
                  <div className="copy-field">
                    <input value={inviteLink} readOnly />
                    <button className="primary-button compact" type="button" onClick={handleCopyInviteLink}>
                      {inviteCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <button className="secondary-button" type="button" onClick={handleShareInviteLink}>
                    Share Link
                  </button>
                </>
              )}
            </section>

            <details className="invite-search-details">
              <summary>Invite by username</summary>
              <label>
                <span>Search username</span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="@username" />
              </label>
              <div className="stack-list">
                {searchResults.map((user) => (
                  <button className="person-row selectable" type="button" key={user.id} onClick={() => handleInvite(user.username)} disabled={busy}>
                    <div>
                      <strong>@{user.username}</strong>
                      <small>@{user.username}</small>
                    </div>
                    <span>Invite</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}

      {giftIdeaOpen && (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={handleSaveGiftIdea}>
            <header>
              <h2>Add Gift Idea</h2>
              <button type="button" className="icon-button" onClick={() => setGiftIdeaOpen(false)} aria-label="Close">x</button>
            </header>
            <label>
              <span>For</span>
              <select value={giftIdeaForUserId} onChange={(event) => setGiftIdeaForUserId(event.target.value ? Number(event.target.value) : '')}>
                <option value="">Me</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>@{member.username}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Idea</span>
              <input value={giftIdeaText} onChange={(event) => setGiftIdeaText(event.target.value)} placeholder="Gift idea" required />
            </label>
            <label>
              <span>Link</span>
              <input value={giftIdeaLink} onChange={(event) => setGiftIdeaLink(event.target.value)} placeholder="https://..." />
            </label>
            <div className="button-row end">
              <button className="secondary-button" type="button" onClick={() => setGiftIdeaOpen(false)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={busy}>Add Idea</button>
            </div>
          </form>
        </div>
      )}

      {exclusionOpen && (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={handleAddExclusion}>
            <header>
              <h2>Add Exclusion Pair</h2>
              <button type="button" className="icon-button" onClick={() => setExclusionOpen(false)} aria-label="Close">x</button>
            </header>
            <label>
              <span>Giver</span>
              <select value={exclusionGiverId} onChange={(event) => setExclusionGiverId(event.target.value ? Number(event.target.value) : '')} required>
                <option value="">Choose member</option>
                {members.map((member) => <option key={member.id} value={member.id}>@{member.username}</option>)}
              </select>
            </label>
            <label>
              <span>Cannot receive</span>
              <select value={exclusionReceiverId} onChange={(event) => setExclusionReceiverId(event.target.value ? Number(event.target.value) : '')} required>
                <option value="">Choose member</option>
                {members.map((member) => <option key={member.id} value={member.id}>@{member.username}</option>)}
              </select>
            </label>
            <div className="button-row end">
              <button className="secondary-button" type="button" onClick={() => setExclusionOpen(false)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={busy}>Add Pair</button>
            </div>
          </form>
        </div>
      )}

      {detailsOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <header>
              <h2>Group Details</h2>
              <button type="button" className="icon-button" onClick={() => setDetailsOpen(false)} aria-label="Close">x</button>
            </header>

            <section className="details-image-section">
              <div className="group-image large">
                {editingImage ? <img src={editingImage} alt="" /> : <span>G</span>}
              </div>
              {isOwner && (
                <div className="button-row">
                  <label className="secondary-button file-button">
                    Change
                    <input type="file" accept="image/*" onChange={handleImageChange} />
                  </label>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setEditingImage(null);
                      setImageDirty(true);
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              {isOwner && imageDirty && (
                <button className="primary-button" type="button" onClick={handleSaveImage} disabled={busy}>
                  {busy ? 'Saving...' : 'Save Image'}
                </button>
              )}
            </section>

            <dl className="details-list">
              <div>
                <dt>Name</dt>
                <dd>{group.name}</dd>
              </div>
              {group.description && (
                <div>
                  <dt>Description</dt>
                  <dd>{group.description}</dd>
                </div>
              )}
              <div>
                <dt>Created</dt>
                <dd>{new Date(group.created_at).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt>Members</dt>
                <dd>{members.length}</dd>
              </div>
              {group.owner && (
                <div>
                  <dt>Owner</dt>
                  <dd>@{group.owner.username}</dd>
                </div>
              )}
            </dl>

            <div className="button-row">
              <button className="danger-button" type="button" onClick={handleLeaveOrDelete}>
                {isOwner ? 'Delete Group' : 'Leave Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
