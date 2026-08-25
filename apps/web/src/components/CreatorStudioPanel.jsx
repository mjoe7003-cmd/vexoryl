import { useEffect, useState } from 'react';
import { AudioLines, CircleStop, Disc3, Gavel, Plus, Save, Settings2, Video } from 'lucide-react';
import { API, apiFetch } from '../lib/api.js';
import './CreatorStudioPanel.css';

const defaultSettings = { ttsMinAmount: 5, gifts: [{ type: 'coffee', label: 'Coffee', amount: 2 }] };

export default function CreatorStudioPanel() {
  const [studioOn, setStudioOn] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [status, setStatus] = useState('');
  const [bids, setBids] = useState([]);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    const token = window.localStorage.getItem('vexoryl_token');
    apiFetch(`${API}/creator/settings`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((response) => response.json()).then((data) => { if (data.settings) setSettings(data.settings); }).catch(() => null);
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem('vexoryl_token');
    const loadStream = () => apiFetch(`${API}/creator/streams`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((response) => response.json()).then((data) => {
      const streams = Array.isArray(data.streams) ? data.streams : [];
      setStream(streams.find((item) => item.status === 'live') || streams[0] || null);
    }).catch(() => null);
    loadStream();
    const streamTimer = window.setInterval(loadStream, 10000);
    return () => window.clearInterval(streamTimer);
  }, []);

  useEffect(() => {
    if (!stream) { setBids([]); return undefined; }
    const token = window.localStorage.getItem('vexoryl_token');
    const loadBids = () => apiFetch(`${API}/streams/${stream.id}/task-bids`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((response) => response.json()).then((data) => setBids(Array.isArray(data.bids) ? data.bids : [])).catch(() => null);
    loadBids();
    const timer = window.setInterval(loadBids, 5000);
    return () => window.clearInterval(timer);
  }, [stream]);

  const updateGift = (index, field, value) => setSettings((current) => ({ ...current, gifts: current.gifts.map((gift, giftIndex) => giftIndex === index ? { ...gift, [field]: field === 'amount' ? Number(value) : value } : gift) }));
  const addGift = () => setSettings((current) => current.gifts.length >= 8 ? current : ({ ...current, gifts: [...current.gifts, { type: `gift-${current.gifts.length + 1}`, label: 'New gift', amount: 5 }] }));
  const saveSettings = async () => {
    const token = window.localStorage.getItem('vexoryl_token');
    const response = await apiFetch(`${API}/creator/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(settings) });
    const data = await response.json();
    setStatus(response.ok ? 'Settings saved' : data.error || 'Settings could not be saved');
  };

  const poolTotal = bids.reduce((total, bid) => total + Number(bid.bid_amount || 0), 0);
  return <section className="studio-panel" aria-label="Creator studio"><div className="studio-panel-header"><div><p className="eyebrow">Broadcast control</p><h2>Vexoryl Studio</h2><p>{stream ? `Controlling ${stream.title}. Bring your camera, mic, scenes, and live interactions into one room.` : 'Create a stream to unlock your live control room.'}</p></div><button className={studioOn ? 'studio-toggle on' : 'studio-toggle'} type="button" onClick={() => setStudioOn((current) => !current)}>{studioOn ? <CircleStop size={16} /> : <Disc3 size={16} />} {studioOn ? 'Studio live' : 'Turn on studio'}</button></div><div className="studio-source-grid"><div className={studioOn ? 'studio-source active' : 'studio-source'}><Video size={18} /><strong>Camera</strong><small>{studioOn ? 'Preview ready' : 'Not connected'}</small></div><div className={studioOn ? 'studio-source active' : 'studio-source'}><AudioLines size={18} /><strong>Microphone</strong><small>{studioOn ? 'Input detected' : 'Not connected'}</small></div><div className="studio-source"><Settings2 size={18} /><strong>Scenes</strong><small>Starting soon · Live · Away</small></div></div><div className="live-bidding-panel"><div className="settings-heading"><div><p className="eyebrow">Live interaction</p><h3>Director bidding</h3><p>{stream ? 'Viewers are funding the next action in real time.' : 'Your live bidding panel will appear when you have a stream.'}</p></div><Gavel size={19} /></div><div className="bid-progress"><span style={{ width: `${Math.min(100, poolTotal)}%` }} /></div><div className="bid-summary"><strong>${poolTotal.toFixed(2)}</strong><span>of $100 target · {bids.length} bids</span></div><div className="bid-list">{bids.length ? bids.slice(0, 5).map((bid) => <div className="bid-row" key={bid.id}><span>{bid.task_prompt}</span><strong>${Number(bid.bid_amount).toFixed(2)}</strong></div>) : <p className="control-hint">Waiting for the first viewer bid.</p>}</div></div><div className="creator-settings"><div className="settings-heading"><div><h3>Monetization controls</h3><p>Set what TTS and custom gifts mean in your room.</p></div><button className="secondary-button" type="button" onClick={saveSettings}><Save size={15} /> Save</button></div><label>TTS minimum amount<input type="number" min="1" max="500" step="1" value={settings.ttsMinAmount} onChange={(event) => setSettings((current) => ({ ...current, ttsMinAmount: Number(event.target.value) }))} /></label><div className="gift-settings"><div className="settings-heading"><h4>Custom gifts</h4><button className="icon-action" type="button" onClick={addGift} title="Add custom gift"><Plus size={16} /></button></div>{settings.gifts.map((gift, index) => <div className="gift-setting-row" key={`${gift.type}-${index}`}><input aria-label="Gift label" value={gift.label} onChange={(event) => updateGift(index, 'label', event.target.value)} /><input aria-label="Gift amount" type="number" min="1" max="500" value={gift.amount} onChange={(event) => updateGift(index, 'amount', event.target.value)} /><span>USD</span></div>)}</div>{status && <p className="studio-status" role="status">{status}</p>}</div></section>;
}
