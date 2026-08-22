import { randomUUID } from 'node:crypto';

const API = process.env.API_URL || 'http://localhost:4000/api';
const COUNT = Math.max(1, Number(process.env.BID_COUNT || 100));

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.error || 'request failed'}`);
  return data;
}

function clientTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), milliseconds)),
  ]);
}

const suffix = randomUUID();
const account = await jsonRequest('/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: `Stress Creator ${suffix.slice(0, 8)}`, email: `stress-${suffix}@vexoryl.test`, password: 'password123' }),
});
const stream = await jsonRequest('/streams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` },
  body: JSON.stringify({ title: `Stress Room ${suffix.slice(0, 8)}` }),
});

const requests = Array.from({ length: COUNT }, (_, index) => ({ key: randomUUID(), amount: (index % 10) + 1 }));
const sendBid = (request) => jsonRequest(`/streams/${stream.stream.id}/task-bids`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}`, 'Idempotency-Key': request.key },
  body: JSON.stringify({ request_id: request.key, task_prompt: 'Stress test action', bid_amount: request.amount }),
});

const firstPass = await Promise.all(requests.map((request, index) => index % 5 === 0 ? clientTimeout(sendBid(request), 1) : sendBid(request)));
const retries = await Promise.all(requests.map((request, index) => firstPass[index] || sendBid(request)));
const bidIds = new Set(retries.map((result) => result.bid.id));
const uniqueKeys = new Set(requests.map((request) => request.key));
const thresholdTriggers = retries.filter((result) => result.director?.triggered).length;
const passed = bidIds.size === uniqueKeys.size && thresholdTriggers <= 1;
console.log(JSON.stringify({ api: API, requested: COUNT, uniqueRequestKeys: uniqueKeys.size, uniqueBidIds: bidIds.size, thresholdTriggers, passed }, null, 2));
if (!passed) process.exitCode = 1;
