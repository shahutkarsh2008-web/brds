# BRDS CBT Exam System — Phase 0 Completion Report

**Updated:** 26 September 2026
**Phase:** 0 — Hosting shell
**Status:** Complete — public deployment and phone/PC connection checks passed
**Hosting:** Render, Singapore

## 1. Outcome

The application is published to GitHub and deployed on Render with PostgreSQL. Public HTTP and secure WebSocket checks passed from this computer.

- Application: https://brds-cbt.onrender.com
- Connection test: https://brds-cbt.onrender.com/setup
- Health endpoint: https://brds-cbt.onrender.com/health
- Source: https://github.com/shahutkarsh2008-web/brds

The main page now shows Phase 1 sign-in. Phase 0 diagnostics remain available at `/setup`.

## 2. Completed work

| Deliverable | Evidence | Status |
| --- | --- | --- |
| Single Node.js service | Serves UI, HTTP APIs and WebSockets from one backend. | Complete |
| Public deployment | The public health endpoint responded successfully. | Verified |
| Health check | HTTP 200 with a successful PostgreSQL query. | Verified publicly |
| WebSocket endpoint | Exact text message returned over `wss://brds-cbt.onrender.com/ws`. | Verified publicly |
| Hosted database | Render PostgreSQL instance `brds-cbt-db`; migrations applied by startup. | Connected |
| Local database | SQLite persistence verified automatically. | Verified |
| GitHub repository | Initial implementation pushed to `main`. | Complete |
| Render service configuration | Free Node service; `npm ci`, `npm start`, `/health`, production environment and internal database connection. | Submitted and publicly operational |
| Deployment checker | `scripts/check-deployment.js`. | Executed successfully |

## 3. Verification

The command below passed:

```sh
node scripts/check-deployment.js https://brds-cbt.onrender.com
```

Results:

1. Public health endpoint and PostgreSQL connection: **PASS**.
2. Public secure WebSocket exact-message round-trip: **PASS**.
3. Unauthenticated teacher API access rejected: **PASS**.

The combined Phase 0/1 automated suite also passed **19 tests, 0 failures**. The original local browser check returned `Hello from BRDS Raipur` in 3 ms; that was a local measurement, not a hosted latency benchmark.

The latest public checks ran from this PC using the verification script. A fresh hosted browser visual review was blocked by the Windows sandbox/browser-tool startup failure. It is not represented as completed.

## 4. Acceptance checklist

- [x] Single application server.
- [x] Health endpoint and database check.
- [x] WebSocket echo.
- [x] Local persistence.
- [x] Source published to GitHub.
- [x] Render web service and PostgreSQL created.
- [x] Public health and WebSocket checks from this PC.
- [x] Actual phone: user opened `/setup` and confirmed the database connection and returned message.
- [x] Cross-device acceptance recorded: PC public checks passed; user confirmed “Phone check passed” on 26 September 2026.

Phone acceptance is user-reported; the agent did not directly operate the phone. The public server/database/WebSocket checks were independently executed from this PC.

## 5. Hosting limitations

Both created resources use free plans. The database dashboard shows expiration on **October 25, 2026**. Plan for durable hosting before storing real exam records. Free web services can sleep or restart; no 70–90-user endurance test has been performed. Reference: https://render.com/docs/free

No paid plan was selected. Credentials are stored in Render environment configuration, not committed to Git.

## 6. Progress into Phase 1

The user explicitly requested Phase 1 in the same task, so implementation proceeded while the remaining cross-device acceptance check was pending. See `BRDS-CBT-Phase-1-Completion-Report.md`.

**Phase 0: complete.**
