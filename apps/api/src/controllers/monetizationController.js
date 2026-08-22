import { getWallet, recordPolicyAudit, requestPayout } from '../models/store.js';
import { evaluateTransaction, logPolicyDecision } from '../services/policyService.js';
import { notifyCreator } from '../services/notificationService.js';

export function payout(req, res) {
  const amount = Number(req.body.amount);
  const currency = String(req.body.currency || 'USD').toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Payout amount must be positive' });
  if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: 'Currency must be a 3-letter ISO code' });
  const requestKey = req.get('Idempotency-Key') || req.body.request_id;
  if (!requestKey || !/^[0-9a-f-]{36}$/i.test(requestKey)) return res.status(400).json({ error: 'A valid Idempotency-Key UUID is required' });
  const policy = logPolicyDecision(evaluateTransaction({ type: 'payout', amount }), { userId: req.user.sub, requestKey });
  recordPolicyAudit(policy);
  const payoutRequest = requestPayout(req.user.sub, amount, currency, requestKey);
  if (!payoutRequest) return res.status(409).json({ error: 'Insufficient available wallet balance', wallet: getWallet(req.user.sub) });
  payoutRequest.payoutMode = policy.payoutMode;
  payoutRequest.fee = policy.fee;
  notifyCreator(req.user.sub, { type: 'payout', title: `${policy.payoutMode === 'instant' ? 'Instant' : 'Scheduled'} payout requested`, amount, createdAt: new Date().toISOString() }).catch((error) => console.error('[Vexoryl] payout notification failed', error));
  return res.status(202).json({ payout: payoutRequest, wallet: payoutRequest.wallet, policy });
}