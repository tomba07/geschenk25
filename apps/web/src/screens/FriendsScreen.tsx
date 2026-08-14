import React, { useCallback, useEffect, useState } from 'react';
import { Friend, FriendRequest, FriendSearchResult, apiClient } from '../lib/api';
import { confirmDestructive } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';
import { notifyFriendRequestsUpdated } from '../utils/friendRequests';
import { showErrorToast, showInfoToast, showSuccessToast } from '../utils/toast';

export default function FriendsScreen() {
  const { username } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inviteLink = username ? `${window.location.origin}/plsbemyfriend/${encodeURIComponent(username)}` : '';

  const loadFriends = useCallback(async () => {
    setLoading(true);
    const [friendsResponse, requestsResponse] = await Promise.all([
      apiClient.getFriends(),
      apiClient.getFriendRequests(),
    ]);

    if (friendsResponse.error) {
      setError(friendsResponse.error);
      setFriends([]);
    } else {
      setError(null);
      setFriends(friendsResponse.data?.friends || []);
    }

    if (requestsResponse.error) {
      setError(requestsResponse.error);
      setIncomingRequests([]);
      setOutgoingRequests([]);
    } else {
      setIncomingRequests(requestsResponse.data?.incoming || []);
      setOutgoingRequests(requestsResponse.data?.outgoing || []);
      notifyFriendRequestsUpdated();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!addFriendOpen) return undefined;

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timeout = window.setTimeout(async () => {
      const response = await apiClient.searchFriends(query);
      if (cancelled) return;
      setSearching(false);
      if (response.error) {
        setError(response.error);
        setSearchResults([]);
        return;
      }
      setError(null);
      setSearchResults(response.data?.users || []);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [addFriendOpen, searchQuery]);

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;

    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    showSuccessToast('Friend link copied');
    window.setTimeout(() => setCopied(false), 1800);
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

  const handleUnfriend = (friend: Friend) => {
    confirmDestructive('Unfriend', `Remove @${friend.username} from your friends?`, 'Remove', async () => {
      const response = await apiClient.removeFriend(friend.id);
      if (response.error) {
        setError(response.error);
        showErrorToast(response.error);
        return;
      }

      setError(null);
      setFriends((currentFriends) => currentFriends.filter((currentFriend) => currentFriend.id !== friend.id));
      showInfoToast(`@${friend.username} removed from friends`);
    });
  };

  const refreshSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    const response = await apiClient.searchFriends(query);
    if (!response.error) setSearchResults(response.data?.users || []);
  };

  const handleSendRequest = async (user: FriendSearchResult) => {
    setRequestBusyId(user.id);
    const response = await apiClient.sendFriendRequest(user.id);
    setRequestBusyId(null);
    if (response.error) {
      setError(response.error);
      showErrorToast(response.error);
      return;
    }
    setError(null);
    await Promise.all([loadFriends(), refreshSearch()]);
    showSuccessToast(`Friend request sent to @${user.username}`);
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    setRequestBusyId(request.user_id);
    const response = await apiClient.acceptFriendRequest(request.id);
    setRequestBusyId(null);
    if (response.error) {
      setError(response.error);
      showErrorToast(response.error);
      return;
    }
    setError(null);
    await Promise.all([loadFriends(), refreshSearch()]);
    showSuccessToast(`@${request.username} added as friend`);
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    setRequestBusyId(request.user_id);
    const response = await apiClient.declineFriendRequest(request.id);
    setRequestBusyId(null);
    if (response.error) {
      setError(response.error);
      showErrorToast(response.error);
      return;
    }
    setError(null);
    await Promise.all([loadFriends(), refreshSearch()]);
    showInfoToast('Friend request declined');
  };

  const renderPersonAvatar = (person: { username: string; image_url?: string | null }) => (
    <div className="group-image">
      {person.image_url ? <img src={person.image_url} alt="" /> : <span>{person.username.charAt(0).toUpperCase()}</span>}
    </div>
  );

  const renderSearchAction = (user: FriendSearchResult) => {
    if (user.friendship_status === 'friend') return <span className="friend-status-label">Friend</span>;
    if (user.friendship_status === 'outgoing_pending') return <span className="friend-status-label">Sent</span>;
    if (user.friendship_status === 'incoming_pending') return <span className="friend-status-label">Request received</span>;
    return (
      <button className="primary-button compact" type="button" onClick={() => handleSendRequest(user)} disabled={requestBusyId === user.id}>
        {requestBusyId === user.id ? 'Sending...' : 'Add Friend'}
      </button>
    );
  };

  return (
    <section className="overview-screen friends-screen">
      <div className="overview-main">
        <header className="overview-page-header">
          <div>
            <h1>Friends</h1>
            <p>People you can add directly to your gift exchange groups.</p>
          </div>
          <button className="primary-button" type="button" onClick={() => setAddFriendOpen(true)}>
            + Add Friend
          </button>
        </header>

        <div className="overview-content friends-content">
          {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
            <section className="friends-invite-card">
              <div>
                <h2>Friend requests</h2>
                <p>Accept requests from people you know, or wait for sent requests to be accepted.</p>
              </div>
              {incomingRequests.length > 0 && (
                <div className="friends-list">
                  {incomingRequests.map((request) => (
                    <article className="overview-group-card friend-card" key={request.id}>
                      {renderPersonAvatar(request)}
                      <div className="overview-group-card-body">
                        <h3>@{request.username}</h3>
                        <div className="overview-group-meta">
                          <span>Wants to be friends</span>
                        </div>
                      </div>
                      <div className="friend-request-actions">
                        <button className="primary-button compact" type="button" onClick={() => handleAcceptRequest(request)} disabled={requestBusyId === request.user_id}>Accept</button>
                        <button className="secondary-button compact" type="button" onClick={() => handleDeclineRequest(request)} disabled={requestBusyId === request.user_id}>Decline</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {outgoingRequests.length > 0 && (
                <div className="friends-list">
                  {outgoingRequests.map((request) => (
                    <article className="overview-group-card friend-card" key={request.id}>
                      {renderPersonAvatar(request)}
                      <div className="overview-group-card-body">
                        <h3>@{request.username}</h3>
                        <div className="overview-group-meta">
                          <span>Request sent</span>
                          <span>{new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <span className="friend-status-label">Pending</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="friends-invite-card">
            <div>
              <h2>Friend link</h2>
              <p>Share this link with someone once. After that, you can add each other to groups directly.</p>
            </div>
            {inviteLink ? (
              <div className="friends-link-actions">
                <div className="copy-field">
                  <input value={inviteLink} readOnly />
                  <button className="primary-button compact" type="button" onClick={handleCopyInviteLink}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button className="secondary-button" type="button" onClick={handleShareInviteLink}>
                  Share Link
                </button>
              </div>
            ) : (
              <p className="form-error">Finish your profile before sharing a friend link.</p>
            )}
          </section>

          {error && <p className="form-error">{error}</p>}

          {loading ? (
            <section className="friends-list">
              {Array.from({ length: 4 }).map((_, index) => (
                <article className="overview-group-card overview-skeleton-card" key={index}>
                  <span className="skeleton-avatar overview-skeleton-avatar" />
                  <span className="skeleton-stack">
                    <span className="skeleton-line wide" />
                    <span className="skeleton-line short" />
                  </span>
                </article>
              ))}
            </section>
          ) : friends.length === 0 ? (
            <div className="overview-empty-state">
              <div className="empty-icon">F</div>
              <h2>No friends yet</h2>
              <p>Share your friend link with someone you want to invite to groups.</p>
            </div>
          ) : (
            <section className="friends-list">
              {friends.map((friend) => (
                <article className="overview-group-card friend-card" key={friend.id}>
                  {renderPersonAvatar(friend)}
                  <div className="overview-group-card-body">
                    <h3>@{friend.username}</h3>
                  </div>
                  <button className="link-button danger-text friend-remove-button" type="button" onClick={() => handleUnfriend(friend)}>
                    Unfriend
                  </button>
                </article>
              ))}
            </section>
          )}
        </div>
      </div>

      {addFriendOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel friend-add-dialog">
            <header>
              <h2>Add Friend</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setAddFriendOpen(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="friend-search-box">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search username"
                autoCapitalize="none"
                autoComplete="off"
                autoFocus
              />
              {searching && <span>Searching...</span>}
            </div>
            {searchQuery.trim() && !searching && searchResults.length === 0 && (
              <p className="empty-inline">No users found.</p>
            )}
            {searchResults.length > 0 && (
              <div className="friends-list">
                {searchResults.map((user) => (
                  <article className="overview-group-card friend-card" key={user.id}>
                    {renderPersonAvatar(user)}
                    <div className="overview-group-card-body">
                      <h3>@{user.username}</h3>
                      <div className="overview-group-meta">
                        <span>User</span>
                      </div>
                    </div>
                    {renderSearchAction(user)}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
