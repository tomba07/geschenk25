import React, { ChangeEvent, FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fileToDataUrl } from '../utils/file';

export default function ProfileSetupScreen() {
  const { completeProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUrl(await fileToDataUrl(file));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please choose a username');
      return;
    }

    if (!password) {
      setError('Please set a password');
      return;
    }

    setSaving(true);
    const { error } = await completeProfile(username.trim(), password, imageUrl);
    setSaving(false);

    if (error) {
      setError(error.message);
    }
  };

  return (
    <section className="auth-screen">
      <form className="auth-card profile-setup-card" onSubmit={handleSubmit}>
        <div className="auth-brand-panel">
          <div className="auth-hero-image" aria-hidden="true">
            <img src="/geschenk-detailed.png" alt="" />
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-heading">
            <h2>Set up your profile</h2>
            <p>Choose how friends will find you in Geschenk.</p>
          </div>

          <div className="profile-setup-image">
            {imageUrl ? <img className="profile-preview" src={imageUrl} alt="" /> : <div className="profile-placeholder">?</div>}
            <label className="secondary-button compact file-button">
              {imageUrl ? 'Change Photo' : 'Add Photo'}
              <input type="file" accept="image/*" onChange={handleImageChange} disabled={saving} />
            </label>
          </div>

          <label className="auth-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoComplete="username"
              disabled={saving}
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="primary-button auth-submit" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </form>
    </section>
  );
}
