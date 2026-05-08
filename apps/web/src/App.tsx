import React, { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiClient } from './lib/api';
import { getErrorMessage } from './utils/errors';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import ProfileScreen from './screens/ProfileScreen';
import InviteLandingScreen from './screens/InviteLandingScreen';
import AppShell from './components/AppShell';
import LandingScreen from './screens/LandingScreen';
import AuthCallbackScreen from './screens/AuthCallbackScreen';
import { CONFIRM_EVENT, ConfirmDialogRequest } from './utils/confirm';

type Route =
  | { name: 'home' }
  | { name: 'login' }
  | { name: 'signup' }
  | { name: 'auth-callback'; token: string | null }
  | { name: 'profile' }
  | { name: 'group'; groupId: string }
  | { name: 'join'; token: string };

function parseRoute(): Route {
  const path = window.location.pathname;
  const groupMatch = path.match(/^\/groups\/([^/]+)$/);
  if (groupMatch) return { name: 'group', groupId: groupMatch[1] };

  const joinMatch = path.match(/^\/join\/([^/]+)$/);
  if (joinMatch) return { name: 'join', token: joinMatch[1] };

  if (path === '/signup') return { name: 'signup' };
  if (path === '/login') return { name: 'login' };
  if (path === '/auth/callback') return { name: 'auth-callback', token: new URLSearchParams(window.location.search).get('token') };
  if (path === '/profile') return { name: 'profile' };
  return { name: 'home' };
}

function routePath(route: Route): string {
  if (route.name === 'group') return `/groups/${route.groupId}`;
  if (route.name === 'join') return `/join/${route.token}`;
  if (route.name === 'signup') return '/signup';
  if (route.name === 'login') return '/login';
  if (route.name === 'auth-callback') return route.token ? `/auth/callback?token=${encodeURIComponent(route.token)}` : '/auth/callback';
  if (route.name === 'profile') return '/profile';
  return '/';
}

function hasStoredAuth() {
  return Boolean(localStorage.getItem('geschenk.auth_token') && localStorage.getItem('geschenk.auth_user'));
}

const PENDING_INVITE_KEY = 'geschenk.pending_invite_token';

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
  const { isAuthenticated, isLoading } = useAuth();
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(() => localStorage.getItem(PENDING_INVITE_KEY));
  const [refreshHomeKey, setRefreshHomeKey] = useState(0);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null);

  const navigate = (nextRoute: Route, replace = false) => {
    const path = routePath(nextRoute);
    if (replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
    setRoute(nextRoute);
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
    if (!isLoading && !isAuthenticated && !['home', 'login', 'signup', 'join', 'auth-callback'].includes(route.name)) {
      navigate({ name: 'login' }, true);
    }
  }, [isAuthenticated, isLoading, route.name]);

  useEffect(() => {
    if (isAuthenticated && pendingInviteToken) {
      handleJoinInvite(pendingInviteToken);
      setPendingInviteToken(null);
      localStorage.removeItem(PENDING_INVITE_KEY);
    }
  }, [isAuthenticated, pendingInviteToken]);

  const handleJoinInvite = async (token: string) => {
    if (!isAuthenticated) {
      setPendingInviteToken(token);
      localStorage.setItem(PENDING_INVITE_KEY, token);
      navigate({ name: 'login' }, true);
      return;
    }

    try {
      const groupResponse = await apiClient.getGroupByInviteToken(token);
      if (groupResponse.error || !groupResponse.data) {
        window.alert(groupResponse.error || 'Invalid invite link');
        navigate({ name: 'home' }, true);
        return;
      }

      const group = groupResponse.data.group;
      const joinResponse = await apiClient.joinGroupByToken(token);
      if (joinResponse.error) {
        window.alert(joinResponse.error);
        return;
      }

      setRefreshHomeKey((key) => key + 1);
      localStorage.removeItem(PENDING_INVITE_KEY);
      navigate({ name: 'group', groupId: String(joinResponse.data?.group_id || group.id) }, true);
    } catch (error) {
      window.alert(getErrorMessage(error));
      navigate({ name: 'home' }, true);
    }
  };

  const content = useMemo(() => {
    if (isLoading) {
      if (hasStoredAuth() && ['home', 'profile', 'group'].includes(route.name)) {
        return (
          <AppShell active={route.name === 'profile' ? 'profile' : 'groups'} onNavigateGroups={() => navigate({ name: 'home' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
            <LoadingScreen route={route} />
          </AppShell>
        );
      }

      return <LoadingScreen route={route} />;
    }

    if (route.name === 'join') {
      return (
        <InviteLandingScreen
          token={route.token}
          onContinueWeb={() => handleJoinInvite(route.token)}
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
      return <LoginScreen onSwitchToSignup={() => navigate({ name: 'signup' })} />;
    }

    if (route.name === 'group') {
      return (
        <AppShell active="groups" onNavigateGroups={() => navigate({ name: 'home' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
          <GroupDetailScreen groupId={route.groupId} onBack={() => navigate({ name: 'home' })} />
        </AppShell>
      );
    }

    if (route.name === 'profile') {
      return (
        <AppShell active="profile" onNavigateGroups={() => navigate({ name: 'home' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
          <ProfileScreen onBack={() => navigate({ name: 'home' })} />
        </AppShell>
      );
    }

    return (
      <AppShell active="groups" onNavigateGroups={() => navigate({ name: 'home' })} onNavigateProfile={() => navigate({ name: 'profile' })}>
        <HomeScreen
          key={refreshHomeKey}
          onGroupPress={(groupId) => navigate({ name: 'group', groupId })}
          onNavigateToProfile={() => navigate({ name: 'profile' })}
        />
      </AppShell>
    );
  }, [isAuthenticated, isLoading, refreshHomeKey, route]);

  return (
    <main className="app-shell">
      {content}
      {confirmRequest && (
        <AppConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
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
