import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app.js';

test('signup returns a JWT and public user', async () => {
  const response = await request(app).post('/api/auth/signup').send({ name: 'Test Creator', email: `test-${Date.now()}@vexoryl.test`, password: 'password123' });
  assert.equal(response.status, 201);
  assert.ok(response.body.token);
  assert.equal(response.body.user.passwordHash, undefined);
});

test('streams endpoint exposes featured live content', async () => {
  const response = await request(app).get('/api/streams');
  assert.equal(response.status, 200);
  assert.ok(response.body.streams.length >= 1);
  assert.match(response.headers['cache-control'], /s-maxage=10/);
  assert.ok(response.headers['x-request-id']);
  assert.equal(response.headers['x-vercel-region'], 'local');
  assert.equal(response.headers['server-timing'], 'api');
});

test('authenticated viewers can follow and unfollow creators', async () => {
  const signupResponse = await request(app).post('/api/auth/signup').send({ name: 'Follow Tester', email: `follow-${Date.now()}@vexoryl.test`, password: 'password123' });
  const token = signupResponse.body.token;
  const creatorId = 'creator-mara';

  const followResponse = await request(app).post(`/api/creators/${creatorId}/follow`).set('Authorization', `Bearer ${token}`);
  assert.deepEqual(followResponse.body.creatorIds, [creatorId]);

  const duplicateResponse = await request(app).post(`/api/creators/${creatorId}/follow`).set('Authorization', `Bearer ${token}`);
  assert.deepEqual(duplicateResponse.body.creatorIds, [creatorId]);

  const listResponse = await request(app).get('/api/users/me/following').set('Authorization', `Bearer ${token}`);
  assert.deepEqual(listResponse.body.creatorIds, [creatorId]);

  const unfollowResponse = await request(app).delete(`/api/creators/${creatorId}/follow`).set('Authorization', `Bearer ${token}`);
  assert.deepEqual(unfollowResponse.body.creatorIds, []);
});

test('new creators can start a stream, receive gifts, and request a payout', async () => {
  const creator = await request(app).post('/api/auth/signup').send({ name: 'Invitee Creator', email: `invitee-${Date.now()}@vexoryl.test`, password: 'password123' });
  const viewer = await request(app).post('/api/auth/signup').send({ name: 'Gift Viewer', email: `gift-viewer-${Date.now()}@vexoryl.test`, password: 'password123' });
  const stream = await request(app).post('/api/streams').set('Authorization', `Bearer ${creator.body.token}`).send({ title: 'Invitee Live Room' });
  const started = await request(app).post(`/api/streams/${stream.body.stream.id}/start`).set('Authorization', `Bearer ${creator.body.token}`);
  assert.equal(started.status, 200);
  assert.equal(started.body.stream.status, 'live');

  await request(app).post('/api/wallet/deposit').set('Authorization', `Bearer ${viewer.body.token}`).send({ amount: 10 });
  const gift = await request(app).post('/api/monetization/gift').set('Authorization', `Bearer ${viewer.body.token}`).set('Idempotency-Key', randomUUID()).send({ recipient_id: creator.body.user.id, gift_type: 'rose', amount: 5 });
  assert.equal(gift.status, 201);
  assert.equal(gift.body.wallet.balance, 5);

  const payout = await request(app).post('/api/monetization/payout').set('Authorization', `Bearer ${creator.body.token}`).set('Idempotency-Key', randomUUID()).send({ amount: 4.75 });
  assert.equal(payout.status, 202);
  assert.equal(payout.body.wallet.pending, 4.75);
});

test('only the stream creator can change live status', async () => {
  const creator = await request(app).post('/api/auth/signup').send({ name: 'Stream Owner', email: `owner-${Date.now()}@vexoryl.test`, password: 'password123' });
  const viewer = await request(app).post('/api/auth/signup').send({ name: 'Stream Viewer', email: `stream-viewer-${Date.now()}@vexoryl.test`, password: 'password123' });
  const stream = await request(app).post('/api/streams').set('Authorization', `Bearer ${creator.body.token}`).send({ title: 'Ownership Test Room' });

  const forbidden = await request(app).post(`/api/streams/${stream.body.stream.id}/start`).set('Authorization', `Bearer ${viewer.body.token}`);
  assert.equal(forbidden.status, 404);

  const started = await request(app).post(`/api/streams/${stream.body.stream.id}/start`).set('Authorization', `Bearer ${creator.body.token}`);
  assert.equal(started.status, 200);
  assert.equal(started.body.stream.status, 'live');
});

test('ended streams expose a 48-hour VOD expiry window', async () => {
  const creator = await request(app).post('/api/auth/signup').send({ name: 'VOD Creator', email: `vod-${Date.now()}@vexoryl.test`, password: 'password123' });
  const stream = await request(app).post('/api/streams').set('Authorization', `Bearer ${creator.body.token}`).send({ title: 'VOD Test Room' });
  const ended = await request(app).post(`/api/streams/${stream.body.stream.id}/stop`).set('Authorization', `Bearer ${creator.body.token}`);
  assert.equal(ended.status, 200);
  const expiresAt = new Date(ended.body.stream.vodExpiresAt).getTime();
  assert.ok(expiresAt - new Date(ended.body.stream.endedAt).getTime() >= 47.99 * 60 * 60 * 1000);
  const detail = await request(app).get(`/api/streams/${stream.body.stream.id}`);
  assert.equal(detail.body.vodAvailable, true);
});

test('panic stop is limited to the stream creator', async () => {
  const creator = await request(app).post('/api/auth/signup').send({ name: 'Panic Creator', email: `panic-creator-${Date.now()}@vexoryl.test`, password: 'password123' });
  const viewer = await request(app).post('/api/auth/signup').send({ name: 'Panic Viewer', email: `panic-viewer-${Date.now()}@vexoryl.test`, password: 'password123' });
  const stream = await request(app).post('/api/streams').set('Authorization', `Bearer ${creator.body.token}`).send({ title: 'Panic Test Room' });
  const forbidden = await request(app).post(`/api/streams/${stream.body.stream.id}/panic`).set('Authorization', `Bearer ${viewer.body.token}`).send({ reason: 'not the owner' });
  assert.equal(forbidden.status, 404);
  const stopped = await request(app).post(`/api/streams/${stream.body.stream.id}/panic`).set('Authorization', `Bearer ${creator.body.token}`).send({ reason: 'safety concern' });
  assert.equal(stopped.status, 202);
  assert.equal(stopped.body.emergencyStopped, true);
  assert.equal(stopped.body.stream.status, 'moderated');
  assert.equal(stopped.body.stream.panicReason, 'safety concern');
});

test('pay-per-view purchase debits a wallet once and is idempotent', async () => {
  const signupResponse = await request(app).post('/api/auth/signup').send({ name: 'PPV Viewer', email: `ppv-${Date.now()}@vexoryl.test`, password: 'password123' });
  const token = signupResponse.body.token;
  const stream = await request(app).post('/api/streams').set('Authorization', `Bearer ${token}`).send({ title: 'Paid Room', ppvPrice: 8 });
  await request(app).post('/api/wallet/deposit').set('Authorization', `Bearer ${token}`).send({ amount: 10 });
  const key = randomUUID();
  const purchase = await request(app).post(`/api/streams/${stream.body.stream.id}/access`).set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key);
  assert.equal(purchase.status, 201);
  assert.equal(purchase.body.wallet.balance, 2);
  const retry = await request(app).post(`/api/streams/${stream.body.stream.id}/access`).set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.alreadyOwned, true);
});

test('creator community posts are visible in the owner feed and audience export', async () => {
  const signupResponse = await request(app).post('/api/auth/signup').send({ name: 'Community Creator', email: `community-${Date.now()}@vexoryl.test`, password: 'password123' });
  const token = signupResponse.body.token;
  const post = await request(app).post('/api/community/posts').set('Authorization', `Bearer ${token}`).send({ body: 'Tonight we are trying a slower, quieter format.' });
  assert.equal(post.status, 201);
  const feed = await request(app).get('/api/community').set('Authorization', `Bearer ${token}`);
  assert.equal(feed.body.posts[0].body, 'Tonight we are trying a slower, quieter format.');
  const audience = await request(app).get('/api/community/audience/export').set('Authorization', `Bearer ${token}`);
  assert.ok(Array.isArray(audience.body.audience));
});

test('chat moderation blocks harmful and spam content before persistence', async () => {
  const harmful = await request(app).post('/api/streams/stream-1/chat').send({ text: 'I will hurt you' });
  assert.equal(harmful.status, 422);
  assert.equal(harmful.body.moderation.flag_level, 'high');
  assert.match(harmful.body.moderation.reason, /Threatening/);

  const spam = await request(app).post('/api/streams/stream-1/chat').send({ text: 'aaaaaaaaaaaaaaaa' });
  assert.equal(spam.status, 422);
  assert.equal(spam.body.moderation.flag_level, 'medium');

  const allowed = await request(app).post('/api/streams/stream-1/chat').send({ text: 'Welcome to the stream' });
  assert.equal(allowed.status, 201);
  assert.equal(allowed.body.moderation.flag_level, 'none');
  assert.ok(allowed.body.moderation.timestamp);
});

test('creator analytics AI suggestions returns safe, structured recommendations', async () => {
  const signupResponse = await request(app).post('/api/auth/signup').send({
    name: 'AI Tester',
    email: `ai-${Date.now()}@vexoryl.test`,
    password: 'password123',
  });

  const response = await request(app)
    .post('/api/ai/insights')
    .set('Authorization', `Bearer ${signupResponse.body.token}`)
    .send({
      totalViewers: 1500,
      engagementRate: 22,
      demographics: [{ name: 'North America', viewers: 45 }, { name: 'Europe', viewers: 35 }],
      devices: [{ name: 'Mobile', viewers: 62 }, { name: 'Desktop', viewers: 38 }],
      revenue: { subscriptions: 1200, gifts: 850, bids: 410, payouts: 200 },
    });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.suggestions));
  assert.ok(response.body.suggestions.length >= 1);
  assert.ok(response.body.suggestions[0].title);
  assert.ok(response.body.suggestions[0].detail);
  assert.ok(['heuristic', 'openai'].includes(response.body.source));
});

test('live stream creation returns a clear Mux config error when credentials are not configured', async () => {
  if (process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) return;
  const signupResponse = await request(app).post('/api/auth/signup').send({
    name: 'Mux Tester',
    email: `mux-${Date.now()}@vexoryl.test`,
    password: 'password123'
  });

  const response = await request(app)
    .post('/api/streams/live')
    .set('Authorization', `Bearer ${signupResponse.body.token}`)
    .send({ title: 'Testing Mux Live', category: 'Music' });

  assert.equal(response.status, 500);
  assert.match(response.body.error, /MUX_TOKEN_ID|MUX_TOKEN_SECRET/);
});

test('task bid API stores and retrieves the latest bids for a stream', async () => {
  const signupResponse = await request(app).post('/api/auth/signup').send({
    name: 'Bid Tester',
    email: `bid-${Date.now()}@vexoryl.test`,
    password: 'password123'
  });

  const createResponse = await request(app)
    .post('/api/streams')
    .set('Authorization', `Bearer ${signupResponse.body.token}`)
    .send({ title: 'Bid Testing Stream', category: 'Gaming' });

  const streamId = createResponse.body.stream.id;

  const bidKey = randomUUID();
  const bidPayload = { task_prompt: 'Create a dramatic intro animation', bid_amount: 75 };
  const bidResponse = await request(app)
    .post(`/api/streams/${streamId}/task-bids`)
    .set('Authorization', `Bearer ${signupResponse.body.token}`)
    .set('Idempotency-Key', bidKey)
    .send(bidPayload);

  assert.equal(bidResponse.status, 201);
  assert.equal(bidResponse.body.bid.task_prompt, 'Create a dramatic intro animation');

  const duplicateBidResponse = await request(app)
    .post(`/api/streams/${streamId}/task-bids`)
    .set('Authorization', `Bearer ${signupResponse.body.token}`)
    .set('Idempotency-Key', bidKey)
    .send(bidPayload);
  assert.equal(duplicateBidResponse.status, 201);
  assert.equal(duplicateBidResponse.body.bid.id, bidResponse.body.bid.id);

  const listResponse = await request(app)
    .get(`/api/streams/${streamId}/task-bids`)
    .set('Authorization', `Bearer ${signupResponse.body.token}`);

  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body.bids));
  assert.ok(listResponse.body.bids.length >= 1);
});

test('monetization payout moves available funds to pending balance', async () => {
  const signupResponse = await request(app).post('/api/auth/signup').send({
    name: 'Payout Tester',
    email: `payout-${Date.now()}@vexoryl.test`,
    password: 'password123'
  });
  const token = signupResponse.body.token;

  await request(app).post('/api/wallet/deposit').set('Authorization', `Bearer ${token}`).send({ amount: 100 });
  const payoutKey = randomUUID();
  const response = await request(app).post('/api/monetization/payout').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', payoutKey).send({ amount: 40 });

  assert.equal(response.status, 202);
  assert.equal(response.body.payout.status, 'pending');
  assert.equal(response.body.wallet.balance, 60);
  assert.equal(response.body.wallet.pending, 40);

  const retry = await request(app).post('/api/monetization/payout').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', payoutKey).send({ amount: 40 });
  assert.equal(retry.status, 202);
  assert.equal(retry.body.payout.id, response.body.payout.id);

  const overdraft = await request(app).post('/api/monetization/payout').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID()).send({ amount: 61 });
  assert.equal(overdraft.status, 409);

  const fraudReview = await request(app).post('/api/monetization/payout').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID()).send({ amount: 1000 });
  assert.equal(fraudReview.status, 423);
});

test('gift API transfers funds between authenticated users', async () => {
  const sender = await request(app).post('/api/auth/signup').send({ name: 'Gift Sender', email: `gift-sender-${Date.now()}@vexoryl.test`, password: 'password123' });
  const recipient = await request(app).post('/api/auth/signup').send({ name: 'Gift Recipient', email: `gift-recipient-${Date.now()}@vexoryl.test`, password: 'password123' });
  await request(app).post('/api/wallet/deposit').set('Authorization', `Bearer ${sender.body.token}`).send({ amount: 25 });

  const giftKey = randomUUID();
  const response = await request(app).post('/api/monetization/gift').set('Authorization', `Bearer ${sender.body.token}`).set('Idempotency-Key', giftKey).send({ recipient_id: recipient.body.user.id, gift_type: 'rose', amount: 5 });

  assert.equal(response.status, 201);
  assert.equal(response.body.gift.giftType, 'rose');
  assert.equal(response.body.gift.amount, 5);
  assert.equal(response.body.gift.net_amount, 4.75);
  assert.equal(response.body.wallet.balance, 20);

  const retry = await request(app).post('/api/monetization/gift').set('Authorization', `Bearer ${sender.body.token}`).set('Idempotency-Key', giftKey).send({ recipient_id: recipient.body.user.id, gift_type: 'rose', amount: 5 });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.gift.id, response.body.gift.id);
  assert.equal(retry.body.wallet.balance, 20);
});

test('Director Mode trigger is limited to the stream creator', async () => {
  const creator = await request(app).post('/api/auth/signup').send({ name: 'Director Creator', email: `director-${Date.now()}@vexoryl.test`, password: 'password123' });
  const viewer = await request(app).post('/api/auth/signup').send({ name: 'Director Viewer', email: `viewer-${Date.now()}@vexoryl.test`, password: 'password123' });
  const stream = await request(app).post('/api/streams').set('Authorization', `Bearer ${creator.body.token}`).send({ title: 'Director Test' });

  const forbidden = await request(app).post(`/api/streams/${stream.body.stream.id}/director/triggers`).set('Authorization', `Bearer ${viewer.body.token}`).send({ event: 'overlay.flash' });
  assert.equal(forbidden.status, 403);

  const accepted = await request(app).post(`/api/streams/${stream.body.stream.id}/director/triggers`).set('Authorization', `Bearer ${creator.body.token}`).send({ event: 'overlay.flash', parameters: { color: 'lime' } });
  assert.equal(accepted.status, 202);
  assert.ok(['local', 'supabase'].includes(accepted.body.delivery.mode));
});
