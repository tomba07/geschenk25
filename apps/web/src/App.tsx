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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const handleFriendInvite = async (username: string) => {
    if (!isAuthenticated) {
      rememberPendingFriend(username);
      navigate({ name: 'login', friendInvite: true }, true);
      return;
    }

    try {
      const inviteResponse = await apiClient.getFriendInviteByUsername(username);
      if (inviteResponse.error || !inviteResponse.data) {
        window.alert(inviteResponse.error || 'Invalid friend link');
        navigate({ name: 'home' }, true);
        return;
      }

      const joinResponse = await apiClient.joinFriendByUsername(username);
      if (joinResponse.error) {
        window.alert(joinResponse.error);
        return;
      }

      setRefreshHomeKey((key) => key + 1);
      localStorage.removeItem(PENDING_FRIEND_USERNAME_KEY);
      setToastMessage(joinResponse.data?.message || 'Friend added');
      navigate({ name: 'friends' }, true);
    } catch (error) {
      window.alert(getErrorMessage(error));
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
      {toastMessage && (
        <div className="toast-message" role="status" aria-live="polite">
          {toastMessage}
        </div>
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
