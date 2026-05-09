import React, { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface InviteLandingScreenProps {
  username: string;
  onContinueWeb: () => void;
  onPrepareAuth: () => void;
  onSwitchToSignup: () => void;
}

interface InviteUser {
  id: number;
  username: string;
  image_url?: string | null;
}

export default function InviteLandingScreen({ username, onContinueWeb, onPrepareAuth, onSwitchToSignup }: InviteLandingScreenProps) {
  const { isAuthenticated, requestSignInLink, signInWithPassword } = useAuth();
  const [inviter, setInviter] = useState<InviteUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      setLoading(true);
      const response = await apiClient.getFriendInviteByUsername(username);
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
  }, [username]);

  const initial = (inviter?.username || 'G').charAt(0).toUpperCase();

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setAuthError('Please enter your email address');
      return;
    }

    if (usePassword && !password) {
      setAuthError('Please enter your password');
      return;
    }

    onPrepareAuth();
    setAuthLoading(true);
    setAuthError(null);

    if (usePassword) {
      const { error } = await signInWithPassword(email.trim(), password);
      setAuthLoading(false);
      if (error) setAuthError(error.message);
      return;
    }

    const trimmedEmail = email.trim();
    const { error, devMagicLink, expiresInMinutes } = await requestSignInLink(trimmedEmail);
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      return;
    }

    setSentEmail(trimmedEmail);
    setExpiresInMinutes(expiresInMinutes || null);
    setDevMagicLink(devMagicLink || null);
  };

  const handleSignup = () => {
    onPrepareAuth();
    onSwitchToSignup();
  };

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

              {isAuthenticated ? (
                <button className="primary-button auth-submit" type="button" onClick={onContinueWeb}>
                  Accept Friend Request
                </button>
              ) : !showLogin ? (
                <button
                  className="primary-button auth-submit"
                  type="button"
                  onClick={() => {
                    onPrepareAuth();
                    setShowLogin(true);
                  }}
                >
                  Continue
                </button>
              ) : (
                <form className="invite-login-panel" onSubmit={handleLogin}>
                  <label className="auth-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setSentEmail('');
                        setDevMagicLink(null);
                        setAuthError(null);
                      }}
                      autoCapitalize="none"
                      autoComplete="email"
                      disabled={authLoading}
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
                        disabled={authLoading}
                      />
                    </label>
                  )}

                  {sentEmail && (
                    <div className="auth-message">
                      <strong>Check your email</strong>
                      <span>
                        We sent a sign-in link to {sentEmail}.
                        {expiresInMinutes ? ` It expires in ${expiresInMinutes} minutes.` : ''}
                      </span>
                      {devMagicLink && <a href={devMagicLink}>Open dev sign-in link</a>}
                    </div>
                  )}

                  {authError && <p className="form-error">{authError}</p>}

                  <button className="primary-button auth-submit" type="submit" disabled={authLoading}>
                    {authLoading ? (usePassword ? 'Signing in...' : 'Sending...') : (usePassword ? 'Sign In and Accept' : sentEmail ? 'Resend Sign-In Link' : 'Send Sign-In Link')}
                  </button>

                  <button
                    className="link-button auth-mode-button"
                    type="button"
                    onClick={() => {
                      setUsePassword((value) => !value);
                      setSentEmail('');
                      setDevMagicLink(null);
                      setAuthError(null);
                    }}
                  >
                    {usePassword ? 'Use a sign-in link instead' : 'Use password instead'}
                  </button>

                  <div className="auth-footer">
                    <span>Don't have an account?</span>
                    <button type="button" className="link-button" onClick={handleSignup}>
                      Sign Up
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
