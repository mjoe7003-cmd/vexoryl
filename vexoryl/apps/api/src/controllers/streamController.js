import { addMessage, addTaskBid, addWalletEntry, claimDirectorTrigger, createStream, getAnalytics, getMessages, getMonitoringSnapshot, getStream, getTaskBids, getDirectorPool, listStreams, setStreamStatus } from '../models/store.js';
import { createMuxLiveStream } from '../services/muxService.js';
import { broadcastDirectorTrigger } from '../services/directorService.js';
import { notifyCreator } from '../services/notificationService.js';
import { getCreatorAnalytics } from '../services/analyticsService.js';

export function browse(req, res) { res.json({ streams: listStreams() }); }
export function detail(req, res) { const stream = getStream(req.params.id); if (!stream) return res.status(404).json({ error: 'Stream not found' }); res.json({ stream, messages: getMessages(stream.id) }); }
export function create(req, res) { const stream = createStream({ title: req.body.title || 'Untitled stream', category: req.body.category || 'Just Chatting', description: req.body.description || '', accent: '#d9f85a', tags: req.body.tags || [] }, req.user); res.status(201).json({ stream }); }
export async function createLiveStream(req, res) {
  try {
    const muxStream = await createMuxLiveStream({
      name: req.body.title || 'Vexoryl Stream',
      passthrough: JSON.stringify({ creatorId: req.user.sub, streamTitle: req.body.title || 'Vexoryl Stream' }),
      latency_mode: req.body.latency_mode || 'low',
      playback_policy: req.body.playback_policy || ['public'],
    });

    const stream = createStream({
      title: req.body.title || 'Untitled stream',
      category: req.body.category || 'Just Chatting',
      description: req.body.description || '',
      accent: req.body.accent || '#d9f85a',
      tags: req.body.tags || [],
      muxStreamId: muxStream.id,
      muxStreamKey: muxStream.stream_key,
      playbackId: muxStream.playback_id,
      playbackUrl: muxStream.playback_url,
      provider: 'mux',
    }, req.user);

    return res.status(201).json({
      stream,
      mux: {
        id: muxStream.id,
        stream_key: muxStream.stream_key,
        playback_id: muxStream.playback_id,
        playback_url: muxStream.playback_url,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
export function transition(req, res) { const stream = setStreamStatus(req.params.id, req.params.action === 'start' ? 'live' : 'ended'); if (!stream) return res.status(404).json({ error: 'Stream not found' }); res.json({ stream }); }
export async function connect(req, res) { const stream = getStream(req.params.id); if (!stream) return res.status(404).json({ error: 'Stream not found' }); const previousViewers = stream.viewers; stream.viewers += 1; if (previousViewers < 100 && stream.viewers >= 100) notifyCreator(stream.creatorId || stream.creator, { type: 'milestone', title: '100 viewers reached', streamId: stream.id, createdAt: new Date().toISOString() }).catch((error) => console.error('[Vexoryl] milestone notification failed', error)); res.json({ connected: true, playbackUrl: process.env.STREAM_PLAYBACK_URL || 'https://cdn.example.com/live', protocol: 'webrtc-or-hls' }); }
export function chat(req, res) { const stream = getStream(req.params.id); if (!stream || !req.body.text) return res.status(400).json({ error: 'Stream and text are required' }); console.info('[Vexoryl] moderation result', { streamId: stream.id, moderation: req.moderation }); res.status(201).json({ message: addMessage(stream.id, req.user?.name || 'Guest', req.body.text), moderation: req.moderation }); }
export function listTaskBids(req, res) {
  const stream = getStream(req.params.id);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  return res.json({ bids: getTaskBids(stream.id) });
}
export async function createTaskBid(req, res) {
  const stream = getStream(req.params.id);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  const bidAmount = Number(req.body.bid_amount);
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) return res.status(400).json({ error: 'Bid amount must be a positive number' });
  const taskPrompt = String(req.body.task_prompt || '').trim();
  if (!taskPrompt) return res.status(400).json({ error: 'Task prompt is required' });
  const requestKey = req.get('Idempotency-Key') || req.body.request_id;
  if (!requestKey || !/^[0-9a-f-]{36}$/i.test(requestKey)) return res.status(400).json({ error: 'A valid Idempotency-Key UUID is required' });
  const userId = req.user?.sub || 'guest-user';
  const bid = addTaskBid(stream.id, userId, { task_prompt: taskPrompt, bid_amount: bidAmount, status: 'pending', requestKey });
  const pool = getDirectorPool(stream.id);
  let director = { triggered: false, pool };
  if (claimDirectorTrigger(stream.id)) {
    const delivery = await broadcastDirectorTrigger(stream.id, { event: 'director.threshold-reached', parameters: { amount: pool.current, target: pool.target }, triggeredBy: userId, createdAt: new Date().toISOString() });
    director = { triggered: true, pool: getDirectorPool(stream.id), delivery };
  }
  return res.status(201).json({ bid, topBids: getTaskBids(stream.id), director });
}
export function engage(req, res) { res.status(201).json({ type: req.body.type || 'reaction', accepted: true, streamId: req.params.id }); }
export function wallet(req, res) { const amount = Number(req.body.amount); if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' }); res.json({ wallet: addWalletEntry(req.user.sub, req.body.type || 'deposit', amount), escrow: req.body.type === 'payout' ? 'pending' : 'settled' }); }
export async function analytics(req, res) { try { res.json(await getCreatorAnalytics(req.user.sub)); } catch (error) { console.error('[Vexoryl] analytics request failed', error); res.status(503).json({ error: 'Analytics temporarily unavailable' }); } }
export function monitoring(req, res) { res.json(getMonitoringSnapshot()); }
