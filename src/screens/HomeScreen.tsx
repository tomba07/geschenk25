import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { groupService, GroupServiceError } from '../services/groupService';
import { getErrorMessage } from '../utils/errors';
import { confirmDestructive } from '../utils/confirm';
import { fileToDataUrl } from '../utils/file';
import { Group, Invitation } from '../types/group';

interface HomeScreenProps {
  onGroupPress: (groupId: string) => void;
  onNavigateToProfile: () => void;
}

export default function HomeScreen({ onGroupPress, onNavigateToProfile }: HomeScreenProps) {
  const { username, displayName, imageUrl, signOut } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userGroups, pendingInvitations] = await Promise.all([
        groupService.getGroups(),
        groupService.getPendingInvitations(),
      ]);
      setGroups(userGroups);
      setInvitations(pendingInvitations);
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
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
    setGroupName('');
    setGroupDescription('');
    setGroupImage(null);
    setModalVisible(false);
  };

  const handleCreateGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!groupName.trim()) {
      window.alert('Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      await groupService.createGroup(groupName.trim(), groupDescription.trim() || undefined, groupImage || undefined);
      resetCreateForm();
      await loadData();
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      await groupService.acceptInvitation(invitationId);
      await loadData();
    } catch (error) {
      window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
    }
  };

  const handleRejectInvitation = async (invitationId: number) => {
    confirmDestructive('Reject Invitation', 'Are you sure you want to reject this invitation?', 'Reject', async () => {
      try {
        await groupService.rejectInvitation(invitationId);
        await loadData();
      } catch (error) {
        window.alert(error instanceof GroupServiceError ? error.appError.userMessage : getErrorMessage(error));
      }
    });
  };

  const initials = (displayName || username || 'U').charAt(0).toUpperCase();

  return (
    <section className="screen overview-screen">
      <header className="overview-header">
        <div className="overview-header-inner">
          <button className="overview-profile-button" type="button" onClick={() => setMenuVisible(true)} aria-label="Open profile menu">
            <span className="avatar-button">
              {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials}</span>}
            </span>
            <span className="overview-profile-text">
              <strong>{displayName || username || 'User'}</strong>
              {username && <small>@{username}</small>}
            </span>
          </button>
          <h1>Groups</h1>
        </div>
      </header>

      <div className="overview-content">
        {invitations.length > 0 && (
          <section className="overview-invitations">
            <div>
              <h2>Pending Invitations</h2>
              <p>{invitations.length} {invitations.length === 1 ? 'group is' : 'groups are'} waiting for your response.</p>
            </div>
            <div className="overview-invitation-list">
              {invitations.map((invitation) => (
                <article className="overview-invitation-card" key={invitation.id}>
                  <div>
                    <h3>{invitation.group_name}</h3>
                    <p>from {invitation.inviter_display_name}</p>
                  </div>
                  <div className="button-row">
                    <button className="primary-button compact" type="button" onClick={() => handleAcceptInvitation(invitation.id)}>
                      Accept
                    </button>
                    <button className="secondary-button compact" type="button" onClick={() => handleRejectInvitation(invitation.id)}>
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

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
            <button className="primary-button" type="button" onClick={() => setModalVisible(true)}>
              Create Your First Group
            </button>
          </div>
        ) : (
          <section className="overview-groups-section">
            <div className="overview-group-grid">
              {groups.map((group) => {
                const memberCount = group.member_count ?? group.members?.length;
                return (
                  <button className="overview-group-card" type="button" key={group.id} onClick={() => onGroupPress(String(group.id))}>
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

      {menuVisible && (
        <div className="modal-backdrop" onMouseDown={() => setMenuVisible(false)}>
          <div className="menu-popover" onMouseDown={(event) => event.stopPropagation()}>
            <div className="profile-summary">
              <div className="large-avatar">{imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials}</span>}</div>
              <strong>{displayName || username || 'User'}</strong>
              {username && <small>@{username}</small>}
            </div>
            <button type="button" onClick={onNavigateToProfile}>Edit Profile</button>
            <button
              className="danger-text"
              type="button"
              onClick={() => confirmDestructive('Sign Out', 'Are you sure you want to sign out?', 'Sign Out', signOut)}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {modalVisible && (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={handleCreateGroup}>
            <header>
              <h2>Create New Group</h2>
              <button type="button" className="icon-button" onClick={resetCreateForm} aria-label="Close">x</button>
            </header>
            <label>
              <span>Group Image</span>
              {groupImage && <img className="image-preview" src={groupImage} alt="" />}
              <input type="file" accept="image/*" onChange={handleImageChange} disabled={creating} />
            </label>
            <label>
              <span>Group Name</span>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} disabled={creating} required />
            </label>
            <label>
              <span>Description</span>
              <textarea value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} disabled={creating} rows={4} />
            </label>
            <div className="button-row end">
              <button className="secondary-button" type="button" onClick={resetCreateForm} disabled={creating}>Cancel</button>
              <button className="primary-button" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Group'}</button>
            </div>
          </form>
        </div>
      )}

      <button className="overview-fab" type="button" onClick={() => setModalVisible(true)} aria-label="Create new group">
        <span>+</span>
        <strong>New Group</strong>
      </button>
    </section>
  );
}
