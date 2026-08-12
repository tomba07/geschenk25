import React, { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiClient } from './lib/api';
import { getErrorMessage } from './utils/errors';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import FriendsScreen from './screens/FriendsScreen';
import InviteLandingScreen from './screens/InviteLandingScreen';
import AppShell from './components/AppShell';
import LandingScreen from './screens/LandingScreen';
import AuthCallbackScreen from './screens/AuthCallbackScreen';
import { CONFIRM_EVENT, ConfirmDialogRequest } from './utils/confirm';
import { showErrorToast, showSuccessToast, TOAST_EVENT, ToastRequest, ToastTone } from './utils/toast';
import { isStandaloneApp, shouldShowIosInstallHint } from './utils/pwa';
import {
  enablePushNotifications,
  getCurrentPushSubscription,
  isPushNotificationSupported,
} from './utils/pushNotifications';

type Route =
  | { name: 'home' }
  | { name: 'login'; friendInvite?: boolean }
  | { name: 'signup' }
  | { name: 'auth-callback'; token: string | null }
  | { name: 'profile' }
  | { name: 'friends' }
  | { name: 'group'; groupId: string }
  | { name: 'friend-invite'; username: string };

function parseRoute(): Route {
  const path = window.location.pathname;
  const groupMatch = path.match(/^\/groups\/([^/]+)$/);
  if (groupMatch) return { name: 'group', groupId: groupMatch[1] };

  const friendInviteMatch = path.match(/^\/plsbemyfriend\/([^/]+)$/);
  if (friendInviteMatch) return { name: 'friend-invite', username: decodeURIComponent(friendInviteMatch[1]) };

  if (path === '/signup') return { name: 'signup' };
  if (path === '/login/friend-invite') return { name: 'login', friendInvite: true };
  if (path === '/login') return { name: 'login' };
  if (path === '/auth/callback') return { name: 'auth-callback', token: new URLSearchParams(window.location.search).get('token') };
  if (path === '/friends') return { name: 'friends' };
  if (path === '/profile') return { name: 'profile' };
  return { name: 'home' };
}

function routePath(route: Route): string {
  if (route.name === 'group') return `/groups/${route.groupId}`;
  if (route.name === 'friend-invite') return `/plsbemyfriend/${encodeURIComponent(route.username)}`;
  if (route.name === 'signup') return '/signup';
  if (route.name === 'login') return route.friendInvite ? '/login/friend-invite' : '/login';
  if (route.name === 'auth-callback') return route.token ? `/auth/callback?token=${encodeURIComponent(route.token)}` : '/auth/callback';
  if (route.name === 'friends') return '/friends';
  if (route.name === 'profile') return '/profile';
  return '/';
}

function hasStoredAuth() {
  return Boolean(localStorage.getItem('geschenk.auth_token') && localStorage.getItem('geschenk.auth_user'));
}

const PENDING_FRIEND_USERNAME_KEY = 'geschenk.pending_friend_username';

interface ActiveToast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALL_HINT_DISMISSED_KEY = 'geschenk.install_hint_dismissed';
const PUSH_HINT_DISMISSED_KEY = 'geschenk.push_hint_dismissed';

function LoadingScreen({ route }: { route: Route }) {
  return (
    <section className={`screen app-loading-screen app-loading-screen-${route.name}`}>
      <div className="app-loading-card">
        <span className="spinner" />
      </div>
    </section>
  );
}

function AppConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmDialogRequest;
  onClose: () => void;
}) {
  const dangerActions = new Set(['Delete', 'Remove', 'Reject', 'Reset', 'Leave', 'Sign Out']);
  const confirmClassName = dangerActions.has(request.confirmText) ? 'danger-button' : 'primary-button';

  const cancel = () => {
    request.onCancel?.();
    onClose();
  };

  const confirm = () => {
    request.onConfirm();
    onClose();
  };

  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <header>
          <h2 id="confirm-dialog-title">{request.title}</h2>
        </header>
        <p>{request.message}</p>
        <div className="button-row end">
          <button className="secondary-button" type="button" onClick={cancel}>Cancel</button>
          <button className={confirmClassName} type="button" onClick={confirm}>{request.confirmText}</button>
        </div>
      </section>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, profileComplete } = useAuth();
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [pendingFriendUsername, setPendingFriendUsername] = useState<string | null>(() => localStorage.getItem(PENDING_FRIEND_USERNAME_KEY));
  const [refreshHomeKey, setRefreshHomeKey] = useState(0);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null);
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHintVisible, setInstallHintVisible] = useState(false);
  const [iosInstallHintVisible, setIosInstallHintVisible] = useState(false);
  const [pushHintVisible, setPushHintVisible] = useState(false);
  const [pushHintBusy, setPushHintBusy] = useState(false);

  const navigate = (nextRoute: Route, replace = false) => {
    const path = routePath(nextRoute);
    if (replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
    setRoute(nextRoute);
  };

  const rememberPendingFriend = (username: string) => {
    setPendingFriendUsername(username);
    localStorage.setItem(PENDING_FRIEND_USERNAME_KEY, username);
  };

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const handleConfirm = (event: Event) => {
      event.preventDefault();
      const customEvent = event as CustomEvent<ConfirmDialogRequest>;
      setConfirmRequest(customEvent.detail);
    };

    window.addEventListener(CONFIRM_EVENT, handleConfirm);
    return () => window.removeEventListener(CONFIRM_EVENT, handleConfirm);
  }, []);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastRequest>;
      setToast({
        id: Date.now(),
        message: customEvent.detail.message,
        tone: customEvent.detail.tone,
      });
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !['home', 'login', 'signup', 'friend-invite', 'auth-callback'].includes(route.name)) {
      navigate({ name: 'login' }, true);
    }
  }, [isAuthenticated, isLoading, route.name]);

  useEffect(() => {
    if (isAuthenticated && profileComplete && pendingFriendUsername) {
      handleFriendInvite(pendingFriendUsername);
      setPendingFriendUsername(null);
      localStorage.removeItem(PENDING_FRIEND_USERNAME_KEY);
    }
  }, [isAuthenticated, profileComplete, pendingFriendUsername]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), toast.tone === 'error' ? 4600 : 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (isStandaloneApp() || localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) === 'true') {
      return undefined;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setInstallHintVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (
      isAuthenticated
      && profileComplete
      && shouldShowIosInstallHint()
      && localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) !== 'true'
    ) {
      setIosInstallHintVisible(true);
    }
  }, [isAuthenticated, profileComplete]);

  useEffect(() => {
    let cancelled = false;

    async function checkPushPrompt() {
      if (
        !isAuthenticated
        || !profileComplete
        || !isStandaloneApp()
        || !isPushNotificationSupported()
        || localStorage.getItem(PUSH_HINT_DISMISSED_KEY) === 'true'
        || Notification.permission !== 'default'
      ) {
        setPushHintVisible(false);
        return;
      }

      const [subscription, configResponse] = await Promise.all([
        getCurrentPushSubscription(),
        apiClient.getNotificationConfig(),
      ]);

      if (cancelled) return;
      setPushHintVisible(Boolean(!subscription && configResponse.data?.enabled));
    }

    checkPushPrompt();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, profileComplete]);

  const dismissInstallHint = () => {
    localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, 'true');
    setInstallHintVisible(false);
    setIosInstallHintVisible(false);
  };

  const installApp = async () => {
    if (!installPromptEvent) return;

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    setInstallHintVisible(false);

    if (choice.outcome === 'dismissed') {
      localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, 'true');
    }
  };

  const dismissPushHint = () => {
    localStorage.setItem(PUSH_HINT_DISMISSED_KEY, 'true');
    setPushHintVisible(false);
  };

  const enablePushFromHint = async () => {
    setPushHintBusy(true);
    const result = await enablePushNotifications();
    setPushHintBusy(false);

    if (result.error) {
      showErrorToast(result.error);
      if (Notification.permission === 'denied') {
        dismissPushHint();
      }
      return;
    }

    setPushHintVisible(false);
    showSuccessToast('Push notifications enabled');
  };

  const handleFriendInvite = async (username: string) => {
    if (!isAuthenticated) {
      rememberPendingFriend(username);
      navigate({ name: 'login', friendInvite: true }, true);
      return;
    }

    try {
      const inviteResponse = await apiClient.getFriendInviteByUsername(username);
      if (inviteResponse.error || !inviteResponse.data) {
        showErrorToast(inviteResponse.error || 'Invalid friend link');
        navigate({ name: 'home' }, true);
        return;
      }

      const joinResponse = await apiClient.joinFriendByUsername(username);
      if (joinResponse.error) {
        showErrorToast(joinResponse.error);
        return;
      }

      setRefreshHomeKey((key) => key + 1);
      localStorage.removeItem(PENDING_FRIEND_USERNAME_KEY);
      showSuccessToast(joinResponse.data?.message || 'Friend added');
      navigate({ name: 'friends' }, true);
    } catch (error) {
      showErrorToast(getErrorMessage(error));
      navigate({ name: 'home' }, true);
    }
  };

  const content = useMemo(() => {
    if (isLoading) {
      if (hasStoredAuth() && ['home', 'friends', 'profile', 'group'].includes(route.name)) {
        return (
          <AppShell
            active={route.name === 'profile' ? 'profile' : route.name === 'friends' ? 'friends' : 'groups'}
            onNavigateGroups={() => navigate({ name: 'home' })}
            onNavigateFriends={() => navigate({ name: 'friends' })}
            onNavigateProfile={() => navigate({ name: 'profile' })}
          >
            <LoadingScreen route={route} />
          </AppShell>
        );
      }

      return <LoadingScreen route={route} />;
    }

    if (route.name === 'friend-invite') {
      return (
        <InviteLandingScreen
          username={route.username}
          onContinueWeb={() => handleFriendInvite(route.username)}
          onPrepareAuth={() => rememberPendingFriend(route.username)}
          onSwitchToSignup={() => navigate({ name: 'signup' })}
        />
      );
    }

    if (route.name === 'auth-callback') {
      return (
        <AuthCallbackScreen
          token={route.token}
          onDone={() => navigate({ name: 'home' }, true)}
          onFailed={() => navigate({ name: 'login' }, true)}
        />
      );
    }

    if (!isAuthenticated) {
      if (route.name === 'home') {
        return (
          <LandingScreen
            onLogin={() => navigate({ name: 'login' })}
            onSignup={() => navigate({ name: 'signup' })}
          />
        );
      }
      if (route.name === 'signup') {
        return <SignupScreen onSwitchToLogin={() => navigate({ name: 'login' })} />;
      }
      return <LoginScreen friendInviteMode={route.name === 'login' && route.friendInvite} onSwitchToSignup={() => navigate({ name: 'signup' })} />;
    }

    if (!profileComplete) {
      return <ProfileSetupScreen />;
    }

    if (route.name === 'group') {
      return (
        <AppShell active="groups" onNavigateGroups={() => navigate({ name: 'home' })} onNavigateFriends={() => navigate({ name: 'friends' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
          <GroupDetailScreen groupId={route.groupId} onBack={() => navigate({ name: 'home' })} />
        </AppShell>
      );
    }

    if (route.name === 'friends') {
      return (
        <AppShell active="friends" onNavigateGroups={() => navigate({ name: 'home' })} onNavigateFriends={() => navigate({ name: 'friends' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
          <FriendsScreen />
        </AppShell>
      );
    }

    if (route.name === 'profile') {
      return (
        <AppShell active="profile" onNavigateGroups={() => navigate({ name: 'home' })} onNavigateFriends={() => navigate({ name: 'friends' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
          <ProfileScreen onBack={() => navigate({ name: 'home' })} />
        </AppShell>
      );
    }

    return (
      <AppShell active="groups" onNavigateGroups={() => navigate({ name: 'home' })} onNavigateFriends={() => navigate({ name: 'friends' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
        <HomeScreen
          key={refreshHomeKey}
          onGroupPress={(groupId) => navigate({ name: 'group', groupId })}
          onNavigateToProfile={() => navigate({ name: 'profile' })}
        />
      </AppShell>
    );
  }, [isAuthenticated, isLoading, profileComplete, refreshHomeKey, route]);

  return (
    <main className="app-shell">
      {content}
      {confirmRequest && (
        <AppConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      )}
      {toast && (
        <div
          className={`toast-message toast-message-${toast.tone}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-dot" aria-hidden="true" />
          <span>{toast.message}</span>
          <button className="toast-close" type="button" onClick={() => setToast(null)} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
      {installHintVisible && installPromptEvent && (
        <aside className="install-hint" aria-label="Install Geschenk">
          <div>
            <strong>Install Geschenk</strong>
            <span>Use it like an app and get back to your groups faster.</span>
          </div>
          <div className="install-hint-actions">
            <button className="secondary-button compact" type="button" onClick={dismissInstallHint}>Not now</button>
            <button className="primary-button compact" type="button" onClick={installApp}>Install</button>
          </div>
        </aside>
      )}
      {iosInstallHintVisible && (
        <aside className="install-hint ios-install-hint" aria-label="Install Geschenk">
          <div>
            <strong>Install Geschenk</strong>
            <span>On iPhone or iPad, use Share, then Add to Home Screen. Push notifications work after that.</span>
          </div>
          <div className="install-hint-actions">
            <button className="secondary-button compact" type="button" onClick={dismissInstallHint}>Got it</button>
          </div>
        </aside>
      )}
      {pushHintVisible && (
        <aside className="install-hint push-hint" aria-label="Enable push notifications">
          <div>
            <strong>Enable notifications</strong>
            <span>Get a heads-up for friend requests, group updates, and drawn names.</span>
          </div>
          <div className="install-hint-actions">
            <button className="secondary-button compact" type="button" onClick={dismissPushHint} disabled={pushHintBusy}>Not now</button>
            <button className="primary-button compact" type="button" onClick={enablePushFromHint} disabled={pushHintBusy}>
              {pushHintBusy ? 'Enabling...' : 'Enable'}
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
