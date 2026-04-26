import React from 'react';

interface LandingScreenProps {
  onLogin: () => void;
  onSignup: () => void;
}

export default function LandingScreen({ onLogin, onSignup }: LandingScreenProps) {
  return (
    <section className="landing-screen">
      <header className="landing-nav">
        <div className="landing-actions">
          <button className="landing-login-button" type="button" onClick={onLogin}>Log in</button>
          <button className="landing-primary-button" type="button" onClick={onSignup}>Sign up for free</button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="landing-pill">
              <span className="landing-pill-icon" aria-hidden="true">
                <img src="/snowflake.png" alt="" />
              </span>
              Create, invite, and draw names in minutes
            </div>
            <h1>Secret Santa, neatly organized</h1>
            <ol className="landing-steps-list" aria-label="How Geschenk works">
              <li>Create a group</li>
              <li>Invite friends and share gift ideas</li>
              <li>Draw names</li>
            </ol>
            <div className="landing-hero-actions">
              <button className="landing-primary-button large" type="button" onClick={onSignup}>
                Get started for free
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="landing-hero-art" aria-hidden="true">
            <img src="/geschenk-detailed.png" alt="" />
          </div>
        </section>

      </main>
    </section>
  );
}
