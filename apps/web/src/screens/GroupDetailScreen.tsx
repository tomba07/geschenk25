import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { groupService, GroupServiceError } from '../services/groupService';
import { Friend, apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { confirmDestructive } from '../utils/confirm';
import { fileToDataUrl } from '../utils/file';
import { Assignment, GiftIdea, Group } from '../types/group';

interface GroupDetailScreenProps {
  groupId: string;
  onBack: () => void;
}

export default function GroupDetailScreen({ groupId, onBack }: GroupDetailScreenProps) {
  const { userId, username } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [giftIdeas, setGiftIdeas] = useState<GiftIdea[]>([]);
  const [assignedPersonGiftIdeas, setAssignedPersonGiftIdeas] = useState<GiftIdea[]>([]);
  const [drawExclusions, setDrawExclusions] = useState<Array<{ firstUserId: number; secondUserId: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [giftIdeaOpen, setGiftIdeaOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [imageDirty, setImageDirty] = useState(false);
  const [giftIdeaText, setGiftIdeaText] = useState('');
  const [giftIdeaLink, setGiftIdeaLink] = useState('');
  const [giftIdeaForUserId, setGiftIdeaForUserId] = useState<number | ''>('');
  const [exclusionGiverId, setExclusionGiverId] = useState<number | ''>('');
  const [exclusionReceiverId, setExclusionReceiverId] = useState<number | ''>('');

  const loadGroup = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const groupData = await groupService.getGroupById(groupId);
      if (!groupData) {
        window.alert('Group not found');
        onBack();
        return;
      }

      setGroup(groupData);
      const [assignmentData, ideas] = await Promise.all([
        groupService.getAssignment(groupId),
        groupService.getGiftIdeas(groupId),
      ]);
      const receiverIdeas = assignmentData
        ? await groupService.getGiftIdeas(groupId, assignmentData.receiver_id)
        : [];
      setAssignment(assignmentData);
      setGiftIdeas(userId ? ideas.filter((idea) => idea.created_by_id === userId) : ideas);
      setAssignedPersonGiftIdeas(receiverIdeas);
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  }, [groupId, onBack, userId]);

  useEffect(() => {
    loadGroup(true);
  }, [loadGroup]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!inviteOpen) return;

    let cancelled = false;
    async function loadInviteData() {
      if (username) {
        setInviteLink(`${window.location.origin}/plsbemyfriend/${encodeURIComponent(username)}`);
      }

      const friendsResponse = await apiClient.getFriends();

      if (cancelled) return;

      setFriends(friendsResponse.data?.friends || []);
      if (friendsResponse.error) {
        window.alert(friendsResponse.error);
      }
    }

    loadInviteData();
    return () => {
      cancelled = true;
    };
  }, [inviteOpen, username]);

  const isOwner = Boolean(group && userId === group.created_by);
  const members = group?.members || [];
  const assignmentsLocked = Boolean(assignment);
  const canDrawAssignments = isOwner && members.length >= 3 && !assignmentsLocked;
  const assignmentCreatedDate = assignment?.created_at
    ? new Date(assignment.created_at).toLocaleDateString()
    : null;
  const usernameById = new Map(members.map((member) => [member.id, member.username]));

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
        title: 'Add me on Geschenk',
        text: 'Add me as a friend on Geschenk so I can invite you to groups.',
        url: inviteLink,
      });
      return;
    }

    await handleCopyInviteLink();
  };

  const handleInvite = async (friend: Friend) => {
    setBusy(true);
    try {
      await groupService.inviteUser(groupId, friend.id);
      setInviteOpen(false);
      await loadGroup();
      setToastMessage(`@${friend.username} added to ${group?.name || 'group'}`);
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = () => {
    if (!group) return;
    if ((group.members?.length || 0) < 3) {
      window.alert('Need at least 3 members to create Secret Santa assignments');
      return;
    }
    setDrawExclusions([]);
    setExclusionGiverId('');
    setExclusionReceiverId('');
    setDrawOpen(true);
  };

  const handleConfirmAssign = async () => {
    setDrawing(true);
    try {
      await groupService.assignSecretSanta(groupId, drawExclusions);
      setDrawOpen(false);
      setDrawExclusions([]);
      await loadGroup();
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setDrawing(false);
    }
  };

  const handleDeleteAssignments = () => {
    confirmDestructive('Reset Draw', 'This will remove all assignments for this group.', 'Reset', async () => {
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

  const handleSaveGiftIdea = async (event: FormEvent) => {
    event.preventDefault();
    const forUserId = giftIdeaForUserId || userId;
    if (!forUserId || !giftIdeaText.trim()) return;

    setBusy(true);
    try {
      const newIdea = await groupService.createGiftIdea(groupId, Number(forUserId), giftIdeaText.trim(), giftIdeaLink.trim() || undefined);
      setGiftIdeaText('');
      setGiftIdeaLink('');
      setGiftIdeaForUserId('');
      setGiftIdeaOpen(false);
      if (newIdea.created_by_id === userId) {
        setGiftIdeas((currentIdeas) => [newIdea, ...currentIdeas]);
      }
      if (assignment && newIdea.for_user_id === assignment.receiver_id) {
        setAssignedPersonGiftIdeas((currentIdeas) => [newIdea, ...currentIdeas]);
      }
      setToastMessage('Gift idea added');
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

    const [firstUserId, secondUserId] = [Number(exclusionGiverId), Number(exclusionReceiverId)].sort((a, b) => a - b);
    const exists = drawExclusions.some((pair) => pair.firstUserId === firstUserId && pair.secondUserId === secondUserId);
    if (!exists) {
      setDrawExclusions((currentPairs) => [...currentPairs, { firstUserId, secondUserId }]);
    }
    setExclusionGiverId('');
    setExclusionReceiverId('');
  };

  const handleRemoveExclusion = (firstUserId: number, secondUserId: number) => {
    setDrawExclusions((currentPairs) =>
      currentPairs.filter((pair) => pair.firstUserId !== firstUserId || pair.secondUserId !== secondUserId)
    );
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
                <article className="native-card assignment-result-card">
                  <div className="assignment-person-row">
                    <div className="small-avatar">
                      {assignment.receiver_image_url ? <img src={assignment.receiver_image_url} alt="" /> : <span>{assignment.receiver_username.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="assignment-person-copy">
                      <span>You are buying for</span>
                      <strong>@{assignment.receiver_username}</strong>
                      {assignmentCreatedDate && <small>Names drawn on {assignmentCreatedDate}</small>}
                    </div>
                  </div>
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
              <article className="native-card empty-card assignment-empty-card">
                <div className="empty-card-icon">🎁</div>
                <div className="assignment-state-copy">
                  <h3>
                    {members.length < 3
                      ? 'Add more members'
                      : 'Ready to draw names'}
                  </h3>
                  <p>
                    {members.length < 3
                      ? 'Secret Santa needs at least three members.'
                      : 'Draw names when the member list looks right.'}
                  </p>
                </div>
                {canDrawAssignments && (
                  <button className="primary-button compact" type="button" onClick={handleAssign} disabled={busy || drawing}>Draw Names</button>
                )}
              </article>
            )}
            {isOwner && assignment && (
              <button className="secondary-button compact standalone-action" type="button" onClick={handleDeleteAssignments} disabled={busy}>
                Reset Draw
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

      </div>

      {inviteOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <header>
              <h2>Invite People</h2>
              <button type="button" className="icon-button" onClick={() => setInviteOpen(false)} aria-label="Close">×</button>
            </header>
            <section className="invite-link-panel">
              <div>
                <h3>Friend invite link</h3>
                <p>Share this link so someone can add you as a friend.</p>
              </div>
              {inviteLink ? (
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
              ) : (
                <p className="form-error">Finish your profile before sharing a friend link.</p>
              )}
            </section>

            <details className="invite-search-details" open>
              <summary>Add friends to group</summary>
              <div className="stack-list">
                {friends
                  .filter((friend) => !members.some((member) => member.id === friend.id) && friend.id !== group.created_by)
                  .map((friend) => (
                  <button className="person-row selectable" type="button" key={friend.id} onClick={() => handleInvite(friend)} disabled={busy}>
                    <div>
                      <strong>@{friend.username}</strong>
                      <small>@{friend.username}</small>
                    </div>
                    <span>Add</span>
                  </button>
                ))}
                {friends.filter((friend) => !members.some((member) => member.id === friend.id) && friend.id !== group.created_by).length === 0 && (
                  <p className="empty-inline">No friends available to add.</p>
                )}
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
              <button type="button" className="icon-button" onClick={() => setGiftIdeaOpen(false)} aria-label="Close">×</button>
            </header>
            <label>
              <span>For</span>
              <select value={giftIdeaForUserId} onChange={(event) => setGiftIdeaForUserId(event.target.value ? Number(event.target.value) : '')}>
                <option value="">Me</option>
                {members.filter((member) => member.id !== userId).map((member) => (
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

      {drawOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel draw-modal-panel">
            <header>
              <h2>Draw Names</h2>
              <button type="button" className="icon-button" onClick={() => setDrawOpen(false)} aria-label="Close">×</button>
            </header>

            <div className="draw-dialog-intro">
              <strong>{members.length} members are ready</strong>
              <p>Set optional pairs who should not draw each other. Assignments are private once created.</p>
            </div>

            <section className="draw-exclusions-section">
              <h3>Exclusions</h3>
              {drawExclusions.length === 0 ? (
                <p className="empty-inline">No exclusions set</p>
              ) : (
                <div className="native-list">
                  {drawExclusions.map((exclusionPair) => (
                    <article className="native-card exclusion-native-card" key={`${exclusionPair.firstUserId}-${exclusionPair.secondUserId}`}>
                      <span>@{usernameById.get(exclusionPair.firstUserId)} and @{usernameById.get(exclusionPair.secondUserId)} cannot draw each other</span>
                      <button className="link-button danger-text" type="button" onClick={() => handleRemoveExclusion(exclusionPair.firstUserId, exclusionPair.secondUserId)}>Remove</button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <form className="inline-exclusion-form" onSubmit={handleAddExclusion}>
              <label>
                <span>First person</span>
                <select value={exclusionGiverId} onChange={(event) => setExclusionGiverId(event.target.value ? Number(event.target.value) : '')} required>
                  <option value="">Choose member</option>
                  {members.map((member) => <option key={member.id} value={member.id}>@{member.username}</option>)}
                </select>
              </label>
              <label>
                <span>Second person</span>
                <select value={exclusionReceiverId} onChange={(event) => setExclusionReceiverId(event.target.value ? Number(event.target.value) : '')} required>
                  <option value="">Choose member</option>
                  {members.map((member) => <option key={member.id} value={member.id}>@{member.username}</option>)}
                </select>
              </label>
              <button className="secondary-button" type="submit" disabled={drawing}>Add Pair</button>
            </form>

            <div className="button-row end">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDrawOpen(false);
                  setDrawExclusions([]);
                }}
                disabled={drawing}
              >
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={handleConfirmAssign} disabled={drawing}>
                {drawing ? 'Drawing...' : 'Draw Names'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <header>
              <h2>Group Details</h2>
              <button type="button" className="icon-button" onClick={() => setDetailsOpen(false)} aria-label="Close">×</button>
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

            <section className="details-members-section">
              <div className="native-section-header">
                <h3>Members</h3>
                {isOwner && !assignmentsLocked && (
                  <button
                    className="primary-button compact pill-action"
                    type="button"
                    onClick={() => {
                      setDetailsOpen(false);
                      setInviteOpen(true);
                    }}
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

            <div className="button-row">
              <button className="danger-button" type="button" onClick={handleLeaveOrDelete}>
                {isOwner ? 'Delete Group' : 'Leave Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast-message" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </section>
  );
}
