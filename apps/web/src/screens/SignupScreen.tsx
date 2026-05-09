import React, { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface SignupScreenProps {
  onSwitchToLogin: () => void;
}

export default function SignupScreen({ onSwitchToLogin }: SignupScreenProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { requestSignUpLink } = useAuth();

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();

    if (!email) {
      window.alert('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      window.alert('Please enter a valid email address');
      return;
    }
    setLoading(true);
    const trimmedEmail = email.trim();
    const { error, devMagicLink, expiresInMinutes } = await requestSignUpLink(trimmedEmail);
    setLoading(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    setSent(true);
    setSentEmail(trimmedEmail);
    setExpiresInMinutes(expiresInMinutes || null);
    setDevMagicLink(devMagicLink || null);
  };

  const resetSentState = () => {
    if (!sent) return;
    setSent(false);
    setSentEmail('');
    setExpiresInMinutes(null);
    setDevMagicLink(null);
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
              onChange={(event) => {
                setEmail(event.target.value);
                resetSentState();
              }}
              autoCapitalize="none"
              autoComplete="email"
              disabled={loading}
              required
            />
          </label>

          {sent && (
            <div className="auth-message">
              <strong>Check your email</strong>
              <span>
                We sent a link to {sentEmail}.
                {expiresInMinutes ? ` It expires in ${expiresInMinutes} minutes.` : ''}
              </span>
              {devMagicLink && <a href={devMagicLink}>Open dev sign-in link</a>}
            </div>
          )}

          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? 'Sending...' : sent ? 'Resend Verification Link' : 'Verify Email'}
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
