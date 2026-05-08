import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

interface InviteLandingScreenProps {
  token: string;
  onContinueWeb: () => void;
}

interface InviteUser {
  id: number;
  username: string;
  image_url?: string | null;
}

export default function InviteLandingScreen({ token, onContinueWeb }: InviteLandingScreenProps) {
  const [inviter, setInviter] = useState<InviteUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      setLoading(true);
      const response = await apiClient.getFriendInviteByToken(token);
      if (cancelled) return;

      if (response.error || !response.data) {
        setError(response.error || 'This invite link is invalid.');
        setInviter(null);
      } else {
        setError(null);
        setInviter(response.data.user);
      }

      setLoading(false);
    }

    loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const initial = (inviter?.username || 'G').charAt(0).toUpperCase();

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
          ) : inviter ? (
            <>
              <div className="invite-preview">
                <div className="group-image large">
                  {inviter.image_url ? <img src={inviter.image_url} alt="" /> : <span>{initial}</span>}
                </div>
                <span>Friend invite</span>
                <h1>@{inviter.username}</h1>
                <p>Add each other as friends on Geschenk.</p>
              </div>

              <button className="primary-button auth-submit" type="button" onClick={onContinueWeb}>
                Continue
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
