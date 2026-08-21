import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { House, LogOut, User, Users, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import { confirmDestructive } from '../utils/confirm';
import { FRIEND_REQUESTS_UPDATED_EVENT } from '../utils/friendRequests';

type SidebarIconName = 'groups' | 'friends' | 'profile' | 'dev' | 'signout';

interface AppShellProps {
  active: 'groups' | 'friends' | 'profile' | 'dev';
  children: ReactNode;
  onNavigateGroups: () => void;
  onNavigateFriends: () => void;
  onNavigateProfile: () => void;
  onNavigateDev?: () => void;
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const Icon = name === 'groups'
    ? House
    : name === 'friends'
      ? Users
      : name === 'profile'
        ? User
        : name === 'dev'
          ? Wrench
          : LogOut;

  return <Icon className="sidebar-icon" aria-hidden="true" />;
}

export default function AppShell({ active, children, onNavigateGroups, onNavigateFriends, onNavigateProfile, onNavigateDev }: AppShellProps) {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [incomingFriendRequestCount, setIncomingFriendRequestCount] = useState(0);
  const mobileTitle = active === 'friends' ? 'Friends' : active === 'profile' ? 'Edit Profile' : active === 'dev' ? 'Dev Admin' : 'Groups';
  const devNavVisible = import.meta.env.VITE_ENABLE_DEV_SCREEN === 'true'
    || (import.meta.env.DEV && apiClient.getBaseUrl().includes('localhost'));

  const loadFriendRequestCount = useCallback(async () => {
    if (isLoading || !isAuthenticated) return;
    const response = await apiClient.getFriendRequests();
    if (!response.error) {
      setIncomingFriendRequestCount(response.data?.incoming.length || 0);
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return undefined;
    loadFriendRequestCount();
    window.addEventListener(FRIEND_REQUESTS_UPDATED_EVENT, loadFriendRequestCount);
    return () => window.removeEventListener(FRIEND_REQUESTS_UPDATED_EVENT, loadFriendRequestCount);
  }, [isAuthenticated, isLoading, loadFriendRequestCount]);

  const closeSidebar = () => setSidebarVisible(false);
  const navigateGroups = () => {
    closeSidebar();
    onNavigateGroups();
  };
  const signOutConfirmed = () => {
    confirmDestructive('Sign Out', 'Are you sure you want to sign out?', 'Sign Out', signOut);
  };

  return (
    <section className="screen app-frame">
      <header className="mobile-overview-bar">
        <button className="mobile-menu-button" type="button" onClick={() => setSidebarVisible(true)} aria-label="Open menu">☰</button>
        <h1 className="mobile-page-title">{mobileTitle}</h1>
      </header>

      {sidebarVisible && <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={closeSidebar} />}

      <aside className={`app-sidebar ${sidebarVisible ? 'is-open' : ''}`}>
        <button className="sidebar-brand sidebar-brand-button" type="button" onClick={navigateGroups} aria-label="Go to groups">
          <img src="/geschenk.png" alt="" aria-hidden="true" />
          Geschenk
        </button>
        <nav className="sidebar-nav">
          <button className={`sidebar-nav-item ${active === 'groups' ? 'active' : ''}`} type="button" onClick={navigateGroups}>
            <SidebarIcon name="groups" /> <span className="sidebar-nav-label">Groups</span>
          </button>
          <button className={`sidebar-nav-item ${active === 'friends' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateFriends(); }}>
            <SidebarIcon name="friends" /> <span className="sidebar-nav-label">Friends</span>
            {incomingFriendRequestCount > 0 && (
              <span className="sidebar-badge" aria-label={`${incomingFriendRequestCount} pending friend requests`}>
                {incomingFriendRequestCount > 9 ? '9+' : incomingFriendRequestCount}
              </span>
            )}
          </button>
          <button className={`sidebar-nav-item ${active === 'profile' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateProfile(); }}>
            <SidebarIcon name="profile" /> <span className="sidebar-nav-label">Profile</span>
          </button>
          {devNavVisible && onNavigateDev && (
            <button className={`sidebar-nav-item ${active === 'dev' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateDev(); }}>
              <SidebarIcon name="dev" /> <span className="sidebar-nav-label">Dev</span>
            </button>
          )}
        </nav>
        <button className="sidebar-signout" type="button" onClick={signOutConfirmed}>
          <SidebarIcon name="signout" /> <span className="sidebar-nav-label">Sign out</span>
        </button>
      </aside>

      <main className="app-frame-main">{children}</main>
    </section>
  );
}
