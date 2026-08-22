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
