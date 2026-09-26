# BRDS CBT exam system

One Node.js backend serves the student, teacher and admin pages, HTTP APIs and WebSockets. Phase 1 authentication is implemented; exam features start in Phase 2.

## Run locally

Requires Node.js 24.15+ (24.x).

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000 for sign-in, or http://localhost:3000/setup for database and WebSocket diagnostics. Local SQLite is stored in `data/brds.sqlite`. Optional private configuration goes in `.env`; see `.env.example`. Never commit real credentials.

## Authentication

Admin-issued ID/password, followed by 2Factor mobile OTP. Database-backed sessions survive reload and restart. Student, teacher and admin roles are enforced on server routes and APIs. Admins can create accounts after completing their own OTP sign-in.

No accounts or fixed OTP codes are installed by default. See [Phase 1 setup](docs/phase-1-setup.md) for provider configuration and first-administrator bootstrap.

## Render

Repository: https://github.com/shahutkarsh2008-web/brds

- Node web service, Singapore, free plan for initial verification.
- Build: `npm ci`; start: `npm start`; health path: `/health`.
- Set `NODE_ENV=production` and the private internal PostgreSQL `DATABASE_URL`.
- Render's `RENDER_EXTERNAL_URL` supplies the allowed HTTPS origin. Set `APP_ORIGIN` explicitly when using a custom domain.
- Configure `TWOFACTOR_API_KEY` and optional approved `TWOFACTOR_TEMPLATE`.
- Set the four `BOOTSTRAP_ADMIN_*` secrets only for first-admin creation, then remove them.
- Production requires PostgreSQL and an HTTPS origin; it never falls back to ephemeral SQLite.
- `render.yaml` is available for Blueprint deployment. The current service was submitted through the dashboard using the public repository; verify its auto-deploy behavior or deploy new commits manually.

Render's free database is suitable for this initial check, not indefinite data retention. The created instance shows expiry on October 25, 2026. Free web services can sleep or restart. Review hosting before real exams. [Render free-tier limits](https://render.com/docs/free)

After the live URL is known:

```sh
npm run deployment:check -- https://YOUR-SERVICE.onrender.com
```

This checks hosted PostgreSQL health, a secure WebSocket round-trip, and rejection of unauthenticated teacher requests. It does not substitute for a real phone test or OTP delivery test.

## Tests and boundaries

`npm test` runs 19 tests, including authorization, OTP expiry/attempt limits/replay/concurrent verification, account issuance, logout, WebSocket authentication, persistent sessions across restart, and production cookies. Provider tests use simulated responses and do not send SMS.

Public endpoints: `/`, `/login`, `/setup`, `/health`, diagnostic `/ws`. Protected pages: `/student`, `/teacher`, `/admin`. Authenticated connection: `/session-ws`.

No exam engine, scoring, proctor controls, load-test acceptance or real-student pilot is claimed. See the Phase 0 and Phase 1 completion reports for verified versus pending work.
