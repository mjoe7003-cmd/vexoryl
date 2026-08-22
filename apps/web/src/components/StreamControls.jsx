import React, { useEffect, useRef, useState } from 'react';
import { Coffee, Diamond, Flower2, Gift, LoaderCircle, Radio, Send, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useTranslation } from '../i18n/I18n.jsx';

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const gifts = [
  { type: 'coffee', label: 'Coffee', amount: 2, icon: Coffee },
  { type: 'rose', label: 'Rose', amount: 5, icon: Flower2 },
  { type: 'diamond', label: 'Diamond', amount: 25, icon: Diamond },
];

function getStoredToken() {
  return window.localStorage.getItem('vexoryl_token');
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || getStoredToken();
}

async function fetchWithTimeout(url, options, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request timed out. Check your connection and try again.');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function StreamControls({ streamId, recipientId, activeChallenge = { prompt: 'Fund the next creator action', current: 0, target: 100 } }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [contribution, setContribution] = useState('10');
  const [challenge, setChallenge] = useState(activeChallenge);
  const pendingRequests = useRef(new Set());

  useEffect(() => {
    setChallenge(activeChallenge);
  }, [activeChallenge]);

  useEffect(() => {
    if (!streamId || !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return undefined;
    const channel = supabase.channel(`director-${streamId}`)
      .on('broadcast', { event: 'bid-contribution' }, ({ payload }) => {
        console.log('[Vexoryl] Director Mode broadcast received', { streamId, payload });
        if (payload.request_id && pendingRequests.current.delete(payload.request_id)) return;
        setChallenge((current) => ({ ...current, current: Number(current.current) + Number(payload.amount) }));
      })
      .subscribe((status) => {
        console.log('[Vexoryl] Director Mode channel status', { streamId, status });
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') showNotice('error', 'Director Mode realtime is temporarily unavailable.');
      });
    return () => supabase.removeChannel(channel);
  }, [streamId]);

  const showNotice = (type, message) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const sendGift = async (selectedGift) => {
    if (!recipientId) return showNotice('error', 'This room has no gift recipient yet.');
    if (!navigator.onLine) return showNotice('error', 'You are offline. Reconnect before sending a gift.');
    setBusy(`gift-${selectedGift.type}`);
    const requestId = crypto.randomUUID();
    const payload = { recipient_id: recipientId, gift_type: selectedGift.type, amount: selectedGift.amount, request_id: requestId };
    console.log('[Vexoryl] Sending gift', { endpoint: `${API}/monetization/gift`, payload });
    try {
      const token = await getAccessToken();
      const response = await fetchWithTimeout(`${API}/monetization/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log('[Vexoryl] Gift response', { status: response.status, ok: response.ok, data });
      if (!response.ok) throw new Error(data.error || 'Gift could not be sent');
      console.log('[Vexoryl] Gift ledger updated', { gift: data.gift, wallet: data.wallet });
      showNotice('success', `${selectedGift.label} sent successfully`);
    } catch (error) {
      console.error('[Vexoryl] Gift request failed', { payload, error });
      showNotice('error', error.message);
    } finally {
      setBusy('');
    }
  };

  const contribute = async (event) => {
    event.preventDefault();
    const amount = Number(contribution);
    if (!streamId || !Number.isFinite(amount) || amount <= 0) return showNotice('error', 'Enter a positive contribution.');
    if (!navigator.onLine) return showNotice('error', 'You are offline. Reconnect before placing a bid.');
    setBusy('bid');
    const requestId = crypto.randomUUID();
    const previousChallenge = challenge;
    pendingRequests.current.add(requestId);
    const payload = { task_prompt: challenge.prompt, bid_amount: amount, request_id: requestId };
    console.log('[Vexoryl] Placing Director Mode bid', { endpoint: `${API}/streams/${streamId}/task-bids`, payload });
    setChallenge((current) => ({ ...current, current: Number(current.current) + amount }));
    try {
      const token = await getAccessToken();
      const response = await fetchWithTimeout(`${API}/streams/${streamId}/task-bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log('[Vexoryl] Director Mode bid response', { status: response.status, ok: response.ok, data });
      if (!response.ok) throw new Error(data.error || 'Contribution could not be submitted');
      const realtimeEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (realtimeEnabled) {
        const channel = supabase.channel(`director-${streamId}`);
        channel.subscribe(async (status) => {
          console.log('[Vexoryl] Director Mode broadcast channel status', { streamId, status, payload });
          if (status === 'SUBSCRIBED') {
            try {
              const result = await channel.send({ type: 'broadcast', event: 'bid-contribution', payload: { amount } });
              console.log('[Vexoryl] Director Mode broadcast sent', { streamId, result, payload: { amount } });
              if (result !== 'ok') throw new Error('Realtime broadcast was rejected');
            } catch (broadcastError) {
              console.error('[Vexoryl] Director Mode broadcast failed', { streamId, payload: { amount }, error: broadcastError });
              showNotice('error', 'Bid was recorded, but the live Director Mode update failed.');
            } finally {
              await supabase.removeChannel(channel);
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[Vexoryl] Director Mode broadcast connection failed', { streamId, status, payload });
            showNotice('error', 'Bid was recorded, but Director Mode could not update live.');
          }
        });
      } else {
        pendingRequests.current.delete(requestId);
      }
      console.log('[Vexoryl] Director Mode ledger/bid accepted', { bid: data.bid, wallet: data.wallet, amount });
      showNotice('success', 'Your contribution is live in the pool');
      setContribution('10');
    } catch (error) {
      pendingRequests.current.delete(requestId);
      setChallenge(previousChallenge);
      console.error('[Vexoryl] Director Mode bid failed', { payload, error });
      showNotice('error', error.message);
    } finally {
      setBusy('');
    }
  };

  const progress = Math.min(100, (Number(challenge.current) / Number(challenge.target || 1)) * 100);
  return (
    <section className="stream-controls" aria-label="Stream controls">
      {notice && <div className={`stream-control-notice ${notice.type}`} role="alert"><Sparkles size={15} /> {notice.message}</div>}
      <div className="stream-control-section">
        <div className="panel-header"><Gift size={16} /><span>{t('gifts')}</span></div>
        <div className="gift-grid">
          {gifts.map((item) => {
            const Icon = item.icon;
            return <button key={item.type} className="gift-option" type="button" onClick={() => sendGift(item)} disabled={Boolean(busy)}><Icon size={20} /><strong>{item.label}</strong><small>${item.amount}</small>{busy === `gift-${item.type}` && <LoaderCircle className="spin" size={14} />}</button>;
          })}
        </div>
      </div>
      <div className="stream-control-section director-control">
        <div className="panel-header"><Radio size={16} /><span>{t('director')}</span></div>
        <strong>{challenge.prompt}</strong>
        <div className="pool-meter"><span style={{ width: `${progress}%` }} /></div>
        <small>${Number(challenge.current).toFixed(2)} of ${Number(challenge.target).toFixed(2)}</small>
        <form className="pool-form" onSubmit={contribute}><input type="number" min="1" step="0.01" value={contribution} onChange={(event) => setContribution(event.target.value)} aria-label="Contribution amount" /><button type="submit" disabled={Boolean(busy)}>{busy === 'bid' ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} {t('contribute')}</button></form>
      </div>
    </section>
  );
}

export default StreamControls;