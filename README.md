<<<<<<< HEAD
# vexoryl-production
“Production deployment repository for Vexoryl — includes monorepo build configs, API routes, and web deployment scripts.”
=======
# Vexoryl

Vexoryl is a livestreaming platform for creators, communities, and viewer engagement. It intentionally does not include e-commerce features.

## Stack

- `apps/api`: Node.js, Express, JWT auth, modular route/controller/model layers, in-memory development store
- `apps/web`: React + Vite creator dashboard and viewer experience
- `apps/mobile`: React Native starter screen and integration notes

## Run

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. Run `npm run dev` for the API and web app.
5. Open `http://localhost:5173`.

The API listens on `http://localhost:4000`. The development store keeps data in memory; set `DATABASE_URL` to connect a persistence adapter in production. `STREAM_INGEST_URL` and `STREAM_PLAYBACK_URL` are provided for an RTMP/WebRTC media service.

## Production deployment

Run `npm install`, `npm run audit:config`, `npm test`, and `npm run build` from the repository root. In Vercel, use the repository root as the project root, `npm install` as the install command, `npm run build -w apps/web` as the build command, and `apps/web/dist` as the output directory. Set API secrets only in the Vercel environment settings for the API deployment: `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, and any configured `MODERATION_API_KEY` or `OPENAI_API_KEY`. Set only browser-safe `VITE_*` values in the web deployment. `vercel.json` enables immutable caching for hashed assets through the web project configuration. Never commit `.env` files; rotate any credentials that have appeared in local files or logs before production deployment.

## API

Auth: `POST /api/auth/signup`, `POST /api/auth/login`
Streams: `GET /api/streams`, `POST /api/streams`, `POST /api/streams/:id/start`, `POST /api/streams/:id/stop`, `POST /api/streams/:id/connect`
Engagement: `POST /api/streams/:id/chat`, `POST /api/streams/:id/reactions`, `POST /api/streams/:id/polls`
Wallet: `POST /api/wallet/deposit`, `POST /api/wallet/withdraw`, `POST /api/wallet/payout`, `POST /api/monetization/payout`
Director Mode: `POST /api/streams/:id/director/triggers` (creator-authenticated; broadcasts through Supabase Realtime when configured)
Analytics: `GET /api/analytics/overview`

Phase 4 moderation runs before chat persistence and Realtime delivery. Blocked messages return `422` with `{ moderation: { flag_level, reason, timestamp } }`; the current local policy engine is deterministic and can be replaced by an external classifier at `moderateText`. Public stream GET responses use short Vercel-friendly `s-maxage` caching, while authenticated GET responses are `no-store`.

The web package exposes `LiveStreamPlayer` for Mux live playback and `useWallet(userId)` for wallet loading and realtime balance updates. Apply `supabase/migrations/003_wallets_transactions.sql` and `supabase/migrations/004_phase3_resilience.sql` after the existing migrations. The API uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only for server-side Director Mode broadcasts; omit them for local mode.

For local playback, set `VITE_MUX_TEST_PLAYBACK_ID` to a public Mux playback ID when testing live playback. If it is unset, `LiveStreamPlayer` loads the public HLS test stream at `VITE_TEST_VIDEO_SRC` (or its built-in `test-streams.mux.dev` fallback) so the player UI remains testable without a live Mux session. Gift and Director Mode requests log payloads, responses, ledger state, and Realtime status in the browser console. Use a signed-in API user with a deposited demo balance, then verify `POST /api/monetization/gift` returns the updated wallet and `POST /api/streams/:id/task-bids` returns the created bid.

Phase 3 resilience uses UUID `Idempotency-Key` headers on gift, bid, and payout requests. Supabase applies matching unique indexes in `004_phase3_resilience.sql`; the development store uses the same replay semantics. Run `npm run stress:bids -w apps/api` while the API is running to simulate concurrent bids and aborted network requests. The utility retries aborted requests with their original UUID and exits non-zero if unique bid IDs do not match unique request keys.

Director Mode claims a funding threshold before awaiting Realtime delivery, allowing only one concurrent bid to dispatch the threshold event. The web controls reject offline submissions, time out stalled requests after 10 seconds, and roll back optimistic pool progress when the API request fails.

Phase 5 analytics uses `creator_analytics` in `005_analytics_governance.sql` for concurrent viewer peaks, regional/device aggregates, engagement events, and completed revenue. Payout governance blocks configured transaction spikes and repeated policy violations before ledger mutation, while every decision is emitted as structured audit data. Run `npm run stress:notifications -w apps/api` to exercise high-concurrency creator alerts; its `dropped` count must remain zero.

The web app includes English, French, and Spanish dictionaries through `I18nProvider`; set `VITE_DEFAULT_LOCALE` to choose the initial locale. Set `APP_REGION`, `DEFAULT_LOCALE`, `SUPPORTED_LOCALES`, and `PAYOUT_RAILS` for region-specific deployment defaults. `apps/web/vercel.json` caches hashed assets for one year.

## Phase 6 launch playbook

Creators open **Creator studio** from the web header and complete the three-step launchpad. Supabase Auth is attempted first; local development falls back to `POST /api/auth/signup`. Payout preference and the first stream title are stored in browser onboarding state until the production wallet and stream provisioning flows are connected.

Admins with a JWT role of `admin` can open **Monitor**. The dashboard polls `GET /api/admin/monitoring` every 30 seconds and reports active stream health, viewer counts, moderation audit alerts, and transaction-risk anomalies. Local mode returns in-memory telemetry; production deployments should replace that snapshot with provider webhooks and a durable alert sink such as Slack, email, or Supabase Edge Functions.

The public launch section in the Watch view highlights instant payouts, Director Mode, and multilingual access. SEO title, description, Open Graph metadata, and theme color are defined in `apps/web/index.html`. Shareable rollout captures can be taken from the launch section and the monitoring dashboard at desktop and mobile breakpoints.

Phase 4 verification commands, run with `npm run dev` active, are `npm run stress:moderation -w apps/api` for concurrent mixed chat moderation, `npm run edge:check -w apps/api` for API/CDN headers and Vercel rules, and `npm run verify:i18n -w apps/web` for dictionary completeness. Language changes are held in context above the player and controls, so the Mux element and Realtime subscription keep their existing identities.

## Production notes

Replace the in-memory repositories with MongoDB or PostgreSQL repositories, use a signed media-service webhook for stream state, store refresh tokens in secure cookies, and put the API behind a rate limiter and TLS terminator. Adaptive bitrate playback should be supplied by the configured media service through HLS/DASH or WebRTC.
>>>>>>> b59c53b (Initial Vexoryl production commit)
