import { getWallet, recordPolicyAudit, sendGift } from '../models/store.js';
import { evaluateTransaction, logPolicyDecision } from '../services/policyService.js';
import { notifyCreator } from '../services/notificationService.js';

export function gift(req, res) {
  const recipientId = String(req.body.recipient_id || '').trim();
  const giftType = String(req.body.gift_type || '').trim().toLowerCase();
  const amount = Number(req.body.amount);
  if (!recipientId || !giftType || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Recipient, gift type, and a positive amount are required' });
  }
  const requestKey = req.get('Idempotency-Key') || req.body.request_id;
  if (!requestKey || !/^[0-9a-f-]{36}$/i.test(requestKey)) return res.status(400).json({ error: 'A valid Idempotency-Key UUID is required' });
  const policy = logPolicyDecision(evaluateTransaction({ type: 'gift', amount }), { userId: req.user.sub, requestKey });
  recordPolicyAudit(policy);
  const result = sendGift(req.user.sub, recipientId, giftType, amount, requestKey, policy.netAmount);
  if (result.error === 'Recipient not found') return res.status(404).json({ error: result.error });
  if (result.error) return res.status(409).json({ error: result.error });
  notifyCreator(recipientId, { type: 'gift', title: `You received a ${giftType}`, amount: policy.netAmount, createdAt: new Date().toISOString() }).catch((error) => console.error('[Vexoryl] gift notification failed', error));
  return res.status(201).json({ gift: { ...result, fee: policy.fee, net_amount: policy.netAmount }, wallet: getWallet(req.user.sub), policy });
}