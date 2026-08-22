const API = process.env.API_URL || 'http://localhost:4000/api';
const COUNT = Math.max(1, Number(process.env.CHAT_COUNT || 200));
const toxicSamples = ['I will hurt you', 'go die', 'kill yourself'];
const benignSamples = ['Welcome to the room', 'That transition looks great', 'What are you building?'];

async function submit(text) {
  const startedAt = performance.now();
  const response = await fetch(`${API}/streams/stream-1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await response.json();
  return { status: response.status, body, durationMs: performance.now() - startedAt, toxic: toxicSamples.includes(text) };
}

const messages = Array.from({ length: COUNT }, (_, index) => ({
  text: index % 2 === 0 ? benignSamples[index % benignSamples.length] : toxicSamples[index % toxicSamples.length],
}));
const results = await Promise.all(messages.map(({ text }) => submit(text)));
const blocked = results.filter((result) => result.toxic && result.status === 422).length;
const accepted = results.filter((result) => !result.toxic && result.status === 201).length;
const averageMs = results.reduce((sum, result) => sum + result.durationMs, 0) / results.length;
const passed = blocked === Math.floor(COUNT / 2) && accepted === Math.ceil(COUNT / 2);
console.log(JSON.stringify({ api: API, requested: COUNT, blocked, accepted, averageMs: Number(averageMs.toFixed(2)), passed }, null, 2));
if (!passed) process.exitCode = 1;
