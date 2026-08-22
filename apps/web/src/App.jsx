import React, { useEffect, useState } from 'react';
import { BarChart3, Coins, Compass, LoaderCircle, Radio, ShieldCheck, Users } from 'lucide-react';
import LiveStreamPlayer from './components/LiveStreamPlayer.jsx';
import StreamControls from './components/StreamControls.jsx';
import { useWallet } from './hooks/useWallet.js';
import { useCreatorNotifications } from './hooks/useCreatorNotifications.js';
import { supabase } from './lib/supabase.js';
import { useTranslation } from './i18n/I18n.jsx';
import CreatorAnalytics from './components/CreatorAnalytics.jsx';
import CreatorOnboarding from './components/CreatorOnboarding.jsx';
import LaunchSection from './components/LaunchSection.jsx';
import MonitoringDashboard from './components/MonitoringDashboard.jsx';
import './phase6.css';

const sampleStream = {
  id: 'stream-1',
  playbackId: '',
  title: 'Midnight Mechanics',
  creator: 'Mara Vale',
  creatorId: import.meta.env.VITE_TEST_CREATOR_ID || '',
  category: 'Build & Make',
  viewers: 1842,
};

function getTokenUser() {
  try {
    const token = window.localStorage.getItem('vexoryl_token');
    return token ? JSON.parse(window.atob(token.split('.')[1])) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { locale, setLocale, t } = useTranslation();
  const [user, setUser] = useState(getTokenUser);
  const [view, setView] = useState('watch');
  const { wallet, loading: walletLoading, error: walletError } = useWallet(user?.sub);
  const { notifications } = useCreatorNotifications(user?.sub);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session?.user) setUser({ sub: data.session.user.id, name: data.session.user.user_metadata?.full_name });
    });
    return () => { active = false; };
  }, []);

  const balance = wallet ? `${wallet.currency} ${Number(wallet.balance).toFixed(2)}` : 'USD 0.00';
  const isAdmin = user?.role === 'admin';
  return (
    <main className="live-page">
      <header className="live-page-header">
        <div className="brand"><span className="brand-mark">V</span><span>Vexoryl</span></div>
        <div className="live-page-tools"><nav className="workspace-nav" aria-label="Workspace"><button className={view === 'watch' ? 'active' : ''} onClick={() => setView('watch')}><Compass size={15} /> Watch</button><button className={view === 'creator' ? 'active' : ''} onClick={() => setView('creator')}><BarChart3 size={15} /> Creator studio</button>{isAdmin && <button className={view === 'monitoring' ? 'active' : ''} onClick={() => setView('monitoring')}><ShieldCheck size={15} /> Monitor</button>}</nav><label className="language-picker"><span className="sr-only">Language</span><select value={locale} onChange={(event) => setLocale(event.target.value)} aria-label="Language"><option value="en">EN</option><option value="fr">FR</option><option value="es">ES</option></select></label><div className="live-wallet" aria-label={t('wallet')}><Coins size={17} /><span>{t('wallet')}</span>{walletLoading ? <LoaderCircle className="spin" /> : <strong>{balance}</strong>}</div></div>
      </header>
      {view === 'creator' && !user && <CreatorOnboarding onComplete={setUser} />}
      {view === 'creator' && user && <CreatorStudio wallet={wallet} walletError={walletError} notifications={notifications} />}
      {view === 'monitoring' && isAdmin && <MonitoringDashboard />}
      {view === 'watch' && <LaunchSection onStart={() => setView('creator')} />}
      {view === 'watch' && <WatchExperience user={user} wallet={wallet} walletError={walletError} notifications={notifications} t={t} />}
    </main>
  );
}

function WatchExperience({ user, wallet, walletError, notifications, t }) {
  return (
      <section className="live-page-content">
        <div className="live-page-kicker"><span className="pulse" /> {t('liveNow')} <span className="live-page-viewers"><Users size={14} /> {sampleStream.viewers.toLocaleString()} {t('watching')}</span></div>
        <div className="live-page-heading"><div><h1>{sampleStream.title}</h1><p>{sampleStream.creator} · {sampleStream.category}</p></div><span className="live-status"><Radio size={14} /> {t('live')}</span></div>
        <div className="live-page-player"><LiveStreamPlayer playbackId={sampleStream.playbackId} fallbackPlaybackId={import.meta.env.VITE_MUX_TEST_PLAYBACK_ID} title={sampleStream.title} viewerId={user?.sub} metadata={{ creator_name: sampleStream.creator }} /></div>
        {walletError && <p className="wallet-inline-error" role="alert">Wallet balance is temporarily unavailable. Gifts may be declined until it reconnects.</p>}
        <StreamControls streamId={sampleStream.id} recipientId={sampleStream.creatorId} activeChallenge={{ prompt: 'Trigger the next studio lighting scene', current: 64, target: 100 }} />
        {notifications.length > 0 && <aside className="creator-notifications" aria-label="Creator notifications"><strong>Creator alerts</strong>{notifications.slice(0, 3).map((notification) => <p key={notification.id}>{notification.title || notification.type}</p>)}</aside>}
      </section>
  );
}

function CreatorStudio({ wallet, walletError, notifications }) {
  return <section className="workspace-content"><div className="workspace-heading"><div><p className="eyebrow">Creator workspace</p><h1>Your room, with instruments.</h1><p>Plan your next broadcast, track momentum, and keep payouts visible.</p></div><span className="workspace-live"><span className="pulse" /> Systems ready</span></div><CreatorAnalytics />{walletError && <p className="wallet-inline-error" role="alert">Wallet balance is temporarily unavailable.</p>}{wallet && <p className="studio-note">Payout balance: <strong>{wallet.currency} {Number(wallet.balance).toFixed(2)}</strong>. {notifications.length ? `${notifications.length} alert${notifications.length === 1 ? '' : 's'} waiting.` : 'No new alerts.'}</p>}</section>;
}