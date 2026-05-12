import React, { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';

interface LoginScreenProps {
  onSwitchToSignup: () => void;
  friendInviteMode?: boolean;
}

export default function LoginScreen({ onSwitchToSignup, friendInviteMode = false }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(true);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { requestSignInLink, signInWithPassword } = useAuth();

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      window.alert('Please enter your email address');
      return;
    }

    if (usePassword && !password) {
      window.alert('Please enter your password');
      return;
    }

    setLoading(true);
    if (usePassword) {
      const { error } = await signInWithPassword(email.trim(), password);
      setLoading(false);
      if (error) {
        window.alert(error.message);
      }
      return;
    }

    const trimmedEmail = email.trim();
    const { error, devMagicLink, expiresInMinutes } = await requestSignInLink(trimmedEmail);
    setLoading(false);
    if (error) {
      window.alert(error.message);
      return;
    }

    {
      setSent(true);
      setSentEmail(trimmedEmail);
      setExpiresInMinutes(expiresInMinutes || null);
      setDevMagicLink(devMagicLink || null);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (sent) {
      setSent(false);
      setSentEmail('');
      setExpiresInMinutes(null);
      setDevMagicLink(null);
    }
  };

  const togglePasswordMode = () => {
    setUsePassword((value) => !value);
    setSent(false);
    setSentEmail('');
    setExpiresInMinutes(null);
    setDevMagicLink(null);
  };

  const startGoogleLogin = () => {
    window.location.href = apiClient.getGoogleOAuthUrl('login');
  };

  return (
    <section className="auth-screen">
      <form className="auth-card login-card" onSubmit={handleLogin}>
        <div className="auth-brand-panel">
          <div className="auth-hero-image" aria-hidden="true">
            <img src="/geschenk-detailed.png" alt="" />
          </div>
          <div className="auth-heading">
            <p>Welcome to</p>
            <h1>Geschenk</h1>
            <span>
              {friendInviteMode
                ? 'Sign in to accept the friend request and add each other on Geschenk.'
                : 'The simple way to organize Secret Santa with friends and family.'}
            </span>
          </div>
        </div>

        <div className="auth-form-panel">
          <button className="oauth-button" type="button" onClick={startGoogleLogin} disabled={loading}>
            <span aria-hidden="true">G</span>
            Continue with Google
          </button>

          <div className="auth-divider"><span>or</span></div>

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => handleEmailChange(event.target.value)}
              autoCapitalize="none"
              autoComplete="email"
              disabled={loading}
            />
          </label>

          {usePassword && (
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </label>
          )}

          {sent && (
            <div className="auth-message">
              <strong>Check your email</strong>
              <span>
                We sent a sign-in link to {sentEmail}.
                {expiresInMinutes ? ` It expires in ${expiresInMinutes} minutes.` : ''}
              </span>
              {devMagicLink && <a href={devMagicLink}>Open dev sign-in link</a>}
            </div>
          )}

          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? (usePassword ? 'Signing in...' : 'Sending...') : (usePassword ? 'Sign In' : sent ? 'Resend Sign-In Link' : 'Send Sign-In Link')}
          </button>

          <button className="link-button auth-mode-button" type="button" onClick={togglePasswordMode}>
            {usePassword ? 'Use a sign-in link instead' : 'Use password instead'}
          </button>

          <div className="auth-footer">
            <span>Don't have an account?</span>
            <button type="button" className="link-button" onClick={onSwitchToSignup}>
              Sign Up
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
