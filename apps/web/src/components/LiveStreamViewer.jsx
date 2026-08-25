import React, { useEffect, useMemo, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { MessageCircle, Send, Trophy, TrendingUp } from 'lucide-react';
import { API, apiFetch } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

const STREAM_ID = 'stream-1';
const authToken = () => window.localStorage.getItem('vexoryl_token');

export function LiveStreamViewer({ playbackId, streamId = STREAM_ID, title = 'Live stream' }) {
  const [chatMessages, setChatMessages] = useState([
    { id: 'welcome-1', author: 'system', text: 'Welcome to the room — chat is live.', created_at: new Date().toISOString() },
  ]);
  const [taskBids, setTaskBids] = useState([
    { id: 'bid-1', task_prompt: 'Create a cinematic intro loop', bid_amount: 24, status: 'pending' },
    { id: 'bid-2', task_prompt: 'Swap in a brighter overlay for the next segment', bid_amount: 18, status: 'pending' },
  ]);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftBid, setDraftBid] = useState({ amount: '25', prompt: 'Create a dramatic visual transition' });

  useEffect(() => {
    if (!streamId) return;

    apiFetch(`${API}/streams/${streamId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          setChatMessages(data.messages.map((message) => ({
            ...message,
            author: message.author || 'Guest',
            text: message.text || message.message,
          })));
        }
      })
      .catch(() => {});

    const token = authToken();
    if (token) {
      apiFetch(`${API}/streams/${streamId}/task-bids`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (Array.isArray(data?.bids)) setTaskBids(data.bids);
        })
        .catch(() => {});
    }

    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      const channel = supabase.channel(`stream-chat-${streamId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `stream_id=eq.${streamId}`,
        }, (payload) => {
          setChatMessages((current) => [...current, payload.new]);
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'task_bids',
          filter: `stream_id=eq.${streamId}`,
        }, (payload) => {
          setTaskBids((current) => {
            const next = [...current, payload.new];
            return next.sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount)).slice(0, 6);
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [streamId]);

  const topBid = useMemo(() => taskBids.reduce((best, current) => {
    if (!best || Number(current.bid_amount) > Number(best.bid_amount)) return current;
    return best;
  }, null), [taskBids]);

  const sendChatMessage = async (event) => {
    event.preventDefault();
    if (!draftMessage.trim()) return;

    const text = draftMessage.trim();
    const token = authToken();
    if (token) {
      const response = await apiFetch(`${API}/streams/${streamId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setChatMessages((current) => [...current, { ...data.message, author: data.message.author || 'You', text: data.message.text }]);
    } else {
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), author: 'You', text, created_at: new Date().toISOString() }]);
    }

    setDraftMessage('');
  };

  const submitBid = async (event) => {
    event.preventDefault();
    const bidAmount = Number(draftBid.amount);
    if (!draftBid.prompt.trim() || !Number.isFinite(bidAmount) || bidAmount <= 0) return;

    const token = authToken();
    if (token) {
      const response = await apiFetch(`${API}/streams/${streamId}/task-bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task_prompt: draftBid.prompt.trim(), bid_amount: bidAmount }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setTaskBids(data.topBids || []);
    } else {
      const bid = {
        id: crypto.randomUUID(),
        stream_id: streamId,
        user_id: 'demo-user',
        task_prompt: draftBid.prompt.trim(),
        bid_amount: bidAmount,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setTaskBids((current) => [...current, bid].sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount)).slice(0, 6));
    }
    setDraftBid({ amount: '25', prompt: 'Create a dramatic visual transition' });
  };

  return (
    <div className="live-stream-viewer">
      <div className="viewer-main">
        <div className="viewer-header">
          <div>
            <p className="eyebrow"><span className="pulse"></span> Watching now</p>
            <h2>{title}</h2>
          </div>
          {topBid && (
            <div className="top-bid-pill">
              <Trophy size={15} /> Top bid: ${Number(topBid.bid_amount).toFixed(2)}
            </div>
          )}
        </div>

        <div className="mux-player-wrap">
          {playbackId ? (
            <MuxPlayer
              playbackId={playbackId}
              metadata={{
                video_id: playbackId,
                video_title: title,
                viewer_user_id: 'demo-user',
              }}
              accentColor="#d9f85a"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div className="player-placeholder">
              <div className="player-center">
                <span className="play-icon">▶</span>
                <span>Live session unavailable</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="viewer-sidebar">
        <div className="panel chat-panel">
          <div className="panel-header">
            <MessageCircle size={16} />
            <span>Live chat</span>
          </div>
          <div className="chat-list">
            {chatMessages.map((entry) => (
              <div key={entry.id} className="chat-message">
                <strong>{entry.author || 'Guest'}:</strong>
                <span>{entry.text || entry.message}</span>
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={sendChatMessage}>
            <input
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder="Send a message"
            />
            <button type="submit"><Send size={16} /></button>
          </form>
        </div>

        <div className="panel bid-panel">
          <div className="panel-header">
            <TrendingUp size={16} />
            <span>Top bids</span>
          </div>
          <div className="bid-list">
            {taskBids.map((bid) => (
              <div key={bid.id} className="bid-item">
                <div>
                  <strong>${Number(bid.bid_amount).toFixed(2)}</strong>
                  <small>{bid.task_prompt}</small>
                </div>
                <span>{bid.status}</span>
              </div>
            ))}
          </div>

          <form className="bid-form" onSubmit={submitBid}>
            <input
              value={draftBid.prompt}
              onChange={(event) => setDraftBid((current) => ({ ...current, prompt: event.target.value }))}
              placeholder="Task prompt"
            />
            <div className="bid-row">
              <input
                type="number"
                min="1"
                value={draftBid.amount}
                onChange={(event) => setDraftBid((current) => ({ ...current, amount: event.target.value }))}
                placeholder="Amount"
              />
              <button type="submit">Bid</button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}
