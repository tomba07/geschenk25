import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { Friend, apiClient } from '../lib/api';
import { groupService, GroupServiceError } from '../services/groupService';
import { getErrorMessage } from '../utils/errors';
import { fileToDataUrl } from '../utils/file';
import { showErrorToast } from '../utils/toast';
import { Group } from '../types/group';

interface HomeScreenProps {
  onGroupPress: (groupId: string) => void;
  onNavigateToProfile: () => void;
}

export default function HomeScreen({ onGroupPress, onNavigateToProfile }: HomeScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [createStep, setCreateStep] = useState<'friends' | 'details'>('friends');
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

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
    setModalVisible(false);
  };

  const openCreateModal = async () => {
    setModalVisible(true);
    setCreateStep('friends');
    const response = await apiClient.getFriends();
    setFriends(response.data?.friends || []);
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
    if (!groupName.trim()) {
      showErrorToast('Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      const createdGroup = await groupService.createGroup(groupName.trim(), groupImage || undefined, selectedFriendIds);
      resetCreateForm();
      onGroupPress(String(createdGroup.id));
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
            <h1>Groups</h1>
            <p>Create, manage, and join your gift exchange groups.</p>
          </div>
        </header>

        <div className="overview-content">
        {loading ? (
          <section className="overview-groups-section overview-loading-section">
            <div className="overview-group-grid">
              {Array.from({ length: 6 }).map((_, index) => (
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
        ) : groups.length === 0 ? (
          <div className="overview-empty-state">
            <div className="empty-icon">G</div>
            <h2>No groups yet</h2>
            <p>Create your first group to start organizing your Secret Santa exchange.</p>
            <button className="primary-button" type="button" onClick={openCreateModal}>
              Create Your First Group
            </button>
          </div>
        ) : (
          <section className="overview-groups-section">
            <div className="overview-group-grid">
              {groups.map((group) => {
                const memberCount = group.member_count ?? group.members?.length;
                const unreadMessageCount = group.unread_message_count || 0;
                return (
                  <button className="overview-group-card" type="button" key={group.id} onClick={() => onGroupPress(String(group.id))}>
                    {unreadMessageCount > 0 && (
                      <span className="overview-unread-badge" aria-label={`${unreadMessageCount} unread messages`}>
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </span>
                    )}
                    <div className="group-image">{group.image_url ? <img src={group.image_url} alt="" /> : <span>G</span>}</div>
                    <div className="overview-group-card-body">
                      <h3>{group.name}</h3>
                      {group.description && <p>{group.description}</p>}
                      <div className="overview-group-meta">
                        <span>{memberCount != null ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : 'Members'}</span>
                        <span>{new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        </div>
      </div>

      {modalVisible && (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={handleCreateGroup}>
            <header>
              <h2>Create New Group</h2>
              <button type="button" className="icon-button" onClick={resetCreateForm} aria-label="Close">×</button>
            </header>
            {createStep === 'friends' ? (
              <>
                <div className="create-step-copy">
                  <span>Step 1 of 2</span>
                  <p>Select friends to add to this group.</p>
                </div>
                {friends.length === 0 ? (
                  <div className="empty-inline create-empty-friends">
                    No friends yet. You can create the group now and add friends later.
                  </div>
                ) : (
                  <div className="create-friend-list">
                    {friends.map((friend) => {
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
                  <span>Step 2 of 2</span>
                  <p>Name the group and add an optional picture.</p>
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
                  <button className="secondary-button" type="button" onClick={() => setCreateStep('friends')} disabled={creating}>Back</button>
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
