import React, { useEffect, useState } from 'react';
import { BarChart3, Coins, Compass, Heart, LoaderCircle, MessageCircle, Radio, ShieldCheck, Users } from 'lucide-react';
import LiveStreamPlayer from './components/LiveStreamPlayer.jsx';
import StreamControls from './components/StreamControls.jsx';
import { useWallet } from './hooks/useWallet.js';
import { useCreatorNotifications } from './hooks/useCreatorNotifications.js';
import { isSupabaseConfigured, supabase } from './lib/supabase.js';
import { useTranslation } from './i18n/I18n.jsx';
import CreatorAnalytics from './components/CreatorAnalytics.jsx';
import CreatorOnboarding from './components/CreatorOnboarding.jsx';
import LaunchSection from './components/LaunchSection.jsx';
import MonitoringDashboard from './components/MonitoringDashboard.jsx';
import { exportCommunityAudience, getCommunityFeed, getFollowingCreators, listLiveStreams, panicStopStream, publishCommunityPost, setCreatorFollowState } from './lib/api.js';
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
  const [streams, setStreams] = useState([]);
  const [following, setFollowing] = useState([]);
  const { wallet, loading: walletLoading, error: walletError } = useWallet(user?.sub);
  const { notifications } = useCreatorNotifications(user?.sub);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session?.user) setUser({ sub: data.session.user.id, name: data.session.user.user_metadata?.full_name });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { listLiveStreams().then(setStreams).catch(() => setStreams([])); }, []);
  useEffect(() => { if (user) getFollowingCreators().then(setFollowing).catch(() => setFollowing([])); }, [user]);

  const balance = wallet ? `${wallet.currency} ${Number(wallet.balance).toFixed(2)}` : 'USD 0.00';
  const isAdmin = user?.role === 'admin';
  return (
    <main className="live-page">
      <header className="live-page-header">
        <div className="brand"><span className="brand-mark">V</span><span>Vexoryl</span></div>
        <div className="live-page-tools"><nav className="workspace-nav" aria-label="Workspace"><button className={view === 'watch' ? 'active' : ''} onClick={() => setView('watch')}><Compass size={15} /> Watch</button><button className={view === 'community' ? 'active' : ''} onClick={() => setView('community')}><MessageCircle size={15} /> Community</button><button className={view === 'creator' ? 'active' : ''} onClick={() => setView('creator')}><BarChart3 size={15} /> Creator studio</button>{isAdmin && <button className={view === 'monitoring' ? 'active' : ''} onClick={() => setView('monitoring')}><ShieldCheck size={15} /> Monitor</button>}</nav><label className="language-picker"><span className="sr-only">Language</span><select value={locale} onChange={(event) => setLocale(event.target.value)} aria-label="Language"><option value="en">EN</option><option value="fr">FR</option><option value="es">ES</option></select></label><div className="live-wallet" aria-label={t('wallet')}><Coins size={17} /><span>{t('wallet')}</span>{walletLoading ? <LoaderCircle className="spin" /> : <strong>{balance}</strong>}</div></div>
      </header>
      {view === 'creator' && !user && <CreatorOnboarding onComplete={setUser} />}
      {view === 'creator' && user && <CreatorStudio wallet={wallet} walletError={walletError} notifications={notifications} />}
      {view === 'community' && <CommunityView user={user} />}
      {view === 'monitoring' && isAdmin && <MonitoringDashboard />}
      {view === 'watch' && <LaunchSection onStart={() => setView('creator')} />}
      {view === 'watch' && <WatchExperience user={user} wallet={wallet} walletError={walletError} notifications={notifications} t={t} streams={streams} following={following} setFollowing={setFollowing} />}
    </main>
  );
}

function WatchExperience({ user, wallet, walletError, notifications, t, streams, following, setFollowing }) {
  const stream = streams.find((candidate) => candidate.id === 'stream-1') || streams[0] || sampleStream;
  const creatorId = stream.creatorId || stream.creatorTag || stream.creator;
  const isFollowing = following.includes(creatorId);
  async function toggleFollow() {
    if (!user) return;
    setFollowing(await setCreatorFollowState(creatorId, !isFollowing));
  }
  async function panicStop() {
    if (!user || user.sub !== stream.creatorId || !window.confirm('Stop this stream immediately?')) return;
    await panicStopStream(stream.id);
    setStreams((current) => current.filter((candidate) => candidate.id !== stream.id));
  }
  return (
      <section className="live-page-content">
        <div className="live-page-kicker"><span className="pulse" /> {t('liveNow')} <span className="live-page-viewers"><Users size={14} /> {stream.viewers.toLocaleString()} {t('watching')}</span></div>
        <div className="live-page-heading"><div><h1>{stream.title}</h1><p>{stream.creator} · {stream.category}</p></div><span className="live-status"><Radio size={14} /> {t('live')}</span></div>
        <div className="live-page-player"><LiveStreamPlayer playbackId={stream.playbackId} fallbackPlaybackId={import.meta.env.VITE_MUX_TEST_PLAYBACK_ID} title={stream.title} viewerId={user?.sub} metadata={{ creator_name: stream.creator }} /></div>
        <div className="creator-follow-row"><div><strong>{stream.creator}</strong><span>{stream.creatorTag || 'Live creator'}</span></div><div className="creator-action-group" style={{ display: 'flex', gap: 8 }}>{user?.sub === stream.creatorId && <button className="danger-button" style={{ background: '#3a2724', border: '1px solid #b34f3b', color: '#ffb09b', minHeight: 44, padding: '11px 14px' }} type="button" onClick={panicStop}>Panic stop</button>}<button className={isFollowing ? 'secondary-button' : 'primary-button'} onClick={toggleFollow}><Heart size={15} fill={isFollowing ? 'currentColor' : 'none'} /> {isFollowing ? 'Following' : 'Follow'}</button></div></div>
        {walletError && <p className="wallet-inline-error" role="alert">Wallet balance is temporarily unavailable. Gifts may be declined until it reconnects.</p>}
        <StreamControls streamId={stream.id} recipientId={stream.creatorId} ppvPrice={stream.ppvPrice} activeChallenge={{ prompt: 'Trigger the next studio lighting scene', current: 64, target: 100 }} />
        {notifications.length > 0 && <aside className="creator-notifications" aria-label="Creator notifications"><strong>Creator alerts</strong>{notifications.slice(0, 3).map((notification) => <p key={notification.id}>{notification.title || notification.type}</p>)}</aside>}
        <StreamDirectory streams={streams} following={following} setFollowing={setFollowing} user={user} />
      </section>
  );
}

function StreamDirectory({ streams, following, setFollowing, user }) {
  const liveStreams = streams.filter((stream) => stream.status === 'live');
  async function toggleCreator(stream) {
    if (!user) return;
    const creatorId = stream.creatorId || stream.creatorTag || stream.creator;
    setFollowing(await setCreatorFollowState(creatorId, !following.includes(creatorId)));
  }
  return <section className="stream-directory"><div className="directory-heading"><div><p className="eyebrow">Live directory</p><h2>Find your next room.</h2></div><span>{liveStreams.length} live now</span></div><div className="directory-grid">{liveStreams.map((stream) => { const creatorId = stream.creatorId || stream.creatorTag || stream.creator; const isFollowing = following.includes(creatorId); return <article className="directory-card" key={stream.id}><div className="directory-art" style={{ background: stream.accent || '#263b31' }}><Radio size={20} /><span>{stream.viewers.toLocaleString()} watching</span></div><div className="directory-card-body"><div><strong>{stream.title}</strong><small>{stream.creator} · {stream.category}</small></div><button aria-label={`${isFollowing ? 'Unfollow' : 'Follow'} ${stream.creator}`} title={user ? `${isFollowing ? 'Unfollow' : 'Follow'} ${stream.creator}` : 'Sign in to follow'} onClick={() => toggleCreator(stream)}><Heart size={16} fill={isFollowing ? 'currentColor' : 'none'} /></button></div></article>; })}</div></section>;
}

function CreatorStudio({ wallet, walletError, notifications }) {
  return <section className="workspace-content"><div className="workspace-heading"><div><p className="eyebrow">Creator workspace</p><h1>Your room, with instruments.</h1><p>Plan your next broadcast, track momentum, and keep payouts visible.</p></div><span className="workspace-live"><span className="pulse" /> Systems ready</span></div><CreatorAnalytics />{walletError && <p className="wallet-inline-error" role="alert">Wallet balance is temporarily unavailable.</p>}{wallet && <p className="studio-note">Payout balance: <strong>{wallet.currency} {Number(wallet.balance).toFixed(2)}</strong>. {notifications.length ? `${notifications.length} alert${notifications.length === 1 ? '' : 's'} waiting.` : 'No new alerts.'}</p>}</section>;
}

function CommunityView({ user }) {
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (user) getCommunityFeed().then(setPosts).catch((loadError) => setError(loadError.message)); }, [user]);
  async function submitPost(event) { event.preventDefault(); if (!body.trim()) return; try { setError(''); const post = await publishCommunityPost(body); setPosts((current) => [post, ...current]); setBody(''); } catch (postError) { setError(postError.message); } }
  async function downloadAudience() { const audience = await exportCommunityAudience(); const blob = new Blob([JSON.stringify(audience, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'vexoryl-audience.json'; link.click(); URL.revokeObjectURL(link.href); }
  if (!user) return <section className="community-shell"><p className="eyebrow">Community</p><h1>Sign in to join the conversation.</h1></section>;
  return <section className="community-shell"><div className="community-heading"><div><p className="eyebrow">Community</p><h1>People before metrics.</h1><p>Updates from creators you follow, without a recommendation maze.</p></div><button className="secondary-button" type="button" onClick={downloadAudience}>Export audience</button></div><form className="community-composer" onSubmit={submitPost}><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength="500" placeholder="Share an update with your community" aria-label="Community update" /><div><small>{body.length}/500</small><button className="primary-button" type="submit">Publish update</button></div></form>{error && <p className="wallet-inline-error" role="alert">{error}</p>}<div className="community-feed">{posts.length ? posts.map((post) => <article className="community-post" key={post.id}><div className="post-avatar">{post.creatorId === user.sub ? 'YOU' : 'V'}</div><div><strong>{post.creatorId === user.sub ? 'Your update' : 'Creator update'}</strong><time>{new Date(post.createdAt).toLocaleString()}</time><p>{post.body}</p></div></article>) : <p className="community-empty">Your community updates will appear here.</p>}</div></section>;
}