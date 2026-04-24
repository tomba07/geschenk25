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
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="brand-mark">G</div>
        <h1>Login</h1>
        <p>Sign in to continue</p>

        <label>
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            disabled={loading}
          />
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="auth-footer">
          <span>Don't have an account?</span>
          <button type="button" className="link-button" onClick={onSwitchToSignup}>
            Sign Up
          </button>
        </div>
      </form>
    </section>
  );
}
