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
              The simple way to organize Secret Santa
            </div>
            <h1>Stress-free gift exchanges for everyone</h1>
            <p>Create groups, set exclusions, draw names, and share wish lists. Everything you need for the perfect gift exchange.</p>
            <div className="landing-hero-actions">
              <button className="landing-primary-button large" type="button" onClick={onSignup}>
                Get started for free
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <ul className="landing-proof-list" aria-label="Benefits">
              <li>No credit card required</li>
              <li>Free forever plan</li>
              <li>Works on all devices</li>
            </ul>
          </div>

          <div className="landing-hero-art" aria-hidden="true">
            <img src="/geschenk-detailed.png" alt="" />
          </div>
        </section>

      </main>
    </section>
  );
}
