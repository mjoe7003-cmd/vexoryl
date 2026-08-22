const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 5);
const instantThreshold = Number(process.env.PAYOUT_INSTANT_THRESHOLD || 50);

export function evaluateTransaction({ type, amount }) {
  const fee = Number((amount * feePercent / 100).toFixed(2));
  return {
    type,
    grossAmount: amount,
    fee,
    netAmount: Number((amount - fee).toFixed(2)),
    feePercent,
    payoutMode: type === 'payout' && amount < instantThreshold ? 'scheduled' : type === 'payout' ? 'instant' : undefined,
    risk: amount >= Number(process.env.FRAUD_REVIEW_THRESHOLD || 1000) ? 'review' : 'normal',
    evaluatedAt: new Date().toISOString(),
  };
}

export function logPolicyDecision(decision, context = {}) {
  const entry = { ...decision, ...context };
  console.info('[Vexoryl] monetization policy decision', entry);
  return entry;
}