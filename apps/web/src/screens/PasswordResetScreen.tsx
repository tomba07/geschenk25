import React, { FormEvent, useState } from 'react';
import { apiClient } from '../lib/api';
import { showErrorToast, showSuccessToast } from '../utils/toast';

interface PasswordResetScreenProps {
  token: string | null;
  onDone: () => void;
}

export default function PasswordResetScreen({ token, onDone }: PasswordResetScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();

    if (!token) {
      showErrorToast('Password reset link is missing or invalid');
      return;
    }

    if (password.length < 6) {
      showErrorToast('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      showErrorToast('Passwords do not match');
      return;
    }

    setLoading(true);
    const response = await apiClient.confirmPasswordReset(token, password);
    setLoading(false);

    if (response.error) {
      showErrorToast(response.error);
      return;
    }

    setComplete(true);
    setPassword('');
    setConfirmPassword('');
    showSuccessToast('Password reset successfully');
  };

  return (
    <section className="auth-screen">
      <form className="auth-card login-card password-reset-card" onSubmit={submitReset}>
        <div className="auth-brand-panel">
          <div className="auth-hero-image" aria-hidden="true">
            <img src="/geschenk-detailed.png" alt="" />
          </div>
          <div className="auth-heading">
            <p>Geschenk</p>
            <h1>Reset Password</h1>
            <span>Choose a new password for your account.</span>
          </div>
        </div>

        <div className="auth-form-panel">
          {complete ? (
            <>
              <div className="auth-message">
                <strong>Password updated</strong>
                <span>You can now sign in with your new password.</span>
              </div>
              <button className="primary-button auth-submit" type="button" onClick={onDone}>
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              {!token && (
                <div className="auth-message auth-message-warning">
                  <strong>Invalid link</strong>
                  <span>This password reset link is missing a token. Request a new reset email.</span>
                </div>
              )}

              <label className="auth-field">
                <span>New Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={loading || !token}
                />
              </label>

              <label className="auth-field">
                <span>Confirm Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={loading || !token}
                />
              </label>

              <button className="primary-button auth-submit" type="submit" disabled={loading || !token}>
                {loading ? 'Saving...' : 'Reset Password'}
              </button>
              <button className="link-button auth-mode-button" type="button" onClick={onDone}>
                Back to Sign In
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
