import React, { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { groupService, GroupServiceError } from '../services/groupService';
import { Friend, apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { confirmDestructive } from '../utils/confirm';
import { fileToDataUrl } from '../utils/file';
import { showErrorToast, showSuccessToast } from '../utils/toast';
import { Assignment, GiftIdea, Group, GroupMember } from '../types/group';

type DrawExclusion = { firstUserId: number; secondUserId: number };

function getDrawExclusionValidationMessage(members: GroupMember[], exclusions: DrawExclusion[]) {
  if (members.length < 3 || exclusions.length === 0) return null;

  const blockedPairs = new Set<string>();
  exclusions.forEach((pair) => {
    blockedPairs.add(`${pair.firstUserId}-${pair.secondUserId}`);
    blockedPairs.add(`${pair.secondUserId}-${pair.firstUserId}`);
  });

  const memberIds = members.map((member) => member.id);
  for (const member of members) {
    const validReceivers = memberIds.filter((receiverId) => (
      receiverId !== member.id && !blockedPairs.has(`${member.id}-${receiverId}`)
    ));
    if (validReceivers.length === 0) {
      return `@${member.username} cannot draw anyone with these pairing rules.`;
    }
  }

  const receiverMatches = new Map<number, number>();
  const canMatchGiver = (giverId: number, visitedReceivers: Set<number>): boolean => {
    for (const receiverId of memberIds) {
      if (receiverId === giverId || blockedPairs.has(`${giverId}-${receiverId}`) || visitedReceivers.has(receiverId)) {
        continue;
      }

      visitedReceivers.add(receiverId);
      const matchedGiverId = receiverMatches.get(receiverId);
      if (matchedGiverId === undefined || canMatchGiver(matchedGiverId, visitedReceivers)) {
        receiverMatches.set(receiverId, giverId);
        return true;
      }
    }

    return false;
  };

  for (const giverId of memberIds) {
    if (!canMatchGiver(giverId, new Set())) {
      return 'These pairing rules make a complete draw impossible. Remove one rule and try again.';
    }
  }

  return null;
}

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
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
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
        showErrorToast('Group not found');
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
      showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  }, [groupId, onBack, userId]);

  useEffect(() => {
    loadGroup(true);
  }, [loadGroup]);

  useEffect(() => {
    if (!inviteOpen) return;

    let cancelled = false;
    setSelectedFriendIds([]);
    setFriendSearchQuery('');
    async function loadInviteData() {
      if (username) {
        setInviteLink(`${window.location.origin}/plsbemyfriend/${encodeURIComponent(username)}`);
      }

      const friendsResponse = await apiClient.getFriends();

      if (cancelled) return;

      setFriends(friendsResponse.data?.friends || []);
      if (friendsResponse.error) {
        showErrorToast(friendsResponse.error);
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
  const memberIds = new Set(members.map((member) => member.id));
  const drawValidationMessage = useMemo(
    () => getDrawExclusionValidationMessage(members, drawExclusions),
    [drawExclusions, members]
  );
  const selectedExclusionExists = Boolean(exclusionGiverId && exclusionReceiverId) && drawExclusions.some((pair) => {
    const [firstUserId, secondUserId] = [Number(exclusionGiverId), Number(exclusionReceiverId)].sort((a, b) => a - b);
    return pair.firstUserId === firstUserId && pair.secondUserId === secondUserId;
  });
  const canAddExclusion = Boolean(
    exclusionGiverId &&
    exclusionReceiverId &&
    exclusionGiverId !== exclusionReceiverId &&
    !selectedExclusionExists
  );
  const normalizedFriendSearch = friendSearchQuery.trim().toLowerCase();
  const filteredFriends = friends.filter((friend) =>
    !normalizedFriendSearch || friend.username.toLowerCase().includes(normalizedFriendSearch)
  );
  const addableFriendCount = friends.filter((friend) => !memberIds.has(friend.id)).length;

  const openDetails = () => {
    setEditingImage(group?.image_url || null);
    setDetailsOpen(true);
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = await fileToDataUrl(file);
    await saveGroupImage(imageUrl);
  };

  const saveGroupImage = async (imageUrl?: string) => {
    setBusy(true);
    try {
      setEditingImage(imageUrl || null);
      const updatedGroup = await groupService.updateGroup(groupId, imageUrl);
      setGroup(updatedGroup);
      setEditingImage(updatedGroup.image_url || null);
    } catch (error) {
      showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
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

  const closeInviteModal = () => {
    setInviteOpen(false);
    setSelectedFriendIds([]);
    setFriendSearchQuery('');
  };

  const toggleSelectedFriend = (friendId: number) => {
    setSelectedFriendIds((currentIds) =>
      currentIds.includes(friendId)
        ? currentIds.filter((currentId) => currentId !== friendId)
        : [...currentIds, friendId]
    );
  };

  const handleAddSelectedFriends = async () => {
    const selectedFriends = friends.filter((friend) => selectedFriendIds.includes(friend.id));
    if (selectedFriends.length === 0) return;

    setBusy(true);
    try {
      await Promise.all(selectedFriends.map((friend) => groupService.inviteUser(groupId, friend.id)));
      closeInviteModal();
      await loadGroup();
      showSuccessToast(
        selectedFriends.length === 1
          ? `@${selectedFriends[0].username} added to ${group?.name || 'group'}`
          : `${selectedFriends.length} friends added to ${group?.name || 'group'}`
      );
    } catch (error) {
      showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = () => {
    if (!group) return;
    if ((group.members?.length || 0) < 3) {
      showErrorToast('Add at least 3 members before drawing names');
      return;
    }
    setDrawExclusions([]);
    setExclusionGiverId('');
    setExclusionReceiverId('');
    setDrawOpen(true);
  };

  const handleConfirmAssign = async () => {
    if (drawValidationMessage) {
      showErrorToast(drawValidationMessage);
      return;
    }

    setDrawing(true);
    try {
      await groupService.assignSecretSanta(groupId, drawExclusions);
      setDrawOpen(false);
      setDrawExclusions([]);
      await loadGroup();
      showSuccessToast('Names drawn');
    } catch (error) {
      showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
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
        showSuccessToast('Draw reset');
      } catch (error) {
        showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
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
      showSuccessToast('Gift idea added');
    } catch (error) {
      showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
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
          <button className="detail-back-button" type="button" onClick={onBack} aria-label="Back to groups">
            <span className="detail-back-full">← Groups</span>
            <span className="detail-back-compact">←</span>
          </button>
          <div className="detail-title-button detail-title-loading">
            <span className="skeleton-avatar detail-title-skeleton-avatar" />
            <span className="skeleton-line detail-title-skeleton-line" />
          </div>
          <span className="detail-action-spacer" />
        </header>
        <div className="detail-layout detail-loading-layout">
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
        <button className="detail-back-button" type="button" onClick={onBack} aria-label="Back to groups">
          <span className="detail-back-full">← Groups</span>
          <span className="detail-back-compact">←</span>
        </button>
        <button className="detail-title-button" type="button" onClick={openDetails} aria-label="Open group details">
          <span className="group-image detail-title-image">{group.image_url ? <img src={group.image_url} alt="" /> : <span>G</span>}</span>
          <span className="detail-title-copy">
            <strong>{group.name}</strong>
            <small>{members.length} {members.length === 1 ? 'member' : 'members'}</small>
          </span>
        </button>
        <span className="detail-action-spacer" />
      </header>

      <div className="detail-layout">
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
                      : isOwner
                        ? 'Ready to draw names'
                        : 'Waiting for names'}
                  </h3>
                  <p>
                    {members.length < 3
                      ? 'Secret Santa needs at least three members.'
                      : isOwner
                        ? 'Draw names when the member list looks right.'
                        : 'The group owner can draw names when everything is ready.'}
                  </p>
                </div>
                {isOwner && members.length < 3 && !assignmentsLocked && (
                  <button className="primary-button compact" type="button" onClick={() => setInviteOpen(true)} disabled={busy}>
                    + Add
                  </button>
                )}
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
          <div className="modal-panel invite-modal-panel">
            <header>
              <h2>Add People</h2>
              <button type="button" className="icon-button" onClick={closeInviteModal} aria-label="Close">×</button>
            </header>

            <section className="friend-picker-panel">
              <div>
                <h3>Add friends to this group</h3>
                <p>Select one or more friends. People already in the group are shown as added.</p>
              </div>

              <label className="friend-picker-search">
                <span>Search friends</span>
                <input
                  value={friendSearchQuery}
                  onChange={(event) => setFriendSearchQuery(event.target.value)}
                  placeholder="Search by username"
                  autoCapitalize="none"
                  autoComplete="off"
                />
              </label>

              <div className="friend-picker-list">
                {filteredFriends.map((friend) => {
                  const isMember = memberIds.has(friend.id);
                  const isSelected = selectedFriendIds.includes(friend.id);

                  return (
                    <label className={`friend-picker-option ${isSelected ? 'selected' : ''} ${isMember ? 'disabled' : ''}`} key={friend.id}>
                      <div className="small-avatar">
                        {friend.image_url ? <img src={friend.image_url} alt="" /> : <span>{friend.username.charAt(0).toUpperCase()}</span>}
                      </div>
                      <div>
                        <strong>@{friend.username}</strong>
                        <small>{isMember ? 'Already in group' : 'Friend'}</small>
                      </div>
                      {isMember ? (
                        <span className="friend-picker-status">Added</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectedFriend(friend.id)}
                          disabled={busy}
                          aria-label={`Add @${friend.username}`}
                        />
                      )}
                    </label>
                  );
                })}
                {filteredFriends.length === 0 && (
                  <p className="empty-inline">
                    {friends.length === 0 ? 'No friends yet. Share your friend link first.' : 'No friends match that search.'}
                  </p>
                )}
              </div>
            </section>

            <details className="invite-link-panel">
              <summary>Need to add someone as a friend first?</summary>
              <div className="invite-link-panel-body">
                <p>Share your friend link. Once they add you, they can be added to groups directly.</p>
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
              </div>
            </details>

            <div className="button-row invite-modal-footer">
              <span>
                {addableFriendCount === 0
                  ? 'No friends available to add'
                  : selectedFriendIds.length === 0
                    ? `${addableFriendCount} ${addableFriendCount === 1 ? 'friend' : 'friends'} available`
                    : `${selectedFriendIds.length} selected`}
              </span>
              <button className="secondary-button" type="button" onClick={closeInviteModal} disabled={busy}>Cancel</button>
              <button className="primary-button" type="button" onClick={handleAddSelectedFriends} disabled={busy || selectedFriendIds.length === 0}>
                {busy ? 'Adding...' : selectedFriendIds.length === 1 ? 'Add 1 Friend' : `Add ${selectedFriendIds.length} Friends`}
              </button>
            </div>
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
              <p>Pairing rules are optional. Use them to avoid boring pairs, like partners drawing each other.</p>
            </div>

            {drawValidationMessage && (
              <div className="draw-validation-warning" role="alert">
                {drawValidationMessage}
              </div>
            )}

            <section className="draw-exclusions-section">
              <h3>Pairing rules</h3>
              {drawExclusions.length === 0 ? (
                <p className="empty-inline">No pairing rules set</p>
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
              <button className="secondary-button" type="submit" disabled={drawing || !canAddExclusion}>Avoid Pair</button>
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
              <button className="primary-button" type="button" onClick={handleConfirmAssign} disabled={drawing || Boolean(drawValidationMessage)}>
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
                    onClick={() => saveGroupImage(undefined)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
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
                    + Add
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

    </section>
  );
}
