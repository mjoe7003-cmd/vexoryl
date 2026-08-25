import { createClip, createSubscription, getStream, getWallet } from '../models/store.js';

function validRequestKey(req) {
  const key = req.get('Idempotency-Key') || req.body.request_id;
  return key && /^[0-9a-f-]{36}$/i.test(key) ? key : null;
}

export function subscribe(req, res) {
  const creatorId = String(req.body.creator_id || '').trim();
  const amount = Number(req.body.amount);
  const requestKey = validRequestKey(req);
  if (!creatorId || !Number.isFinite(amount) || amount < 1 || amount > 500) return res.status(400).json({ error: 'Subscription amount must be between $1 and $500' });
  if (!requestKey) return res.status(400).json({ error: 'A valid Idempotency-Key UUID is required' });
  const subscription = createSubscription(req.user.sub, creatorId, Number(amount.toFixed(2)), requestKey);
  if (subscription.error) return res.status(409).json({ error: subscription.error });
  return res.status(201).json({ subscription, wallet: getWallet(req.user.sub) });
}

export function requestClip(req, res) {
  const stream = getStream(req.params.id);
  const startTime = Number(req.body.start_time);
  const duration = Number(req.body.duration || 30);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  if (!Number.isFinite(startTime) || startTime < 0 || !Number.isFinite(duration) || duration < 5 || duration > 90) return res.status(400).json({ error: 'Clip timing is invalid' });
  return res.status(201).json({ clip: createClip(req.user.sub, stream.id, Number(startTime.toFixed(2)), Math.round(duration)) });
}