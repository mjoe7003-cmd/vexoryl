import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import routes from './routes/index.js';

const app = express();
app.use(cors());
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
