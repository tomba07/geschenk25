import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DevGroup, DevState, apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { showErrorToast, showSuccessToast } from '../utils/toast';

export default function DevAdminScreen() {
  const { userId } = useAuth();
  const [state, setState] = useState<DevState | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [groupName, setGroupName] = useState('Dev Gift Exchange');
  const [ownerId, setOwnerId] = useState<number | ''>(userId || '');
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [memberToAddId, setMemberToAddId] = useState<number | ''>('');
  const [giftForUserId, setGiftForUserId] = useState<number | ''>('');
  const [giftCreatedById, setGiftCreatedById] = useState<number | ''>(userId || '');
  const [giftIdea, setGiftIdea] = useState('');
  const [giftLink, setGiftLink] = useState('');

  const selectedGroup = useMemo<DevGroup | null>(() => {
    if (!state || !selectedGroupId) return null;
    return state.groups.find((group) => group.id === selectedGroupId) || null;
  }, [selectedGroupId, state]);

  const selectedGroupMemberIds = useMemo(
    () => new Set(selectedGroup?.members.map((member) => member.id) || []),
    [selectedGroup]
  );

  const users = state?.users || [];
  const availableMembers = users.filter((user) => !selectedGroupMemberIds.has(user.id));
  const selectedGroupMembers = selectedGroup?.members || [];
  const canCreateGroup = Boolean(groupName.trim() && ownerId);
  const canAddGiftIdea = Boolean(selectedGroup && giftForUserId && giftCreatedById && giftIdea.trim());

  const applyDevState = useCallback((nextState: DevState) => {
    setState(nextState);
    setOwnerId((currentOwnerId) => currentOwnerId || userId || nextState.users[0]?.id || '');
    setGiftCreatedById((currentCreatorId) => currentCreatorId || userId || nextState.users[0]?.id || '');
    setSelectedGroupId((currentGroupId) => {
      if (currentGroupId && nextState.groups.some((group) => group.id === currentGroupId)) return currentGroupId;
      return nextState.groups[0]?.id || '';
    });
  }, [userId]);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.getDevState();
      if (response.error || !response.data) {
        showErrorToast(response.error || 'Dev tools are unavailable');
        return;
      }
      applyDevState(response.data);
    } catch (error) {
      showErrorToast(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [applyDevState]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (!selectedGroup) return;
    const firstMemberId = selectedGroup.members[0]?.id || '';
    setGiftForUserId((currentId) => currentId && selectedGroupMemberIds.has(currentId) ? currentId : firstMemberId);
    setGiftCreatedById((currentId) => currentId && selectedGroupMemberIds.has(currentId) ? currentId : firstMemberId);
  }, [selectedGroup, selectedGroupMemberIds]);

  const runAction = async (label: string, action: () => Promise<DevState | undefined>, successMessage: string) => {
    setBusyAction(label);
    try {
      const nextState = await action();
      if (nextState) {
        applyDevState(nextState);
        showSuccessToast(successMessage);
      }
    } catch (error) {
      showErrorToast(getErrorMessage(error));
    } finally {
      setBusyAction('');
    }
  };

  const createTestAccounts = () => runAction('test-accounts', async () => {
    const response = await apiClient.createDevTestAccounts();
    if (response.error || !response.data) throw new Error(response.error || 'Failed to create test accounts');
    return response.data.state;
  }, 'Test accounts ready');

  const createGroup = (event: FormEvent) => {
    event.preventDefault();
    if (!ownerId) return;

    runAction('create-group', async () => {
      const response = await apiClient.createDevGroup(groupName.trim(), Number(ownerId), memberIds);
      if (response.error || !response.data) throw new Error(response.error || 'Failed to create group');
      setSelectedGroupId(response.data.group_id);
      setGroupName('Dev Gift Exchange');
      setMemberIds([]);
      return response.data.state;
    }, 'Group created');
  };

  const addMember = () => {
    if (!selectedGroup || !memberToAddId) return;
    runAction('add-member', async () => {
      const response = await apiClient.addDevGroupMember(selectedGroup.id, Number(memberToAddId));
      if (response.error || !response.data) throw new Error(response.error || 'Failed to add member');
      setMemberToAddId('');
      return response.data.state;
    }, 'Member added');
  };

  const removeMember = (memberId: number) => {
    if (!selectedGroup) return;
    runAction(`remove-member-${memberId}`, async () => {
      const response = await apiClient.removeDevGroupMember(selectedGroup.id, memberId);
      if (response.error || !response.data) throw new Error(response.error || 'Failed to remove member');
      return response.data.state;
    }, 'Member removed');
  };

  const addGiftIdea = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedGroup || !giftForUserId || !giftCreatedById) return;

    runAction('add-gift', async () => {
      const response = await apiClient.addDevGiftIdea(
        selectedGroup.id,
        Number(giftForUserId),
        Number(giftCreatedById),
        giftIdea.trim(),
        giftLink.trim() || undefined
      );
      if (response.error || !response.data) throw new Error(response.error || 'Failed to add gift idea');
      setGiftIdea('');
      setGiftLink('');
      return response.data.state;
    }, 'Gift idea added');
  };

  const removeGiftIdea = (ideaId: number) => {
    if (!selectedGroup) return;
    runAction(`remove-gift-${ideaId}`, async () => {
      const response = await apiClient.removeDevGiftIdea(selectedGroup.id, ideaId);
      if (response.error || !response.data) throw new Error(response.error || 'Failed to remove gift idea');
      return response.data.state;
    }, 'Gift idea removed');
  };

  const assignGroup = () => {
    if (!selectedGroup) return;
    runAction('assign', async () => {
      const response = await apiClient.assignDevGroup(selectedGroup.id);
      if (response.error || !response.data) throw new Error(response.error || 'Failed to assign group');
      return response.data.state;
    }, 'Assignments created');
  };

  const unassignGroup = () => {
    if (!selectedGroup) return;
    runAction('unassign', async () => {
      const response = await apiClient.unassignDevGroup(selectedGroup.id);
      if (response.error || !response.data) throw new Error(response.error || 'Failed to reset assignments');
      return response.data.state;
    }, 'Assignments reset');
  };

  const toggleMemberId = (nextMemberId: number) => {
    setMemberIds((currentIds) => (
      currentIds.includes(nextMemberId)
        ? currentIds.filter((currentId) => currentId !== nextMemberId)
        : [...currentIds, nextMemberId]
    ));
  };

  if (loading) {
    return (
      <section className="overview-screen dev-admin-screen">
        <div className="overview-content">
          <div className="app-loading-card"><span className="spinner" /></div>
        </div>
      </section>
    );
  }

  return (
    <section className="overview-screen dev-admin-screen">
      <header className="overview-page-header">
        <div>
          <h1>Dev Admin</h1>
          <p>Create test data and force group states for local QA.</p>
        </div>
        <button className="secondary-button compact" type="button" onClick={loadState} disabled={Boolean(busyAction)}>
          Refresh
        </button>
      </header>

      <div className="overview-content dev-admin-content">
        <section className="dev-admin-panel dev-admin-accounts">
          <div className="dev-panel-heading">
            <h2>Testing Accounts</h2>
            <button className="primary-button compact" type="button" onClick={createTestAccounts} disabled={Boolean(busyAction)}>
              {busyAction === 'test-accounts' ? 'Creating...' : 'Create Accounts'}
            </button>
          </div>
          <div className="dev-account-grid">
            {(state?.test_accounts || []).map((account) => (
              <article className="dev-account-card" key={account.email}>
                <strong>@{account.username}</strong>
                <span>{account.email}</span>
                <small>{account.password}</small>
              </article>
            ))}
          </div>
        </section>

        <form className="dev-admin-panel dev-create-group" onSubmit={createGroup}>
          <div className="dev-panel-heading">
            <h2>Create Group</h2>
            <button className="primary-button compact" type="submit" disabled={!canCreateGroup || Boolean(busyAction)}>
              {busyAction === 'create-group' ? 'Creating...' : 'Create'}
            </button>
          </div>
          <label>
            <span>Group name</span>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} />
          </label>
          <label>
            <span>Owner</span>
            <select value={ownerId} onChange={(event) => setOwnerId(event.target.value ? Number(event.target.value) : '')}>
              <option value="">Choose owner</option>
              {users.map((user) => <option key={user.id} value={user.id}>@{user.username}</option>)}
            </select>
          </label>
          <div className="dev-check-list" aria-label="Initial members">
            {users.filter((user) => user.id !== ownerId).map((user) => (
              <label className="dev-check-row" key={user.id}>
                <input
                  type="checkbox"
                  checked={memberIds.includes(user.id)}
                  onChange={() => toggleMemberId(user.id)}
                />
                <span>@{user.username}</span>
              </label>
            ))}
          </div>
        </form>

        <section className="dev-admin-panel dev-group-workbench">
          <div className="dev-panel-heading">
            <h2>Group Workbench</h2>
            <span>{selectedGroup ? `${selectedGroup.members.length} members` : 'No group selected'}</span>
          </div>
          <label>
            <span>Group</span>
            <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value ? Number(event.target.value) : '')}>
              <option value="">Choose group</option>
              {(state?.groups || []).map((group) => (
                <option key={group.id} value={group.id}>{group.name} (@{group.owner_username})</option>
              ))}
            </select>
          </label>

          {selectedGroup ? (
            <div className="dev-workbench-grid">
              <section className="dev-workbench-section">
                <div className="dev-section-title-row">
                  <h3>Members</h3>
                  <div className="dev-inline-action">
                    <select value={memberToAddId} onChange={(event) => setMemberToAddId(event.target.value ? Number(event.target.value) : '')}>
                      <option value="">Add user</option>
                      {availableMembers.map((user) => <option key={user.id} value={user.id}>@{user.username}</option>)}
                    </select>
                    <button className="secondary-button compact" type="button" onClick={addMember} disabled={!memberToAddId || Boolean(busyAction)}>Add</button>
                  </div>
                </div>
                <div className="dev-list">
                  {selectedGroupMembers.map((member) => (
                    <article className="dev-list-row" key={member.id}>
                      <div>
                        <strong>@{member.username}</strong>
                        <small>{member.role}</small>
                      </div>
                      {member.role !== 'owner' && (
                        <button className="link-button danger-text" type="button" onClick={() => removeMember(member.id)} disabled={Boolean(busyAction)}>
                          Remove
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="dev-workbench-section">
                <div className="dev-section-title-row">
                  <h3>Assignments</h3>
                  <div className="button-row">
                    <button className="secondary-button compact" type="button" onClick={assignGroup} disabled={selectedGroup.members.length < 3 || Boolean(busyAction)}>
                      Draw
                    </button>
                    <button className="secondary-button compact" type="button" onClick={unassignGroup} disabled={selectedGroup.assignments.length === 0 || Boolean(busyAction)}>
                      Reset
                    </button>
                  </div>
                </div>
                {selectedGroup.assignments.length === 0 ? (
                  <p className="empty-inline">No assignments</p>
                ) : (
                  <div className="dev-list">
                    {selectedGroup.assignments.map((assignment) => (
                      <article className="dev-list-row" key={assignment.giver_id}>
                        <strong>@{assignment.giver_username}</strong>
                        <span>@{assignment.receiver_username}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="dev-workbench-section dev-gift-section">
                <div className="dev-section-title-row">
                  <h3>Gift Ideas</h3>
                </div>
                <form className="dev-gift-form" onSubmit={addGiftIdea}>
                  <select value={giftForUserId} onChange={(event) => setGiftForUserId(event.target.value ? Number(event.target.value) : '')}>
                    <option value="">For</option>
                    {selectedGroupMembers.map((member) => <option key={member.id} value={member.id}>for @{member.username}</option>)}
                  </select>
                  <select value={giftCreatedById} onChange={(event) => setGiftCreatedById(event.target.value ? Number(event.target.value) : '')}>
                    <option value="">Creator</option>
                    {selectedGroupMembers.map((member) => <option key={member.id} value={member.id}>by @{member.username}</option>)}
                  </select>
                  <input value={giftIdea} onChange={(event) => setGiftIdea(event.target.value)} placeholder="Gift idea" />
                  <input value={giftLink} onChange={(event) => setGiftLink(event.target.value)} placeholder="https://..." />
                  <button className="secondary-button compact" type="submit" disabled={!canAddGiftIdea || Boolean(busyAction)}>Add Idea</button>
                </form>
                {selectedGroup.gift_ideas.length === 0 ? (
                  <p className="empty-inline">No gift ideas</p>
                ) : (
                  <div className="dev-list">
                    {selectedGroup.gift_ideas.map((idea) => (
                      <article className="dev-list-row" key={idea.id}>
                        <div>
                          <strong>{idea.idea}</strong>
                          <small>for @{idea.for_user_username} by @{idea.created_by_username}</small>
                        </div>
                        <button className="link-button danger-text" type="button" onClick={() => removeGiftIdea(idea.id)} disabled={Boolean(busyAction)}>
                          Remove
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <p className="empty-inline">Create or select a group to start testing.</p>
          )}
        </section>
      </div>
    </section>
  );
}
