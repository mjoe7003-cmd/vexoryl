import { randomUUID } from 'node:crypto';

const API = process.env.API_URL || 'http://localhost:4000';
const report = { api: API, checks: {}, logs: [] };

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

const health = await request('/health');
report.checks.apiHealth = health.response.status === 200 && health.body.status === 'ok';
report.logs.push({ event: 'api.health', status: health.response.status, body: health.body });

const streams = await request('/api/streams');
report.checks.streamBrowse = streams.response.status === 200 && Array.isArray(streams.body.streams);
report.logs.push({ event: 'streams.browse', status: streams.response.status, count: streams.body.streams?.length || 0 });

const flagged = await request('/api/streams/stream-1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'I will hurt you' }),
});
report.checks.moderationInterception = flagged.response.status === 422 && flagged.body.moderation?.allowed === false;
report.logs.push({ event: 'moderation.flagged', status: flagged.response.status, moderation: flagged.body.moderation });

if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) {
  const account = await request('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Smoke ${randomUUID().slice(0, 8)}`, email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD }) });
  const token = account.body.token;
  if (token) {
    const ledger = await request('/api/wallet/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount: 1 }) });
    report.checks.ledgerTransaction = ledger.response.status === 200 && Number(ledger.body.wallet?.balance) >= 1;
    report.logs.push({ event: 'ledger.deposit', status: ledger.response.status, balance: ledger.body.wallet?.balance });
  } else report.checks.ledgerTransaction = false;
} else {
  report.checks.ledgerTransaction = 'skipped: set SMOKE_EMAIL and SMOKE_PASSWORD';
  report.logs.push({ event: 'ledger.deposit', skipped: true, reason: 'production credentials not supplied' });
}

report.passed = Object.values(report.checks).every((value) => value === true || typeof value === 'string');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;