import React, { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { confirmDestructive } from '../utils/confirm';

type SidebarIconName = 'groups' | 'friends' | 'profile' | 'signout';

interface AppShellProps {
  active: 'groups' | 'friends' | 'profile';
  children: ReactNode;
  onNavigateGroups: () => void;
  onNavigateFriends: () => void;
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
      {name === 'friends' && (
        <>
          <path d="M8.75 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
          <path d="M15.75 11.25a2.75 2.75 0 1 0 0-5.5" />
          <path d="M3.75 20.25a5 5 0 0 1 10 0" />
          <path d="M14.75 15.25a4.25 4.25 0 0 1 5.5 4" />
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

export default function AppShell({ active, children, onNavigateGroups, onNavigateFriends, onNavigateProfile }: AppShellProps) {
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
          <button className={`sidebar-nav-item ${active === 'friends' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateFriends(); }}>
            <SidebarIcon name="friends" /> Friends
          </button>
          <button className={`sidebar-nav-item ${active === 'profile' ? 'active' : ''}`} type="button" onClick={() => { closeSidebar(); onNavigateProfile(); }}>
            <SidebarIcon name="profile" /> Profile
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
