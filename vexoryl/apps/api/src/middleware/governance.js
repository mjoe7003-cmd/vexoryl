import { getGovernanceSnapshot } from '../models/store.js';

export function requirePayoutEligibility(req, res, next) {
  const snapshot = getGovernanceSnapshot(req.user.sub);
  const amount = Number(req.body.amount);
  if (Number.isFinite(amount) && amount >= Number(process.env.FRAUD_REVIEW_THRESHOLD || 1000)) {
    return res.status(423).json({ error: 'Payout temporarily restricted pending fraud review', governance: { ...snapshot, blocked: true, reason: 'Transaction spike exceeds review threshold' } });
  }
  if (snapshot.blocked) {
    return res.status(423).json({ error: 'Payout temporarily restricted pending policy review', governance: snapshot });
  }
  req.governance = snapshot;
  next();
}