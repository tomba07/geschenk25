import React, { useCallback, useEffect, useState } from 'react';
import { Friend, apiClient } from '../lib/api';
import { confirmDestructive } from '../utils/confirm';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkLoading, setInviteLinkLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    const response = await apiClient.getFriends();
    if (response.error) {
      setError(response.error);
      setFriends([]);
    } else {
      setError(null);
      setFriends(response.data?.friends || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const loadInviteLink = useCallback(async () => {
    if (inviteLink) return;

    setInviteLinkLoading(true);
    const response = await apiClient.getFriendInviteLink();
    setInviteLinkLoading(false);
    if (response.error) {
      setError(response.error);
      return;
    }

    if (response.data) {
      setInviteLink(`${window.location.origin}/join/${response.data.invite_token}`);
    }
  }, [inviteLink]);

  useEffect(() => {
    loadInviteLink();
  }, [loadInviteLink]);

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;

    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
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
        return;
      }

      setError(null);
      setFriends((currentFriends) => currentFriends.filter((currentFriend) => currentFriend.id !== friend.id));
    });
  };

  return (
    <section className="overview-screen friends-screen">
      <div className="overview-main">
        <header className="overview-page-header">
          <div>
            <h1>Friends</h1>
            <p>People you can add directly to your gift exchange groups.</p>
          </div>
        </header>

        <div className="overview-content friends-content">
          <section className="friends-invite-card">
            <div>
              <h2>Friend link</h2>
              <p>Share this link with someone once. After that, you can add each other to groups directly.</p>
            </div>
            {inviteLinkLoading ? (
              <div className="copy-field">
                <input value="Loading friend link..." readOnly />
              </div>
            ) : inviteLink ? (
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
              <p className="form-error">Could not load your friend link.</p>
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
                  <div className="group-image">
                    {friend.image_url ? <img src={friend.image_url} alt="" /> : <span>{friend.username.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="overview-group-card-body">
                    <h3>@{friend.username}</h3>
                    <div className="overview-group-meta">
                      <span>Friend</span>
                      {friend.created_at && (
                        <span>{new Date(friend.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
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
    </section>
  );
}
