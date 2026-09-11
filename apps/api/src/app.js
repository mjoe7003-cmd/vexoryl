import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import routes from './routes/index.js';

const app = express();
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean));
const requestBuckets = new Map();
const rateLimitWindowMs = 60 * 1000;
const rateLimitMax = Number(process.env.API_RATE_LIMIT || 300);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
app.use((req, res, next) => {
	res.set('X-Content-Type-Options', 'nosniff');
	res.set('X-Frame-Options', 'DENY');
	res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	if (req.path === '/health') return next();
	const now = Date.now();
	const bucket = requestBuckets.get(req.ip) || { startedAt: now, count: 0 };
	if (now - bucket.startedAt >= rateLimitWindowMs) { bucket.startedAt = now; bucket.count = 0; }
	bucket.count += 1;
	requestBuckets.set(req.ip, bucket);
	if (bucket.count > rateLimitMax) return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
	return next();
});
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
	res.set('X-Request-Id', req.get('X-Request-Id') || randomUUID());
	res.set('X-Vercel-Region', process.env.VERCEL_REGION || process.env.APP_REGION || 'local');
	res.set('Timing-Allow-Origin', '*');
	res.set('Server-Timing', 'api');
	next();
});
app.use('/api', (req, res, next) => {
	if (req.method === 'GET' && /^\/streams(?:\/[^/]+)?$/.test(req.path) && !req.headers.authorization) {
		res.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
	} else if (req.method === 'GET') {
		res.set('Cache-Control', 'no-store');
	}
	next();
});
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'vexoryl-api' }));
app.use('/api', routes);
app.use((error, req, res, next) => { console.error(error); res.status(500).json({ error: 'Unexpected server error' }); });
export default app;
