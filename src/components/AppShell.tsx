import React, { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { confirmDestructive } from '../utils/confirm';

type SidebarIconName = 'groups' | 'profile' | 'settings' | 'signout';

interface AppShellProps {
  active: 'groups' | 'profile' | 'settings';
  children: ReactNode;
  onNavigateGroups: () => void;
  onNavigateProfile: () => void;
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  return (
    <svg className="sidebar-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      {name === 'groups' && (
        <>
          <path d="M3.75 11.25 12 4.5l8.25 6.75" />
          <path d="M5.75 10.25V20h12.5v-9.75" />
          <path d="M9.25 20v-6.25h5.5V20" />
        </>
      )}
      {name === 'profile' && (
        <>
          <path d="M12 12.25a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
          <path d="M19.35 13.4a7.86 7.86 0 0 0 .05-2.8l2.1-1.6-2-3.46-2.55 1.05a7.4 7.4 0 0 0-2.4-1.4L14.2 2.5h-4l-.35 2.69a7.4 7.4 0 0 0-2.4 1.4L4.9 5.54 2.9 9l2.1 1.6a7.86 7.86 0 0 0 .05 2.8L2.95 15l2 3.46 2.5-1.04a7.54 7.54 0 0 0 2.45 1.43l.3 2.65h4l.3-2.65a7.54 7.54 0 0 0 2.45-1.43l2.5 1.04 2-3.46-2.1-1.6Z" />
        </>
      )}
      {name === 'signout' && (
        <>
          <path d="M14.25 5.25h-7.5v13.5h7.5" />
          <path d="M10.75 12h9" />
          <path d="m16.75 8 4 4-4 4" />
        </>
      )}
    </svg>
  );
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
        <div className="sidebar-brand">
          <img src="/geschenk.png" alt="" aria-hidden="true" />
          Geschenk
        </div>
      </header>

      {sidebarVisible && <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={closeSidebar} />}

      <aside className={`app-sidebar ${sidebarVisible ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/geschenk.png" alt="" aria-hidden="true" />
          Geschenk
        </div>
        <nav className="sidebar-nav">
          <button className={`sidebar-nav-item ${active === 'groups' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateGroups(); }}>
            <SidebarIcon name="groups" /> Groups
          </button>
          <button className={`sidebar-nav-item ${active === 'profile' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateProfile(); }}>
            <SidebarIcon name="profile" /> Profile
          </button>
          <button className={`sidebar-nav-item ${active === 'settings' ? 'active' : ''}`} type="button">
            <SidebarIcon name="settings" /> Settings
          </button>
        </nav>
        <button className="sidebar-signout" type="button" onClick={signOutConfirmed}>
          <SidebarIcon name="signout" /> Sign out
        </button>
      </aside>

      <main className="app-frame-main">{children}</main>
    </section>
  );
}
