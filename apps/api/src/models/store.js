import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const users = [];
const streams = [
  { id: 'stream-1', title: 'Midnight Mechanics', category: 'Build & Make', creator: 'Mara Vale', creatorTag: '@maravale', viewers: 1842, status: 'live', accent: '#d9f85a', description: 'A late-night studio session making something useful from almost nothing.', tags: ['craft', 'studio'], featured: true },
  { id: 'stream-2', title: 'The Long Table', category: 'Food & Culture', creator: 'Ari & Sol', creatorTag: '@longtable', viewers: 928, status: 'live', accent: '#f19a5c', description: 'Recipes, stories, and the people behind the plates.', tags: ['food', 'story'], featured: true },
  { id: 'stream-3', title: 'Signal / Noise', category: 'Music', creator: 'Low Orbit FM', creatorTag: '@loworbit', viewers: 611, status: 'live', accent: '#8bd7cf', description: 'An open frequency for strange sounds and soft edges.', tags: ['music', 'radio'], featured: false }
];
const messages = [{ id: randomUUID(), streamId: 'stream-1', author: 'Nico', text: 'That material is gorgeous.', createdAt: new Date().toISOString() }];
const taskBids = new Map();
const wallets = new Map();
const idempotentResults = new Map();
const directorPools = new Map();
const policyAudit = [];

function getIdempotentResult(userId, requestKey) { return requestKey ? idempotentResults.get(`${userId}:${requestKey}`) : null; }
function saveIdempotentResult(userId, requestKey, result) { if (requestKey) idempotentResults.set(`${userId}:${requestKey}`, result); return result; }

export async function createUser({ name, email, password }) {
  if (users.some((user) => user.email === email)) throw new Error('Email already registered');
  const user = { id: randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 10), role: 'creator' };
  users.push(user); wallets.set(user.id, { balance: 0, pending: 0 });
  return publicUser(user);
}

export async function authenticate(email, password) {
  const user = users.find((candidate) => candidate.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  return publicUser(user);
}

export function publicUser(user) { const { passwordHash, ...safeUser } = user; return safeUser; }
export function listStreams() { return streams; }
export function getStream(id) { return streams.find((stream) => stream.id === id); }
export function createStream(input, user) { const stream = { id: randomUUID(), ...input, creatorId: user.id, creator: user.name, creatorTag: `@${user.name.toLowerCase().replace(/\s+/g, '')}`, viewers: 0, status: 'scheduled', featured: false }; streams.unshift(stream); return stream; }
export function setStreamStatus(id, status) { const stream = getStream(id); if (stream) stream.status = status; return stream; }
export function addMessage(streamId, author, text) { const message = { id: randomUUID(), streamId, author, text, createdAt: new Date().toISOString() }; messages.push(message); return message; }
export function getMessages(streamId) { return messages.filter((message) => message.streamId === streamId).slice(-40); }
export function addTaskBid(streamId, userId, dto = {}) {
  const duplicate = getIdempotentResult(userId, dto.requestKey);
  if (duplicate) return duplicate;
  const taskBid = {
    id: randomUUID(),
    stream_id: streamId,
    user_id: userId,
    task_prompt: dto.task_prompt || 'General creator challenge',
    bid_amount: Number(dto.bid_amount) || 0,
    status: dto.status || 'pending',
    created_at: new Date().toISOString(),
  };

  const current = taskBids.get(streamId) || [];
  current.push(taskBid);
  taskBids.set(streamId, current.sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount)));
  const pool = directorPools.get(streamId) || { current: 0, target: Number(dto.target) || 100, triggered: false };
  pool.current += taskBid.bid_amount;
  directorPools.set(streamId, pool);
  return saveIdempotentResult(userId, dto.requestKey, taskBid);
}
export function getTaskBids(streamId) {
  return (taskBids.get(streamId) || []).sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount)).slice(0, 10);
}
export function addWalletEntry(userId, type, amount) { const wallet = wallets.get(userId) || { balance: 0, pending: 0 }; if (type === 'deposit') wallet.balance += amount; if (type === 'withdraw') wallet.balance = Math.max(0, wallet.balance - amount); if (type === 'payout') wallet.pending += amount; wallets.set(userId, wallet); return wallet; }
export function requestPayout(userId, amount, currency = 'USD', requestKey) {
  const duplicate = getIdempotentResult(userId, requestKey);
  if (duplicate) return duplicate;
  const wallet = wallets.get(userId) || { balance: 0, pending: 0, currency };
  if (wallet.balance < amount) return null;
  wallet.balance -= amount;
  wallet.pending += amount;
  wallet.currency = currency;
  wallets.set(userId, wallet);
  return saveIdempotentResult(userId, requestKey, { id: randomUUID(), userId, amount, currency, status: 'pending', createdAt: new Date().toISOString(), wallet });
}
export function getWallet(userId) { return wallets.get(userId) || { balance: 0, pending: 0, currency: 'USD' }; }
export function sendGift(senderId, recipientId, giftType, amount, requestKey, creditAmount = amount) {
  const duplicate = getIdempotentResult(senderId, requestKey);
  if (duplicate) return duplicate;
  if (!users.some((user) => user.id === recipientId)) return { error: 'Recipient not found' };
  const senderWallet = wallets.get(senderId) || { balance: 0, pending: 0, currency: 'USD' };
  if (senderWallet.balance < amount) return { error: 'Insufficient wallet balance' };
  const recipientWallet = wallets.get(recipientId) || { balance: 0, pending: 0, currency: 'USD' };
  senderWallet.balance -= amount;
  recipientWallet.balance += creditAmount;
  wallets.set(senderId, senderWallet);
  wallets.set(recipientId, recipientWallet);
  return saveIdempotentResult(senderId, requestKey, { id: randomUUID(), senderId, recipientId, giftType, amount, currency: 'USD', status: 'completed', createdAt: new Date().toISOString() });
}
export function getDirectorPool(streamId) { return directorPools.get(streamId) || { current: 0, target: 100, triggered: false }; }
export function markDirectorTriggered(streamId) { const pool = getDirectorPool(streamId); pool.triggered = true; directorPools.set(streamId, pool); return pool; }
export function claimDirectorTrigger(streamId) {
  const pool = getDirectorPool(streamId);
  if (pool.triggered || pool.current < pool.target) return false;
  pool.triggered = true;
  directorPools.set(streamId, pool);
  return true;
}
export function recordPolicyAudit(entry) { policyAudit.push(entry); return entry; }
export function recordModerationViolation(userId, entry) { policyAudit.push({ type: 'moderation_violation', userId, ...entry }); }
export function getGovernanceSnapshot(userId) {
  const recent = policyAudit.filter((entry) => entry.userId === userId);
  const violations = recent.filter((entry) => entry.type === 'moderation_violation' && (entry.userId === userId || entry.creatorId === userId)).length;
  const highRisk = recent.filter((entry) => entry.risk === 'review').length;
  return { blocked: violations >= Number(process.env.MODERATION_PAYOUT_BLOCK_COUNT || 5) || highRisk >= Number(process.env.FRAUD_PAYOUT_BLOCK_COUNT || 3), moderationViolations: violations, highRiskTransactions: highRisk, evaluatedAt: new Date().toISOString() };
}
export function getMonitoringSnapshot() {
  return {
    streams: streams.filter((stream) => stream.status === 'live').map((stream) => ({ title: stream.title, status: stream.status, viewers: stream.viewers, health: stream.playbackId || stream.provider ? 'Healthy' : 'Awaiting ingest' })),
    alerts: policyAudit.filter((entry) => entry.type === 'moderation_violation' || entry.risk === 'review').slice(-20),
    anomalies: policyAudit.filter((entry) => entry.risk === 'review').length,
    generatedAt: new Date().toISOString(),
  };
}
export function getAnalytics(userId) {
  const creatorStreams = userId ? streams.filter((stream) => stream.creatorId === userId || stream.creator === users.find((user) => user.id === userId)?.name) : streams;
  return {
    totalViewers: creatorStreams.reduce((sum, stream) => sum + stream.viewers, 0),
    watchHours: 1284,
    engagementRate: 68,
    demographics: [{ name: 'North America', viewers: 42 }, { name: 'Europe', viewers: 28 }, { name: 'Asia', viewers: 21 }, { name: 'Other', viewers: 9 }],
    devices: [{ name: 'Mobile', viewers: 61 }, { name: 'Desktop', viewers: 31 }, { name: 'TV', viewers: 8 }],
    engagementHeatmap: Array.from({ length: 12 }, (_, hour) => ({ hour: `${hour + 9}:00`, chat: 12 + ((hour * 7) % 31), director: 2 + ((hour * 3) % 12) })),
    revenue: { subscriptions: 1840, gifts: 960, bids: 740, payouts: 420 },
    streamDurationTrends: creatorStreams.map((stream) => ({ stream: stream.title, minutes: Math.max(1, Math.round((Date.now() - new Date(stream.createdAt || Date.now()).getTime()) / 60000)) })),
    policyAudit: policyAudit.slice(-20),
  };
}
