import React, { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { confirmDestructive } from '../utils/confirm';

interface AppShellProps {
  active: 'groups' | 'profile' | 'settings';
  children: ReactNode;
  onNavigateGroups: () => void;
  onNavigateProfile: () => void;
}

export default function AppShell({ active, children, onNavigateGroups, onNavigateProfile }: AppShellProps) {
  const { signOut } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const closeSidebar = () => setSidebarVisible(false);
  const signOutConfirmed = () => {
    confirmDestructive('Sign Out', 'Are you sure you want to sign out?', 'Sign Out', signOut);
  };

  return (
    <section className="screen app-frame">
      <header className="mobile-overview-bar">
        <button className="mobile-menu-button" type="button" onClick={() => setSidebarVisible(true)} aria-label="Open menu">☰</button>
        <div className="sidebar-brand"><span>🎁</span> Geschenk</div>
      </header>

      {sidebarVisible && <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={closeSidebar} />}

      <aside className={`app-sidebar ${sidebarVisible ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><span>🎁</span> Geschenk</div>
        <nav className="sidebar-nav">
          <button className={`sidebar-nav-item ${active === 'groups' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateGroups(); }}>
            <span className="sidebar-icon">⌂</span> Groups
          </button>
          <button className={`sidebar-nav-item ${active === 'profile' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateProfile(); }}>
            <span className="sidebar-icon">♙</span> Profile
          </button>
          <button className={`sidebar-nav-item ${active === 'settings' ? 'active' : ''}`} type="button">
            <span className="sidebar-icon">⚙</span> Settings
          </button>
        </nav>
        <button className="sidebar-signout" type="button" onClick={signOutConfirmed}>
          <span className="sidebar-icon">⇥</span> Sign out
        </button>
      </aside>

      <main className="app-frame-main">{children}</main>
    </section>
  );
}
