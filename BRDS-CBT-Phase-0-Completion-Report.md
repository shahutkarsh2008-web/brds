# BRDS CBT Exam System — Phase 0 Completion Report

**Report date:** 25 September 2026  
**Phase:** 0 — Hosting shell  
**Status:** Local implementation complete and verified; public deployment and final acceptance pending  
**Selected hosting provider:** Render

## 1. Phase objective

Establish one working backend with a health endpoint, a WebSocket echo endpoint, and a database connection before adding authentication or exam features.

The supplied build guide requires a public URL that works on both phone and PC, with a successful WebSocket message round-trip. Local verification alone does not complete this acceptance requirement.

## 2. Work completed

| Deliverable | Implementation | Status |
| --- | --- | --- |
| Single application server | One Node.js service serves the setup page, HTTP endpoints, and WebSocket connections. | Verified locally |
| Health endpoint | `GET /health` returns HTTP 200 after a successful database query and HTTP 503 when the database is unavailable. | Verified locally |
| WebSocket endpoint | `/ws` echoes text and binary messages, with heartbeat checks and a 16 KiB message limit. | Verified locally |
| Local database | SQLite creates and persists the initial schema metadata. | Verified locally |
| Hosted database support | PostgreSQL connection support through `DATABASE_URL`; production startup refuses a SQLite fallback. | Implemented; hosted verification pending |
| Browser setup page | Displays server/database status and provides a message round-trip test. | Verified locally |
| Render configuration | Build command, start command, health-check path, and environment-variable configuration prepared. | Prepared; not deployed |
| Project documentation | Requirements review, deployment instructions, and acceptance checklist created. | Complete |

## 3. Verification results

The following checks were completed during the Phase 0 implementation session. This report records those results; it does not represent an additional test run.

**Runtime:** Node.js 24.15.0  
**Automated command:** `npm test`  
**Result:** 6 tests passed, 0 failed

| Test | Result |
| --- | --- |
| Health endpoint checks the database; page assets are served by the same server. | Passed |
| Database failure returns HTTP 503 without exposing connection details. | Passed |
| WebSocket echoes exact text and binary payloads. | Passed |
| WebSocket rejects foreign browser origins and unknown endpoint paths. | Passed |
| SQLite schema metadata survives reopening the database file. | Passed |
| Production refuses to start without `DATABASE_URL`. | Passed |

### Browser verification

- Local URL: `http://localhost:3000/`
- Browser: Codex in-app browser.
- Database status: `Online · SQLite connected`.
- WebSocket status: `Connected · ready to test`.
- Message sent and received: `Hello from BRDS Raipur`.
- Observed round-trip time: **3 ms** for this local test.

The local round-trip measurement is not a hosted latency or load-test result.

The dependency installation audit reported **0 vulnerabilities across 16 audited packages** at the time of installation. This is a package audit result, not a full security assessment.

## 4. Main project files

| File | Purpose |
| --- | --- |
| `src/server.js` | Starts the server and handles shutdown. |
| `src/app.js` | HTTP routes, static assets, and WebSocket echo. |
| `src/database.js` | Local SQLite and hosted PostgreSQL connections. |
| `public/index.html` | Setup and connection-test page. |
| `public/app.js` | Browser health check and WebSocket test. |
| `public/style.css` | Responsive setup-page styling. |
| `test/app.test.js` | Six automated verification tests. |
| `render.yaml` | Render service configuration. |
| `.env.example` | Environment-variable examples without real credentials. |
| `README.md` | Local run and Render deployment instructions. |
| `docs/requirements.md` | Reconciled requirements and unresolved product decisions. |
| `docs/phase-0-acceptance.md` | Phase acceptance checklist. |

## 5. Pending work for full Phase 0 completion

- [x] Implement the single application server.
- [x] Verify the health endpoint locally.
- [x] Verify WebSocket message round-trips locally.
- [x] Verify local database persistence.
- [x] Prepare Render deployment configuration.
- [ ] Create the project GitHub repository and upload the source.
- [ ] Connect the repository to Render.
- [ ] Configure a Render PostgreSQL database and the service's `DATABASE_URL`.
- [ ] Deploy successfully and record the public HTTPS URL.
- [ ] Verify the deployed health endpoint against PostgreSQL.
- [ ] Verify the public page and WebSocket round-trip from a PC.
- [ ] Verify the public page and WebSocket round-trip from a phone.
- [ ] Record Phase 0 acceptance before beginning Phase 1.

**Current deployment blocker:** No project repository has been created or connected to Render. No public deployment or hosted PostgreSQL verification has been completed.

## 6. Scope boundaries

Authentication, OTP, student accounts, exam questions, answer saving, timers, teacher monitoring/control, scoring, analytics, and rich-text authoring are not implemented in Phase 0.

The current page is a connection-test shell. Its text wordmark and provisional colors are not final branding. No concurrent-user endurance test or real-student pilot has been performed.

## 7. Acceptance decision

**Local Phase 0 implementation: complete and verified.**

**Overall Phase 0 acceptance: pending public deployment and phone/PC verification.**

**Phase 1: not started.**
