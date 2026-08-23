import { config } from '../config.js';
import { getStream } from '../models/store.js';
import { recordModerationViolation } from '../models/store.js';
import { notifyCreator } from '../services/notificationService.js';

const toxicTerms = ['kill yourself', 'i will hurt you', 'go die'];
const spamPattern = /(.)\1{8,}|(?:https?:\/\/\S+\s*){4,}/i;

export function moderateText(text) {
  const normalized = String(text || '').trim().toLowerCase();
  let flagLevel = 'none';
  let reason = null;

  if (toxicTerms.some((term) => normalized.includes(term))) {
    flagLevel = 'high';
    reason = 'Threatening or abusive language';
  } else if (spamPattern.test(normalized)) {
    flagLevel = 'medium';
    reason = 'Likely spam';
  }

  return { allowed: flagLevel === 'none', flag_level: flagLevel, reason, timestamp: new Date().toISOString() };
}

async function moderateWithProvider(text) {
  if (!config.moderationApiUrl || !config.moderationApiKey) return null;
  const response = await fetch(config.moderationApiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.moderationApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`Moderation provider returned ${response.status}`);
  const result = await response.json();
  const flagLevel = result.flag_level || (result.flagged ? 'high' : 'none');
  return {
    allowed: result.allowed !== false && flagLevel !== 'high',
    flag_level: flagLevel,
    reason: result.reason || result.category || null,
    timestamp: new Date().toISOString(),
    provider: 'configured',
  };
}

export async function moderateTextInput(req, res, next) {
  const moderation = moderateText(req.body.text || req.body.message);
  try {
    const providerResult = await moderateWithProvider(req.body.text || req.body.message);
    if (providerResult) Object.assign(moderation, providerResult);
  } catch (error) {
    console.error('[Vexoryl] Moderation provider unavailable; using local policy', { error: error.message });
  }
  req.moderation = moderation;
  console.info('[Vexoryl] moderation result', { streamId: req.params.id, moderation });
  if (!moderation.allowed || moderation.flag_level === config.moderationBlockThreshold) {
    const stream = getStream(req.params.id);
    recordModerationViolation(req.user?.sub || 'anonymous', { streamId: req.params.id, creatorId: stream?.creatorId, flagLevel: moderation.flag_level, reason: moderation.reason, timestamp: moderation.timestamp });
    if (stream) notifyCreator(stream.creatorId || stream.creator, { type: 'moderation', title: 'Chat message blocked', reason: moderation.reason, flagLevel: moderation.flag_level, streamId: stream.id, createdAt: moderation.timestamp }).catch((error) => console.error('[Vexoryl] moderation notification failed', error));
    return res.status(422).json({ error: 'Message blocked by moderation', moderation });
  }
  next();
}