import { readFile } from 'node:fs/promises';

const API = process.env.API_URL || 'http://localhost:4000/api';
const WEB = process.env.WEB_URL || 'http://localhost:5173';

const apiResponse = await fetch(`${API}/streams`);
const apiBody = await apiResponse.text();
const vercel = JSON.parse(await readFile(new URL('../../web/vercel.json', import.meta.url), 'utf8'));
const assetCache = vercel.headers?.some((rule) => rule.source === '/assets/(.*)' && rule.headers?.some((header) => header.key === 'Cache-Control' && /immutable/.test(header.value)));
const checks = {
  apiStatus: apiResponse.status === 200,
  publicCache: /s-maxage=10/.test(apiResponse.headers.get('cache-control') || ''),
  requestId: Boolean(apiResponse.headers.get('x-request-id')),
  region: Boolean(apiResponse.headers.get('x-vercel-region')),
  serverTiming: apiResponse.headers.get('server-timing') === 'api',
  apiJson: Boolean(JSON.parse(apiBody).streams),
  immutableAssetCache: assetCache,
};
const passed = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ api: API, web: WEB, checks, passed }, null, 2));
if (!passed) process.exitCode = 1;
