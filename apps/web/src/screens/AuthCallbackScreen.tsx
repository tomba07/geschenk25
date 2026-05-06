import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthCallbackScreenProps {
  token: string | null;
  onDone: () => void;
  onFailed: () => void;
}

const verificationRequests = new Map<string, Promise<{ error: any }>>();

export default function AuthCallbackScreen({ token, onDone, onFailed }: AuthCallbackScreenProps) {
  const { verifyMagicLink } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setError('This sign-in link is missing its token.');
        return;
      }

      let request = verificationRequests.get(token);
      if (!request) {
        request = verifyMagicLink(token);
        verificationRequests.set(token, request);
      }

      const result = await request;
      if (cancelled) return;

      if (result.error) {
        setError(result.error.message || 'This sign-in link is invalid or expired.');
        return;
      }

      onDone();
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [onDone, token, verifyMagicLink]);

  return (
    <section className="auth-screen">
      <div className="auth-card auth-callback-card">
        <div className="auth-form-panel">
          <div className="auth-form-heading">
            <h2>{error ? 'Link expired' : 'Signing you in'}</h2>
            <p>{error || 'One moment while we verify your sign-in link.'}</p>
          </div>
          {error ? (
            <button className="primary-button auth-submit" type="button" onClick={onFailed}>
              Request New Link
            </button>
          ) : (
            <div className="app-loading-card inline-loading">
              <span className="spinner" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
