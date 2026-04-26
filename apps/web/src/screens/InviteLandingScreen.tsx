import React from 'react';

interface InviteLandingScreenProps {
  token: string;
  onContinueWeb: () => void;
}

export default function InviteLandingScreen({ token, onContinueWeb }: InviteLandingScreenProps) {
  return (
    <section className="auth-screen">
      <div className="auth-card">
        <div className="brand-mark">G</div>
        <h1>Join Secret Santa Group</h1>
        <p>This invite opens directly in the web app.</p>
        <button className="primary-button" type="button" onClick={onContinueWeb}>
          Continue
        </button>
        <small className="muted">Invite token: {token}</small>
      </div>
    </section>
  );
}
