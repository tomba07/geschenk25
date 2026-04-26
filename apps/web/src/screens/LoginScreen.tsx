import React, { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onSwitchToSignup: () => void;
}

export default function LoginScreen({ onSwitchToSignup }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      window.alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
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
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoCapitalize="none"
              autoComplete="email"
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
