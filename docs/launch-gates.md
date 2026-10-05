# BRDS CBT — Minimum Go-Live Gates

Question-bank breadth is ongoing product work. A larger CEED/NID/NIFT catalogue, deeper syllabus coverage, additional GK/Part-B material, community features and paid mocks are not deployment blockers. The launch catalogue must still contain at least one source-verified paper that the target students are authorized to attempt.

## Required before real students use the hosted service

1. **Production configuration:** run on HTTPS with PostgreSQL (`NODE_ENV=production`, `DATABASE_URL`, and `APP_ORIGIN` or the host's HTTPS origin). Configure `TWOFACTOR_API_KEY` and the approved SMS template when required by the provider account. Bootstrap the first administrator through the documented `BOOTSTRAP_ADMIN_*` variables, verify access, then remove those bootstrap secrets. OTP fails closed when provider credentials are missing.
2. **Recoverability:** configure encrypted, automated PostgreSQL snapshots or point-in-time recovery with an agreed retention window. Restore a snapshot into an isolated database and verify the service can read it before launch. The Admin JSON export is useful for application records, but intentionally excludes phone numbers, password hashes and transient sessions; it is not a complete database restore mechanism.
3. **Hosted acceptance:** run `npm run deployment:check -- https://<host>` against the real HTTPS deployment. Then verify delivery and entry of a fresh OTP, role restrictions, an assigned paper's start/save/resume/submit/result flow, and an Admin JSON export on the hosted database.
4. **Capacity and security:** run the load profile appropriate to the expected exam cohort against a staging deployment, review errors/latency and host/database alerts, and resolve any security findings before opening the service to the cohort.

## Already implemented locally

- Production startup rejects SQLite and requires PostgreSQL; HTTPS origin is required for production authentication cookies.
- OTP delivery fails closed without provider credentials, and bootstrap admin creation does not overwrite an existing administrator.
- `npm run deployment:check` validates public HTTPS health/PostgreSQL, WSS echo and rejection of unauthenticated teacher access. Local automated tests cover role access, answer-key privacy, resume, scoring and core workflows.
- The admin export includes exam/attempt data and persistent application records while omitting authentication secrets.

Local checks do not count as hosted acceptance. The export is not a substitute for provider-managed backups and a restore drill.
