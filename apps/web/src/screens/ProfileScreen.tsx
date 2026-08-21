import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Bell, Camera, Mail, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fileToDataUrl } from '../utils/file';
import { confirmDestructive } from '../utils/confirm';
import { showErrorToast, showInfoToast, showSuccessToast } from '../utils/toast';
import { apiClient } from '../lib/api';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushSubscription,
  getPushNotificationAvailability,
} from '../utils/pushNotifications';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { email, username, imageUrl, updateProfile, deleteAccount } = useAuth();
  const [usernameInput, setUsernameInput] = useState(username || '');
  const [editingImage, setEditingImage] = useState<string | null>(imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [emailNotificationsBusy, setEmailNotificationsBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [pushAvailability, setPushAvailability] = useState(() => getPushNotificationAvailability());
  const devPushTestVisible = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_SCREEN === 'true';
  const normalizedUsernameInput = usernameInput.trim().toLowerCase();
  const currentUsername = username || '';
  const usernameError = normalizedUsernameInput.length === 0
    ? 'Username is required'
    : normalizedUsernameInput.length < 3
      ? 'Username must be at least 3 characters'
      : /^[a-zA-Z0-9_]+$/.test(usernameInput.trim())
        ? null
        : 'Username can only contain letters, numbers, and underscores';

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCurrentPushSubscription(),
      apiClient.getNotificationPreferences(),
    ]).then(([subscription, preferencesResponse]) => {
      if (cancelled) return;
      setPushAvailability(getPushNotificationAvailability());
      setPushEnabled(Boolean(subscription));
      if (preferencesResponse.data) {
        setEmailNotificationsEnabled(preferencesResponse.data.email_enabled);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUsernameInput(username || '');
  }, [username]);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditingImage(await fileToDataUrl(file));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    setLoading(true);
    const errors: string[] = [];

    if (usernameError) {
      errors.push(usernameError);
    } else if (hasChanges) {
      const { error } = await updateProfile(normalizedUsernameInput, editingImage || null);
      if (error) errors.push(error.message || 'Failed to update profile');
    }

    setLoading(false);
    if (errors.length) {
      showErrorToast(errors.join('\n'));
    } else {
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
    try {
      const result = pushEnabled ? await disablePushNotifications() : await enablePushNotifications();

      if (result.error) {
        setPushAvailability(getPushNotificationAvailability());
        showErrorToast(result.error);
        return;
      }

      setPushAvailability(getPushNotificationAvailability());
      setPushEnabled(!pushEnabled);
      showSuccessToast(pushEnabled ? 'Push notifications disabled' : 'Push notifications enabled');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to update push notifications');
    } finally {
      setPushBusy(false);
    }
  };

  const handleSendTestPush = async () => {
    setPushTestBusy(true);
    const response = await apiClient.sendTestPushNotification();
    setPushTestBusy(false);

    if (response.error) {
      showErrorToast(response.error);
      return;
    }

    showSuccessToast('Test push sent');
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

  const handleRequestPasswordReset = async () => {
    if (!email) {
      showErrorToast('No email is set for this account');
      return;
    }

    setPasswordResetBusy(true);
    const response = await apiClient.requestPasswordReset(email);
    setPasswordResetBusy(false);

    if (response.error) {
      showErrorToast(response.error);
      return;
    }

    showSuccessToast('Password reset email sent');
  };

  const hasChanges = editingImage !== (imageUrl || null) || normalizedUsernameInput !== currentUsername;
  const initial = (normalizedUsernameInput || username || 'U').charAt(0).toUpperCase();
  const pushControlsVisible = pushAvailability.canPrompt || pushEnabled;

  return (
    <section className="screen profile-screen">
      <form className="profile-layout" onSubmit={handleSave}>
        <div className="profile-page-heading">
          <h1>Settings</h1>
          <p>Update your photo and account details.</p>
        </div>

        <section className="profile-hero">
          <div className="profile-photo-block">
            {editingImage ? <img className="profile-preview" src={editingImage} alt="" /> : <div className="profile-placeholder">{initial}</div>}
            <div className="profile-summary-copy">
              <h2>@{normalizedUsernameInput || username || 'user'}</h2>
              <p>{email || 'No email set'}</p>
            </div>
            <div className="button-row profile-image-actions">
              <label className="secondary-button file-button">
                <Camera className="button-inline-icon" aria-hidden="true" />
                Change photo
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
              <button className="link-button danger-text profile-remove-photo-button" type="button" onClick={() => setEditingImage(null)}>
                <Trash2 className="button-inline-icon" aria-hidden="true" />
                Remove photo
              </button>
            </div>
          </div>
        </section>

        <section className="profile-card profile-section-card">
          <header className="profile-section-title">
            <h2>Account</h2>
          </header>

          <label className="profile-edit-field">
            <span>Username</span>
            <input
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              autoCapitalize="none"
              autoComplete="username"
              disabled={loading}
              required
            />
            <small>{usernameError || 'Letters, numbers, and underscores only.'}</small>
          </label>

          <div className="readonly-field profile-readonly-block">
            <span>Email</span>
            <strong>{email || 'Not set'}</strong>
            <small>Your email is used to sign in.</small>
          </div>

          <div className="profile-save-row profile-card-footer">
            <button className="primary-button" type="submit" disabled={loading || !hasChanges || Boolean(usernameError)}>
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </section>

        <section className="profile-card profile-section-card">
          <header className="profile-section-title">
            <h2>Security</h2>
          </header>
          <div className="profile-setting-row">
            <div>
              <strong>Password</strong>
              <small>For security, password changes require a reset link sent to your email.</small>
            </div>
            <button className="secondary-button" type="button" onClick={handleRequestPasswordReset} disabled={passwordResetBusy || !email}>
              <Mail className="button-inline-icon" aria-hidden="true" />
              {passwordResetBusy ? 'Sending...' : 'Send reset email'}
            </button>
          </div>
        </section>

        <section className="profile-card profile-section-card">
          <header className="profile-section-title">
            <h2>Notifications</h2>
          </header>

          <div className="profile-notification-list">
            <div className="profile-notification-row">
              <span className="profile-notification-icon">
                <Mail aria-hidden="true" />
              </span>
              <div>
                <strong>Email notifications</strong>
                <small>Friend requests, group additions, and draw results.</small>
              </div>
              <button
                className={`toggle-switch ${emailNotificationsEnabled ? 'on' : ''}`}
                type="button"
                role="switch"
                aria-checked={emailNotificationsEnabled}
                onClick={handleToggleEmailNotifications}
                disabled={emailNotificationsBusy}
              >
                <span />
              </button>
            </div>

            <div className="profile-notification-row">
              <span className="profile-notification-icon">
                <Bell aria-hidden="true" />
              </span>
              <div>
                <strong>Push notifications</strong>
                <small>Notifications on this device.</small>
              </div>
              {pushControlsVisible ? (
                <button
                  className={`toggle-switch ${pushEnabled ? 'on' : ''}`}
                  type="button"
                  role="switch"
                  aria-checked={pushEnabled}
                  onClick={handleTogglePushNotifications}
                  disabled={pushBusy}
                >
                  <span />
                </button>
              ) : (
                <span className="profile-unavailable-status">
                  {pushAvailability.status === 'denied' ? 'Blocked' : 'Unavailable'}
                </span>
              )}
            </div>

            {devPushTestVisible && (
              <div className="profile-save-row profile-card-footer">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={pushTestBusy || !pushEnabled}
                >
                  <Send className="button-inline-icon" aria-hidden="true" />
                  {pushTestBusy ? 'Sending...' : 'Send test push'}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="profile-card profile-danger-card">
          <div>
            <h2>Danger Zone</h2>
            <p>Deleting your account will permanently remove your data, groups, memberships, and gift ideas.</p>
          </div>
          <button className="danger-button" type="button" onClick={handleDeleteAccount} disabled={deleting}>
            <Trash2 className="button-inline-icon" aria-hidden="true" />
            {deleting ? 'Deleting...' : 'Delete account'}
          </button>
        </section>
      </form>
    </section>
  );
}
