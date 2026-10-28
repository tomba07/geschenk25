import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import LoginScreen from './LoginScreen';
import ProfileSetupScreen from './ProfileSetupScreen';

export default function ExchangeInviteScreen({ token, onSignup, onOpen }: { token: string; onSignup: () => void; onOpen: (id: number) => void }) {
  const { isAuthenticated, profileComplete } = useAuth();
  const [invite, setInvite] = useState<{ name: string; organizer: string; closed: boolean } | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setInvite(null); setError(''); setPending(false);
    apiClient.getExchangeInvite(token).then(response => {
      if (cancelled) return;
      if (response.error) setError(response.error);
      else setInvite(response.data!.invite);
    });
    return () => { cancelled = true; };
  }, [token]);
  const requestJoin = async () => {
    setBusy(true); setError('');
    try {
      const response = await apiClient.requestExchangeJoin(token);
      if (response.error) { setError(response.error); return; }
      try { localStorage.removeItem('geschenk.pending_exchange_invite'); } catch { /* optional persistence */ }
      if (response.data?.status === 'member') onOpen(response.data.group_id!);
      else setPending(true);
    } finally { setBusy(false); }
  };
  if (login && !isAuthenticated) return <LoginScreen onSwitchToSignup={onSignup} />;
  if (isAuthenticated && !profileComplete) return <ProfileSetupScreen />;
  return <section className="auth-screen"><div className="modal-panel">
    <h1>{invite ? `Join ${invite.name}` : error ? 'Invitation unavailable' : 'Loading invitation…'}</h1>
    {invite && <p>Organized by @{invite.organizer}. The organizer must approve your request before you can see members, gift ideas, or messages.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {invite?.closed ? <p>Names have been drawn. Invitations are closed. Contact the organizer if you need help.</p>
      : invite && (pending ? <p role="status">Request sent. Awaiting organizer approval. After approval, the exchange will appear in your groups.</p>
        : <button className="primary-button" disabled={busy} onClick={() => {
          if (isAuthenticated) void requestJoin();
          else {
            try { localStorage.setItem('geschenk.pending_exchange_invite', token); } catch { /* same-tab login still works */ }
            setLogin(true);
          }
        }}>{busy ? 'Sending…' : isAuthenticated ? 'Request to join' : 'Sign in to request to join'}</button>)}
    <a href="/">Go to my groups</a>
  </div></section>;
}
