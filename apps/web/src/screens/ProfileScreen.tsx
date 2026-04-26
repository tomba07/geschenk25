import React, { ChangeEvent, FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fileToDataUrl } from '../utils/file';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { email, username, imageUrl, updateProfileImage, deleteAccount } = useAuth();
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

    setLoading(true);
    const errors: string[] = [];

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

  const hasChanges = editingImage !== (imageUrl || null);
  const initial = (username || 'U').charAt(0).toUpperCase();

  return (
    <section className="screen profile-screen">
      <form className="profile-layout" onSubmit={handleSave}>
        <div className="profile-page-heading">
          <h1>Edit Profile</h1>
          <p>Update your photo and account details.</p>
        </div>

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
            <h2>@{username || 'user'}</h2>
            <p>{email || 'No email set'}</p>
          </div>
        </section>

        <section className="profile-card profile-fields-card">
          <div className="profile-card-heading">
            <h2>Account</h2>
            <p>Your username is how other group members find you.</p>
          </div>

          <div className="readonly-field">
            <span>Username</span>
            <strong>@{username}</strong>
            <small>Your username cannot be changed.</small>
          </div>

          <div className="readonly-field">
            <span>Email</span>
            <strong>{email || 'Not set'}</strong>
            <small>Your email is used to sign in.</small>
          </div>

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
