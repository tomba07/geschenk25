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
    <section className="screen">
      <header className="topbar">
        <button className="avatar-button" type="button" onClick={() => setMenuVisible(true)} aria-label="Open profile menu">
          {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials}</span>}
        </button>
        <h1>My Groups</h1>
        <button className="primary-button compact" type="button" onClick={() => setModalVisible(true)}>
          New
        </button>
      </header>

      {invitations.length > 0 && (
        <section className="band">
          <div className="section-title-row">
            <h2>Pending Invitations</h2>
            <span className="badge">{invitations.length}</span>
          </div>
          <div className="horizontal-list">
            {invitations.map((invitation) => (
              <article className="item-card invitation-card" key={invitation.id}>
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
        <div className="center-state"><span className="spinner" /></div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">G</div>
          <h2>No groups yet</h2>
          <p>Create your first group to start organizing your Secret Santa exchange.</p>
          <button className="primary-button" type="button" onClick={() => setModalVisible(true)}>
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="group-list">
          {groups.map((group) => {
            const memberCount = group.member_count ?? group.members?.length;
            return (
              <button className="item-card group-card" type="button" key={group.id} onClick={() => onGroupPress(String(group.id))}>
                <div className="group-image">{group.image_url ? <img src={group.image_url} alt="" /> : <span>G</span>}</div>
                <div>
                  <h2>{group.name}</h2>
                  {group.description && <p>{group.description}</p>}
                  <small>
                    {memberCount != null ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'} · ` : ''}
                    {new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </small>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
    </section>
  );
}
