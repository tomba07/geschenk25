import React, { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface SignupScreenProps {
  onSwitchToLogin: () => void;
}

export default function SignupScreen({ onSwitchToLogin }: SignupScreenProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [sent, setSent] = useState(false);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { requestSignUpLink } = useAuth();

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();

    if (!email || !username) {
      window.alert('Please fill in all required fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      window.alert('Please enter a valid email address');
      return;
    }
    if (username.length < 3) {
      window.alert('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      window.alert('Username can only contain letters, numbers, and underscores');
      return;
    }
    setLoading(true);
    const { error, devMagicLink } = await requestSignUpLink(email.trim(), username);
    setLoading(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    setSent(true);
    setDevMagicLink(devMagicLink || null);
  };

  return (
    <section className="auth-screen">
      <form className="auth-card signup-card" onSubmit={handleSignup}>
        <div className="auth-brand-panel">
          <div className="auth-hero-image" aria-hidden="true">
            <img src="/geschenk-detailed.png" alt="" />
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-heading">
            <h2>Create account</h2>
          </div>

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoCapitalize="none"
              autoComplete="email"
              disabled={loading}
              required
            />
          </label>

          <label className="auth-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoComplete="username"
              disabled={loading}
              required
            />
          </label>

          {sent && (
            <div className="auth-message">
              <strong>Check your email</strong>
              <span>We sent you a link to finish creating your account.</span>
              {devMagicLink && <a href={devMagicLink}>Open dev sign-in link</a>}
            </div>
          )}

          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Sign-Up Link'}
          </button>

          <div className="auth-footer">
            <span>Already have an account?</span>
            <button type="button" className="link-button" onClick={onSwitchToLogin}>
              Sign In
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
