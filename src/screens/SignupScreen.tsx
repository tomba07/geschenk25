import React, { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface SignupScreenProps {
  onSwitchToLogin: () => void;
}

export default function SignupScreen({ onSwitchToLogin }: SignupScreenProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();

    if (!username || !password || !confirmPassword) {
      window.alert('Please fill in all required fields');
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
    if (password !== confirmPassword) {
      window.alert('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      window.alert('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await signUp(username, password, displayName.trim() || undefined);
    setLoading(false);

    if (error) {
      window.alert(error.message);
    }
  };

  return (
    <section className="auth-screen">
      <form className="auth-card" onSubmit={handleSignup}>
        <div className="brand-mark">G</div>
        <h1>Sign Up</h1>
        <p>Create a new account</p>

        <label>
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

        <label>
          <span>Display Name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
          />
        </label>

        <label>
          <span>Confirm Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Sign Up'}
        </button>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <button type="button" className="link-button" onClick={onSwitchToLogin}>
            Sign In
          </button>
        </div>
      </form>
    </section>
  );
}
