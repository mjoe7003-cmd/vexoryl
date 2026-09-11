import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = (process.env.VITE_API_PROXY_TARGET || process.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export default defineConfig({
	plugins: [react()],
	server: {
		host: '0.0.0.0',
		port: Number(process.env.VITE_PORT || 5173),
		allowedHosts: true,
		proxy: {
			'/api': { target: apiProxyTarget, changeOrigin: true, secure: false, ws: true }
		}
	},
	preview: { host: '0.0.0.0' },
	build: { chunkSizeWarningLimit: 2200 },
});
