import { addMessage, addTaskBid, addWalletEntry, claimDirectorTrigger, createCommunityPost, createStream, exportAudience, followCreator, getAnalytics, getMessages, getMonitoringSnapshot, getStream, getTaskBids, getDirectorPool, getWallet, hasStreamAccess, listCommunityFeed, listFollowing, listStreams, panicStopStream, purchaseStreamAccess, setStreamStatus, unfollowCreator } from '../models/store.js';
import { createMuxLiveStream } from '../services/muxService.js';
import { broadcastDirectorTrigger } from '../services/directorService.js';
import { notifyCreator } from '../services/notificationService.js';
import { getCreatorAnalytics } from '../services/analyticsService.js';

export function browse(req, res) { res.json({ streams: listStreams() }); }
export function following(req, res) { res.json({ creatorIds: listFollowing(req.user.sub) }); }
export function follow(req, res) { res.json({ creatorIds: followCreator(req.user.sub, req.params.creatorId) }); }
export function unfollow(req, res) { res.json({ creatorIds: unfollowCreator(req.user.sub, req.params.creatorId) }); }
export function purchaseAccess(req, res) {
  const stream = getStream(req.params.id);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  const amount = Number(stream.ppvPrice || req.body.amount);
  const requestKey = req.get('Idempotency-Key') || req.body.request_id;
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'This stream is free or has no valid access price' });
  if (!requestKey || !/^[0-9a-f-]{36}$/i.test(requestKey)) return res.status(400).json({ error: 'A valid Idempotency-Key UUID is required' });
  if (hasStreamAccess(stream.id, req.user.sub)) return res.status(200).json({ access: true, alreadyOwned: true });
  const purchase = purchaseStreamAccess(stream, req.user.sub, amount, requestKey);
  if (!purchase) return res.status(409).json({ error: 'Insufficient available wallet balance', wallet: getWallet(req.user.sub) });
  return res.status(201).json({ access: true, purchase, wallet: purchase.wallet });
}
export function communityFeed(req, res) { res.json({ posts: listCommunityFeed(req.user.sub) }); }
export function communityPost(req, res) { const body = String(req.body.body || '').trim(); if (!body || body.length > 500) return res.status(400).json({ error: 'Post body must be between 1 and 500 characters' }); res.status(201).json({ post: createCommunityPost(req.user.sub, body) }); }
export function audienceExport(req, res) { res.json({ audience: exportAudience(req.user.sub) }); }
export function detail(req, res) { const stream = getStream(req.params.id); if (!stream) return res.status(404).json({ error: 'Stream not found' }); const vodAvailable = stream.status === 'ended' && !stream.vodDeletedAt && (!stream.vodExpiresAt || new Date(stream.vodExpiresAt) > new Date()); res.json({ stream, vodAvailable, messages: getMessages(stream.id) }); }
export function create(req, res) { const stream = createStream({ title: req.body.title || 'Untitled stream', category: req.body.category || 'Just Chatting', description: req.body.description || '', accent: '#d9f85a', tags: req.body.tags || [], ppvPrice: req.body.ppvPrice }, req.user); res.status(201).json({ stream }); }
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
      muxAssetId: muxStream.asset_id,
      playbackUrl: muxStream.playback_url,
      vodRetentionHours: muxStream.vod_retention_hours,
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
export function transition(req, res) { const stream = setStreamStatus(req.params.id, req.params.action === 'start' ? 'live' : 'ended', req.user.sub); if (!stream) return res.status(404).json({ error: 'Stream not found' }); res.json({ stream }); }
export function panic(req, res) { const stream = panicStopStream(req.params.id, req.user.sub, String(req.body.reason || 'creator_emergency_stop').slice(0, 120)); if (!stream) return res.status(404).json({ error: 'Stream not found or creator access required' }); res.status(202).json({ emergencyStopped: true, stream }); }
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
export function walletBalance(req, res) { res.json({ wallet: getWallet(req.user.sub) }); }
export async function analytics(req, res) { try { res.json(await getCreatorAnalytics(req.user.sub)); } catch (error) { console.error('[Vexoryl] analytics request failed', error); res.status(503).json({ error: 'Analytics temporarily unavailable' }); } }
export function monitoring(req, res) { res.json(getMonitoringSnapshot()); }
