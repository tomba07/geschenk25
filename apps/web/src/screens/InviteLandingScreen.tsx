import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

interface InviteLandingScreenProps {
  token: string;
  onContinueWeb: () => void;
}

interface InviteGroup {
  id: number;
  name: string;
  description?: string;
  image_url?: string | null;
  member_count: number;
}

export default function InviteLandingScreen({ token, onContinueWeb }: InviteLandingScreenProps) {
  const [group, setGroup] = useState<InviteGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      setLoading(true);
      const response = await apiClient.getGroupByInviteToken(token);
      if (cancelled) return;

      if (response.error || !response.data) {
        setError(response.error || 'This invite link is invalid.');
        setGroup(null);
      } else {
        setError(null);
        setGroup(response.data.group);
      }

      setLoading(false);
    }

    loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const initial = (group?.name || 'G').charAt(0).toUpperCase();

  return (
    <section className="auth-screen invite-landing-screen">
      <div className="auth-card invite-landing-card">
        <div className="auth-brand-panel invite-landing-art">
          <div className="auth-hero-image" aria-hidden="true">
            <img src="/geschenk-detailed.png" alt="" />
          </div>
        </div>

        <div className="auth-form-panel">
          {loading ? (
            <div className="app-loading-card inline-loading">
              <span className="spinner" />
            </div>
          ) : error ? (
            <>
              <div className="auth-form-heading">
                <h2>Invite unavailable</h2>
                <p>{error}</p>
              </div>
              <a className="primary-button auth-submit" href="/">
                Go to Geschenk
              </a>
            </>
          ) : group ? (
            <>
              <div className="invite-preview">
                <div className="group-image large">
                  {group.image_url ? <img src={group.image_url} alt="" /> : <span>{initial}</span>}
                </div>
                <div>
                  <span>Group invite</span>
                  <h1>{group.name}</h1>
                  <p>
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>

              {group.description && <p className="invite-description">{group.description}</p>}

              <button className="primary-button auth-submit" type="button" onClick={onContinueWeb}>
                Continue to Join
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
