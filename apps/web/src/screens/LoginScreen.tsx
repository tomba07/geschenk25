import React, { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onSwitchToSignup: () => void;
}

export default function LoginScreen({ onSwitchToSignup }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!username || !password) {
      window.alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) window.alert(error.message);
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
            <span>The simple way to organize Secret Santa with friends and family.</span>
          </div>
        </div>

        <div className="auth-form-panel">
          <label className="auth-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoComplete="username"
              disabled={loading}
            />
          </label>

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

          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
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
