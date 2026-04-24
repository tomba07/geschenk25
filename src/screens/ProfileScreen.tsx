import React, { ChangeEvent, FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fileToDataUrl } from '../utils/file';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { username, displayName, imageUrl, updateDisplayName, updateProfileImage, deleteAccount } = useAuth();
  const [newDisplayName, setNewDisplayName] = useState(displayName || '');
  const [editingImage, setEditingImage] = useState<string | null>(imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditingImage(await fileToDataUrl(file));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (newDisplayName.trim().length > 100) {
      window.alert('Display name must be 100 characters or less');
      return;
    }

    setLoading(true);
    const errors: string[] = [];

    if (newDisplayName.trim() !== (displayName || '')) {
      const { error } = await updateDisplayName(newDisplayName.trim());
      if (error) errors.push(`Display name: ${error.message || 'Failed to update'}`);
    }

    if (editingImage !== (imageUrl || null)) {
      const { error } = await updateProfileImage(editingImage || undefined);
      if (error) errors.push(`Image: ${error.message || 'Failed to update'}`);
    }

    setLoading(false);
    if (errors.length) {
      window.alert(errors.join('\n'));
    } else {
      onBack();
    }
  };

  const handleDeleteAccount = async () => {
    const message = 'This will permanently delete all your groups, memberships, gift ideas, and profile data. This action cannot be undone.';
    if (!window.confirm(`Delete Account\n\n${message}`)) return;

    setDeleting(true);
    const { error } = await deleteAccount();
    setDeleting(false);
    if (error) {
      window.alert(error.message || 'Failed to delete account');
    } else {
      window.alert('Your account has been permanently deleted.');
    }
  };

  const hasChanges = newDisplayName.trim() !== (displayName || '') || editingImage !== (imageUrl || null);
  const initial = (displayName || username || 'U').charAt(0).toUpperCase();

  return (
    <section className="screen profile-screen">
      <header className="topbar profile-topbar">
        <button className="link-button detail-nav-button" type="button" onClick={onBack}>← Back</button>
        <h1>Edit Profile</h1>
        <div />
      </header>

      <form className="profile-layout" onSubmit={handleSave}>
        <section className="profile-card profile-summary-card">
          <div className="profile-photo-block">
            {editingImage ? <img className="profile-preview" src={editingImage} alt="" /> : <div className="profile-placeholder">{initial}</div>}
            <div className="button-row profile-image-actions">
              <label className="secondary-button file-button">
                Change Photo
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
              <button className="secondary-button danger-outline-button" type="button" onClick={() => setEditingImage(null)}>Remove Photo</button>
            </div>
          </div>
          <div className="profile-summary-copy">
            <h2>{newDisplayName.trim() || displayName || username || 'User'}</h2>
            <p>@{username}</p>
          </div>
        </section>

        <section className="profile-card profile-fields-card">
          <div className="profile-card-heading">
            <h2>Account</h2>
            <p>Update how your name appears to other group members.</p>
          </div>

          <div className="readonly-field">
            <span>Username</span>
            <strong>@{username}</strong>
            <small>Your username cannot be changed.</small>
          </div>

          <label>
            <span>Display Name</span>
            <input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} maxLength={100} disabled={loading} />
          </label>

          <div className="profile-save-row">
            <button className="primary-button" type="submit" disabled={loading || !hasChanges}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        <section className="profile-card profile-danger-card">
          <div>
            <h2>Danger Zone</h2>
            <p>Deleting your account will permanently remove your data, groups, memberships, and gift ideas.</p>
          </div>
          <button className="danger-button" type="button" onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </section>
      </form>
    </section>
  );
}
