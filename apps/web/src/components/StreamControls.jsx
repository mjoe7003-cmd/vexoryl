import React, { useEffect, useRef, useState } from 'react';
import { Coffee, Diamond, Flower2, Gift, LoaderCircle, Radio, Send, Sparkles, Ticket } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { sendGift as sendGiftRequest, createTaskBid, purchaseStreamAccess } from '../lib/api.js';
import { useTranslation } from '../i18n/I18n.jsx';

const gifts = [
  { type: 'coffee', label: 'Coffee', amount: 2, icon: Coffee },
  { type: 'rose', label: 'Rose', amount: 5, icon: Flower2 },
  { type: 'diamond', label: 'Diamond', amount: 25, icon: Diamond },
];

export function StreamControls({ streamId, recipientId, ppvPrice = 0, activeChallenge = { prompt: 'Fund the next creator action', current: 0, target: 100 } }) {
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
    console.log('[Vexoryl] Sending gift', payload);
    try {
      const data = await sendGiftRequest(recipientId, selectedGift.type, selectedGift.amount, requestId);
      console.log('[Vexoryl] Gift ledger updated', { data });
      showNotice('success', `${selectedGift.label} sent successfully`);
    } catch (error) {
      console.error('[Vexoryl] Gift request failed', { payload, error });
      showNotice('error', error.message);
    } finally {
      setBusy('');
    }
  };

  const buyAccess = async () => {
    if (!ppvPrice) return showNotice('error', 'This room is free to watch.');
    if (!navigator.onLine) return showNotice('error', 'You are offline. Reconnect before purchasing access.');
    setBusy('ppv');
    const requestId = crypto.randomUUID();
    try {
      await purchaseStreamAccess(streamId, requestId);
      showNotice('success', 'Access purchased successfully');
    } catch (error) {
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
    console.log('[Vexoryl] Placing Director Mode bid', payload);
    setChallenge((current) => ({ ...current, current: Number(current.current) + amount }));
    try {
      const data = await createTaskBid(streamId, challenge.prompt, amount);
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
      console.log('[Vexoryl] Director Mode ledger/bid accepted', { bid: data, amount });
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
      {ppvPrice > 0 && <div className="stream-control-section ppv-control"><div><div className="panel-header"><Ticket size={16} /><span>Pay per view</span></div><small>One-time access to this room</small></div><button className="primary-button" type="button" onClick={buyAccess} disabled={Boolean(busy)}>{busy === 'ppv' ? <LoaderCircle className="spin" size={16} /> : <Ticket size={16} />} Buy for ${Number(ppvPrice).toFixed(2)}</button></div>}
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