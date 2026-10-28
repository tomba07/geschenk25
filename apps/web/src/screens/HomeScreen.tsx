import React, { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronRight, CircleHelp, Clock3, Plus, Users } from 'lucide-react';
import { Friend, apiClient } from '../lib/api';
import { groupService, GroupServiceError } from '../services/groupService';
import { getErrorMessage } from '../utils/errors';
import { fileToDataUrl } from '../utils/file';
import { getInitials } from '../utils/initials';
import { showErrorToast } from '../utils/toast';
import { Group } from '../types/group';

interface HomeScreenProps {
  onGroupPress: (groupId: string, openInvite?: boolean) => void;
  onNavigateToProfile: () => void;
}

type GroupDrawStatus = 'drawn' | 'pending' | 'unknown';

function getGroupDrawStatus(group: Group): GroupDrawStatus {
  if (group.assignments_created === true) return 'drawn';
  if (group.assignments_created === false) return 'pending';
  return 'unknown';
}

function GroupStatus({ status }: { status: GroupDrawStatus }) {
  return (
    <span className={`overview-group-status ${status}`}>
      {status === 'drawn' ? <Check aria-hidden="true" /> : status === 'pending' ? <Clock3 aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
      {status === 'drawn' ? 'Names drawn' : status === 'pending' ? 'Waiting for name draw' : 'Status unavailable'}
    </span>
  );
}

export default function HomeScreen({ onGroupPress, onNavigateToProfile }: HomeScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [createStep, setCreateStep] = useState<'friends' | 'details'>('friends');
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const normalizedFriendSearch = friendSearchQuery.trim().replace(/^@/, '').toLowerCase();
  const filteredFriends = friends.filter((friend) => friend.username.toLowerCase().includes(normalizedFriendSearch));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const userGroups = await groupService.getGroups();
      setGroups(userGroups);
    } catch (error) {
      showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sortedGroups = useMemo(
    () => groups.filter((group) => Boolean(group.is_archived) === showArchived).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [groups, showArchived]
  );
  const featuredGroup = sortedGroups[0];
  const remainingGroups = sortedGroups.slice(1);
  const featuredGroupStatus = featuredGroup ? getGroupDrawStatus(featuredGroup) : 'unknown';

  const formatGroupDate = (date: string) => (
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setGroupImage(await fileToDataUrl(file));
  };

  const resetCreateForm = () => {
    setCreateStep('friends');
    setGroupName('');
    setGroupImage(null);
    setSelectedFriendIds([]);
    setFriendSearchQuery('');
    setModalVisible(false);
  };

  const openCreateModal = async () => {
    const response = await apiClient.getFriends();
    if (response.error) { showErrorToast(response.error); return; }
    const availableFriends = response.data?.friends || [];
    setFriends(availableFriends);
    setCreateStep(availableFriends.length ? 'friends' : 'details');
    setModalVisible(true);
  };

  const toggleSelectedFriend = (friendId: number) => {
    setSelectedFriendIds((currentIds) => (
      currentIds.includes(friendId)
        ? currentIds.filter((id) => id !== friendId)
        : [...currentIds, friendId]
    ));
  };

  const handleCreateGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (createStep === 'friends') return;
    if (!groupName.trim()) {
      showErrorToast('Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      const createdGroup = await groupService.createGroup(groupName.trim(), groupImage || undefined, selectedFriendIds);
      resetCreateForm();
      onGroupPress(String(createdGroup.id), friends.length === 0);
    } catch (error) {
      showErrorToast(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="overview-screen">
      <div className="overview-main">
        <header className="overview-page-header">
          <div>
            <h1>Your gift exchanges</h1>
            <p>See what&apos;s happening with your groups.</p>
          </div>
          <button className="primary-button overview-header-action" type="button" onClick={openCreateModal}>
            <Plus className="button-inline-icon" aria-hidden="true" />
            New Group
          </button>
        </header>

        <div className="overview-content">
        <div className="button-row overview-group-views" role="group" aria-label="Group view">
          <button className={showArchived ? 'secondary-button' : 'primary-button'} type="button" aria-pressed={!showArchived} onClick={() => setShowArchived(false)}>Active</button>
          <button className={showArchived ? 'primary-button' : 'secondary-button'} type="button" aria-pressed={showArchived} onClick={() => setShowArchived(true)}>Archived ({groups.filter((group) => group.is_archived).length})</button>
        </div>
        {loading ? (
          <section className="overview-groups-section overview-loading-section">
            <div className="overview-section-label skeleton-line short" />
            <article className="overview-featured-group overview-featured-skeleton">
              <span className="skeleton-avatar overview-skeleton-avatar" />
              <span className="skeleton-stack">
                <span className="skeleton-line wide" />
                <span className="skeleton-line" />
                <span className="skeleton-line short" />
              </span>
            </article>
            <div className="overview-group-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article className="overview-group-card overview-skeleton-card" key={index}>
                  <span className="skeleton-avatar overview-skeleton-avatar" />
                  <span className="skeleton-stack">
                    <span className="skeleton-line wide" />
                    <span className="skeleton-line" />
                    <span className="skeleton-line short" />
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : sortedGroups.length === 0 ? (
          <div className="overview-empty-state">
            <div className="empty-icon" aria-hidden="true"><Users size={32} strokeWidth={1.75} /></div>
            <h2>{showArchived ? 'No archived groups' : 'No active groups'}</h2>
            <p>{showArchived ? 'Groups you archive appear here. You can open them and restore them anytime.' : 'Create a group or restore one from Archived to see it here.'}</p>
            <button className="primary-button" type="button" onClick={showArchived ? () => setShowArchived(false) : openCreateModal}>
              {showArchived ? 'Back to active groups' : 'Create Group'}
            </button>
          </div>
        ) : (
          <section className="overview-groups-section">
            <div className="overview-featured-section">
              <span className="overview-section-label">Latest</span>
              <button
                className="overview-featured-group"
                type="button"
                onClick={() => onGroupPress(String(featuredGroup.id))}
              >
                {(featuredGroup.unread_message_count || 0) > 0 && (
                  <span className="overview-unread-badge" aria-label={`${featuredGroup.unread_message_count} unread messages`}>
                    {(featuredGroup.unread_message_count || 0) > 9 ? '9+' : featuredGroup.unread_message_count}
                  </span>
                )}
                <div className="overview-featured-summary">
                  <div className="group-image">
                    {featuredGroup.image_url ? <img src={featuredGroup.image_url} alt="" /> : <span>{getInitials(featuredGroup.name)}</span>}
                  </div>
                  <div>
                    <h2>{featuredGroup.name}</h2>
                    <p>
                      {featuredGroup.member_count != null
                        ? `${featuredGroup.member_count} ${featuredGroup.member_count === 1 ? 'member' : 'members'}`
                        : 'Members'}
                      {' · '}
                      {featuredGroup.assignments_created && featuredGroup.assignments_created_at
                        ? `Names drawn ${formatGroupDate(featuredGroup.assignments_created_at)}`
                        : `Created ${formatGroupDate(featuredGroup.created_at)}`}
                    </p>
                  </div>
                </div>
                <div className="overview-featured-copy">
                  <GroupStatus status={featuredGroupStatus} />
                  <strong>
                    {featuredGroup.assignment_receiver_username
                      ? `You're buying for @${featuredGroup.assignment_receiver_username}`
                      : featuredGroupStatus === 'drawn'
                        ? 'Your assignment is ready'
                        : featuredGroupStatus === 'pending'
                          ? 'This exchange is getting ready'
                          : 'Open the group for the latest status'}
                  </strong>
                  <p>
                    {featuredGroupStatus === 'drawn'
                      ? 'Take a look at their gift ideas.'
                      : featuredGroupStatus === 'pending'
                        ? 'Open the group to check the members and add gift ideas.'
                        : 'The draw status could not be loaded.'}
                  </p>
                </div>
                <span className="overview-featured-action">
                  {featuredGroupStatus === 'drawn' ? 'Explore group' : 'Open group'}
                  <ArrowRight className="button-inline-icon" aria-hidden="true" />
                </span>
              </button>
            </div>

            {remainingGroups.length > 0 && (
              <div className="overview-all-groups">
                <div className="overview-all-groups-heading">
                  <h2>All groups</h2>
                  <span>{remainingGroups.length} more</span>
                </div>
                <div className="overview-group-grid">
              {remainingGroups.map((group) => {
                const memberCount = group.member_count ?? group.members?.length;
                const unreadMessageCount = group.unread_message_count || 0;
                const groupStatus = getGroupDrawStatus(group);
                return (
                  <button className="overview-group-card" type="button" key={group.id} onClick={() => onGroupPress(String(group.id))}>
                    {unreadMessageCount > 0 && (
                      <span className="overview-unread-badge" aria-label={`${unreadMessageCount} unread messages`}>
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </span>
                    )}
                    <div className="group-image">{group.image_url ? <img src={group.image_url} alt="" /> : <span>{getInitials(group.name)}</span>}</div>
                    <div className="overview-group-card-body">
                      <h3>{group.name}</h3>
                      {group.description && <p>{group.description}</p>}
                      <div className="overview-group-meta">
                        <span>{memberCount != null ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : 'Members'}</span>
                        <span>Created {formatGroupDate(group.created_at)}</span>
                      </div>
                      <GroupStatus status={groupStatus} />
                    </div>
                    <ChevronRight className="overview-card-chevron" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
              </div>
            )}
          </section>
        )}
        </div>
      </div>

      {modalVisible && (
        <div className="modal-backdrop">
          <form className={`modal-panel ${createStep === 'friends' ? 'create-friends-dialog' : ''}`} onSubmit={handleCreateGroup}>
            <header>
              <h2>Create New Group</h2>
              <button type="button" className="icon-button" onClick={resetCreateForm} aria-label="Close">×</button>
            </header>
            {createStep === 'friends' ? (
              <>
                <div className="create-step-copy">
                  <span>Step 1 of 2</span>
                  <p>Optionally add existing friends, or continue and invite people with an exchange link.</p>
                </div>
                {friends.length > 0 && (
                  <label className="friend-picker-search">
                    <span>Search friends</span>
                    <input
                      type="search"
                      value={friendSearchQuery}
                      onChange={(event) => setFriendSearchQuery(event.target.value)}
                      placeholder="Search by username"
                      autoCapitalize="none"
                      autoComplete="off"
                    />
                  </label>
                )}
                {friends.length === 0 ? (
                  <div className="empty-inline create-empty-friends">
                    No friends needed. Continue to create the exchange, then share its invitation link.
                  </div>
                ) : (
                  <div className="create-friend-list">
                    {filteredFriends.length === 0 && (
                      <p className="empty-inline" role="status">No friends match that search.</p>
                    )}
                    {filteredFriends.map((friend) => {
                      const selected = selectedFriendIds.includes(friend.id);
                      return (
                        <button
                          className={`create-friend-option ${selected ? 'selected' : ''}`}
                          type="button"
                          key={friend.id}
                          onClick={() => toggleSelectedFriend(friend.id)}
                        >
                          <span className="small-avatar">
                            {friend.image_url ? <img src={friend.image_url} alt="" /> : <span>{friend.username.charAt(0).toUpperCase()}</span>}
                          </span>
                          <strong>@{friend.username}</strong>
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            aria-label={`Add @${friend.username}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="button-row end">
                  <button className="secondary-button" type="button" onClick={resetCreateForm}>Cancel</button>
                  <button className="primary-button" type="button" onClick={() => setCreateStep('details')}>Continue</button>
                </div>
              </>
            ) : (
              <>
                <div className="create-step-copy">
                  {friends.length > 0 && <span>Step 2 of 2</span>}
                  <p>{friends.length ? 'Name the group and add an optional picture.' : 'Name your exchange. After creating it, share a link so people can request to join.'}</p>
                </div>
                <label>
                  <span>Group Name</span>
                  <input value={groupName} onChange={(event) => setGroupName(event.target.value)} disabled={creating} required />
                </label>
                <label>
                  <span>Group Image</span>
                  {groupImage && <img className="image-preview" src={groupImage} alt="" />}
                  <input type="file" accept="image/*" onChange={handleImageChange} disabled={creating} />
                </label>
                <div className="button-row end">
                  <button className="secondary-button" type="button" onClick={() => friends.length ? setCreateStep('friends') : resetCreateForm()} disabled={creating}>{friends.length ? 'Back' : 'Cancel'}</button>
                  <button className="primary-button" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Group'}</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      <button className="overview-fab" type="button" onClick={openCreateModal} aria-label="Create new group">
        <span>+</span>
        <strong>New Group</strong>
      </button>
    </section>
  );
}
