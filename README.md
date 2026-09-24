# BRDS CBT exam system

Phase 0 hosting shell, in one Node.js application. No exam or authentication logic yet.

## Local run

Requires Node.js 24.15+ (24.x).

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000. A local SQLite database is created at `data/brds.sqlite`. The status page checks the database and lets you test an actual WebSocket message round-trip. Optional configuration goes in `.env` (see `.env.example`); never commit secrets.

## Render deployment

1. Push this project to your GitHub repository, excluding `.env`, `data`, `node_modules` and `tmp`.
2. Create/select a Render PostgreSQL database in the same region as the web service. Review its current plan, persistence and expiry conditions before selecting it. No database purchase is automated by this project.
3. Create a Render Blueprint from the repository using `render.yaml`, or create a Node web service with build `npm ci`, start `npm start`, and health path `/health`.
4. Set `NODE_ENV=production` and set `DATABASE_URL` to the database's internal connection URL in Render's secret/environment settings. Do not paste the credential into chat or source control.
5. Deploy. The server binds to `0.0.0.0` and Render's `PORT`. Production startup fails if PostgreSQL is missing; it will not silently use an ephemeral SQLite file.
6. On both PC and phone, visit the public HTTPS URL. Verify server/database status, send a unique test message, and confirm the exact reply appears. Record URL, devices, time and results in `docs/phase-0-acceptance.md`.

Render's free web service is configured for this shell. Validate the chosen hosting plan's sleep/restart behavior before real exams; a passing local smoke test is not a hosted endurance test.

Browser console equivalent:

```js
const socket = new WebSocket(`wss://${location.host}/ws`);
socket.onmessage = event => console.log('Echo:', event.data);
socket.onopen = () => socket.send('BRDS device check');
```

Endpoints: `GET /health` returns 200 after a successful database query, or 503 on failure. `/ws` echoes text/binary messages up to 16 KiB and uses ping/pong heartbeats. The echo is a temporary Phase 0 diagnostic, not the future authenticated exam transport.

## Verification and boundaries

`npm test` checks HTTP routes, database health failure, exact text/binary WebSocket echoes, rejected cross-origin connections, SQLite persistence and production configuration guards. PostgreSQL must also be verified against the actual hosted database; local SQLite tests do not verify it. No load-test or student-readiness claim is made.

See `docs/requirements.md` for the reconciled scope and outstanding decisions. Follow the build guide's phase checkpoints before adding the next phase.

Official deployment references: [Render health checks](https://render.com/docs/health-checks), [Render WebSockets](https://render.com/docs/websocket), [Render web services](https://render.com/docs/web-services).
