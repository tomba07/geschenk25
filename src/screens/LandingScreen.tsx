import React from 'react';

interface LandingScreenProps {
  onLogin: () => void;
  onSignup: () => void;
}

const featureCards = [
  {
    icon: 'groups',
    title: 'Create groups',
    text: 'Set up your exchange in seconds and invite everyone.',
  },
  {
    icon: 'invite',
    title: 'Invite & manage',
    text: 'Add members, set exclusions, and keep plans organized.',
  },
  {
    icon: 'draw',
    title: 'Draw names',
    text: 'Assign Secret Santa matches privately and fairly.',
  },
  {
    icon: 'ideas',
    title: 'Share wish lists',
    text: 'Collect gift ideas so everyone has somewhere to start.',
  },
];

function LandingIcon({ name }: { name: string }) {
  return (
    <svg className="landing-feature-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      {name === 'groups' && (
        <>
          <path d="M8.5 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
          <path d="M15.75 10.5a2.75 2.75 0 1 0 0-5.5" />
          <path d="M2.75 19.5a5.75 5.75 0 0 1 11.5 0" />
          <path d="M14.75 14.25a5.25 5.25 0 0 1 6.5 5.25" />
        </>
      )}
      {name === 'invite' && (
        <>
          <path d="M4 7.5h16v10H4z" />
          <path d="m4 8 8 6 8-6" />
          <path d="M12 3.75 16 7.5H8l4-3.75Z" />
        </>
      )}
      {name === 'draw' && (
        <>
          <path d="M4.75 10.25h14.5v9H4.75z" />
          <path d="M12 10.25v9" />
          <path d="M3.75 7.25h16.5v3H3.75z" />
          <path d="M12 7.25c-2.2-3-5.5-2.6-5.5-.4 0 1.6 1.9 2.4 5.5.4Z" />
          <path d="M12 7.25c2.2-3 5.5-2.6 5.5-.4 0 1.6-1.9 2.4-5.5.4Z" />
        </>
      )}
      {name === 'ideas' && (
        <>
          <path d="M8 4.25h8" />
          <path d="M7.25 4.25h9.5v15.5h-9.5z" />
          <path d="M10 8.25h4" />
          <path d="M10 11.75h4" />
          <path d="M10 15.25h2.5" />
          <path d="m17 17.25 1.4 1.4 2.85-3.15" />
        </>
      )}
    </svg>
  );
}

export default function LandingScreen({ onLogin, onSignup }: LandingScreenProps) {
  return (
    <section className="landing-screen">
      <header className="landing-nav">
        <div className="landing-brand">
          <img src="/geschenk.png" alt="" aria-hidden="true" />
          <span>Geschenk</span>
        </div>
        <nav className="landing-links" aria-label="Landing page">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="landing-actions">
          <button className="landing-login-button" type="button" onClick={onLogin}>Log in</button>
          <button className="landing-primary-button" type="button" onClick={onSignup}>Sign up for free</button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="landing-pill">
              <span aria-hidden="true">✣</span>
              The simple way to organize Secret Santa
            </div>
            <h1>Stress-free gift exchanges for everyone</h1>
            <p>Create groups, set exclusions, draw names, and share wish lists. Everything you need for the perfect gift exchange.</p>
            <div className="landing-hero-actions">
              <button className="landing-primary-button large" type="button" onClick={onSignup}>
                Get started for free
                <span aria-hidden="true">→</span>
              </button>
              <a className="landing-secondary-button" href="#how-it-works">
                See how it works
                <span aria-hidden="true">▶</span>
              </a>
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

        <section className="landing-feature-panel" id="features" aria-label="Features">
          {featureCards.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <div className="landing-feature-badge">
                <LandingIcon name={feature.icon} />
              </div>
              <div>
                <h2>{feature.title}</h2>
                <p>{feature.text}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="landing-trust" id="how-it-works">
          <strong>Made for small, happy gift exchanges</strong>
          <span aria-label="Rating">★★★★★</span>
          <p>Simple setup, private assignments, and shared ideas for every group.</p>
        </section>
      </main>
    </section>
  );
}
