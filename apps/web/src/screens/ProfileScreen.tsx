import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fileToDataUrl } from '../utils/file';
import { confirmDestructive } from '../utils/confirm';
import { showErrorToast, showInfoToast, showSuccessToast } from '../utils/toast';
import { apiClient } from '../lib/api';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushSubscription,
  isPushNotificationSupported,
} from '../utils/pushNotifications';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { email, username, imageUrl, updateProfileImage, updatePassword, deleteAccount } = useAuth();
  const [editingImage, setEditingImage] = useState<string | null>(imageUrl || null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [emailNotificationsBusy, setEmailNotificationsBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCurrentPushSubscription(),
      apiClient.getNotificationPreferences(),
    ]).then(([subscription, preferencesResponse]) => {
      if (cancelled) return;
      setPushEnabled(Boolean(subscription));
      if (preferencesResponse.data) {
        setEmailNotificationsEnabled(preferencesResponse.data.email_enabled);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditingImage(await fileToDataUrl(file));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    setLoading(true);
    const errors: string[] = [];

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        errors.push('Password must be at least 6 characters');
      } else if (newPassword !== confirmPassword) {
        errors.push('Passwords do not match');
      } else {
        const { error } = await updatePassword(newPassword);
        if (error) errors.push(`Password: ${error.message || 'Failed to update'}`);
      }
    }

    if (editingImage !== (imageUrl || null)) {
      const { error } = await updateProfileImage(editingImage || undefined);
      if (error) errors.push(`Image: ${error.message || 'Failed to update'}`);
    }

    setLoading(false);
    if (errors.length) {
      showErrorToast(errors.join('\n'));
    } else {
      setNewPassword('');
      setConfirmPassword('');
      showSuccessToast('Profile updated');
      onBack();
    }
  };

  const handleDeleteAccount = async () => {
    const message = 'This will permanently delete all your groups, memberships, gift ideas, and profile data. This action cannot be undone.';
    confirmDestructive('Delete Account', message, 'Delete', async () => {
      setDeleting(true);
      const { error } = await deleteAccount();
      setDeleting(false);
      if (error) {
        showErrorToast(error.message || 'Failed to delete account');
      } else {
        showInfoToast('Your account has been permanently deleted');
      }
    });
  };

  const handleTogglePushNotifications = async () => {
    setPushBusy(true);
    const result = pushEnabled ? await disablePushNotifications() : await enablePushNotifications();
    setPushBusy(false);

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setPushEnabled(!pushEnabled);
    showSuccessToast(pushEnabled ? 'Push notifications disabled' : 'Push notifications enabled');
  };

  const handleToggleEmailNotifications = async () => {
    const nextEnabled = !emailNotificationsEnabled;
    setEmailNotificationsBusy(true);
    const response = await apiClient.updateNotificationPreferences(nextEnabled);
    setEmailNotificationsBusy(false);

    if (response.error) {
      showErrorToast(response.error);
      return;
    }

    setEmailNotificationsEnabled(response.data?.email_enabled ?? nextEnabled);
    showSuccessToast(nextEnabled ? 'Email notifications enabled' : 'Email notifications disabled');
  };

  const hasChanges = editingImage !== (imageUrl || null) || Boolean(newPassword || confirmPassword);
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

          <label>
            <span>Optional Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Set a password"
              disabled={loading}
            />
          </label>

          <label>
            <span>Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Confirm password"
              disabled={loading}
            />
          </label>

          <div className="profile-save-row">
            <button className="primary-button" type="submit" disabled={loading || !hasChanges}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        <section className="profile-card profile-fields-card">
          <div className="profile-card-heading">
            <h2>Notifications</h2>
            <p>Email notifications are sent for friend requests, group additions, and drawn names.</p>
          </div>

          <div className="readonly-field">
            <span>Email</span>
            <strong>{emailNotificationsEnabled ? 'Enabled' : 'Off'}</strong>
            <small>
              {emailNotificationsEnabled
                ? `Important updates go to ${email || 'your sign-in email'}.`
                : 'You will still receive sign-in and account emails.'}
            </small>
          </div>

          <div className="profile-save-row">
            <button
              className="secondary-button"
              type="button"
              onClick={handleToggleEmailNotifications}
              disabled={emailNotificationsBusy}
            >
              {emailNotificationsBusy ? 'Updating...' : emailNotificationsEnabled ? 'Disable Email' : 'Enable Email'}
            </button>
          </div>

          <div className="readonly-field">
            <span>Push</span>
            <strong>{pushEnabled ? 'Enabled on this device' : 'Off on this device'}</strong>
            <small>PWA notifications work best after installing Geschenk to your home screen or dock.</small>
          </div>

          <div className="profile-save-row">
            <button
              className="secondary-button"
              type="button"
              onClick={handleTogglePushNotifications}
              disabled={pushBusy || !isPushNotificationSupported()}
            >
              {pushBusy ? 'Updating...' : pushEnabled ? 'Disable Push' : 'Enable Push'}
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
