import { getCreatorSettings, updateCreatorSettings } from '../models/store.js';

export function settings(req, res) { return res.json({ settings: getCreatorSettings(req.query.creator_id || req.user.sub) }); }

export function updateSettings(req, res) {
  const ttsMinAmount = Number(req.body.ttsMinAmount);
  const gifts = Array.isArray(req.body.gifts) ? req.body.gifts : [];
  if (!Number.isFinite(ttsMinAmount) || ttsMinAmount < 1 || ttsMinAmount > 500) return res.status(400).json({ error: 'TTS minimum must be between $1 and $500' });
  if (gifts.length < 1 || gifts.length > 8 || gifts.some((gift) => !/^[a-z0-9_-]{2,32}$/i.test(String(gift.type || '')) || !String(gift.label || '').trim() || !Number.isFinite(Number(gift.amount)) || Number(gift.amount) < 1 || Number(gift.amount) > 500)) return res.status(400).json({ error: 'Add 1 to 8 gifts priced between $1 and $500' });
  return res.json({ settings: updateCreatorSettings(req.user.sub, { ttsMinAmount: Number(ttsMinAmount.toFixed(2)), gifts: gifts.map((gift) => ({ type: String(gift.type).toLowerCase(), label: String(gift.label).trim().slice(0, 32), amount: Number(Number(gift.amount).toFixed(2)) })) }) });
}