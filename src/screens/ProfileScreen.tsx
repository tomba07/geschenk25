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

  return (
    <section className="screen">
      <header className="topbar">
        <button className="link-button" type="button" onClick={onBack}>Back</button>
        <h1>Profile</h1>
        <div className="topbar-spacer" />
      </header>

      <form className="content-form" onSubmit={handleSave}>
        <section className="form-section">
          <h2>Profile Image</h2>
          {editingImage ? <img className="profile-preview" src={editingImage} alt="" /> : <div className="profile-placeholder">{(displayName || username || 'U').charAt(0).toUpperCase()}</div>}
          <div className="button-row">
            <label className="secondary-button file-button">
              Change
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>
            <button className="secondary-button" type="button" onClick={() => setEditingImage(null)}>Remove</button>
          </div>
        </section>

        <section className="form-section">
          <h2>Username</h2>
          <p>@{username}</p>
          <small>Your username cannot be changed.</small>
        </section>

        <label>
          <span>Display Name</span>
          <input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} maxLength={100} disabled={loading} />
        </label>

        {hasChanges && (
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        )}

        <section className="danger-zone">
          <h2>Danger Zone</h2>
          <p>Deleting your account will permanently remove your data.</p>
          <button className="danger-button" type="button" onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </section>
      </form>
    </section>
  );
}
