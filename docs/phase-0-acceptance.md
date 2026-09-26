# Phase 0 acceptance record

Updated: 26 September 2026.

- Public application: https://brds-cbt.onrender.com
- Diagnostic page: https://brds-cbt.onrender.com/setup
- Source: https://github.com/shahutkarsh2008-web/brds
- Render service: brds-cbt, free plan, Singapore.
- Render PostgreSQL: brds-cbt-db, free plan, expires October 25, 2026.
- Public PostgreSQL health: PASS.
- Public secure WebSocket echo from this PC: PASS.
- Public unauthenticated teacher API rejection: PASS.
- Verification command: `node scripts/check-deployment.js https://brds-cbt.onrender.com`.
- Combined local regression suite: 19 passed, 0 failed.
- Original local browser echo: exact message returned, observed 3 ms.
- Actual phone check: PASS, reported by the user on 26 September 2026 (“Phone check passed”).
- Fresh public browser visual review: blocked by Windows sandbox/browser startup error.
- Phase 0: COMPLETE, based on independent public PC checks and the user's actual-phone confirmation.
- Phase 1 implemented under the user's explicit instruction; real OTP acceptance remains pending.

Never store credentials or database URLs containing passwords in this record.
