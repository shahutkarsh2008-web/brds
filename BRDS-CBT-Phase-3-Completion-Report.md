# Phase 3 — Read-only teacher dashboard completion report

Date: 27 September 2026
Status: **Code complete; automated checks pass. Native-browser acceptance blocked.**

## Delivered

- Teacher/admin monitoring API and teacher workspace showing students with active login sessions or attempt history.
- WebSocket-driven roster and answer progress, connection state, attempt status, remaining time and flag counts.
- Multiple connections for a student count as one online student; disconnecting the final socket changes presence. Reconnect sends a fresh snapshot.
- Exam filtering and student name/ID search.
- Tab-hidden, window-blur and fullscreen-exit signals persist as activity flags; duplicate/repeated events are deduplicated.
- Recent activity feed. Timers count down locally from server time; dashboard changes arrive over authenticated sockets, without periodic HTTP polling.
- Role restrictions: students cannot read monitoring data, and student sockets never receive the teacher roster.
- This phase is read-only. Force-submit, lock, freeze and resume remain Phase 4.

Browser focus/visibility signals indicate possible departures; they cannot identify another app or establish cheating. Fullscreen is user-initiated and subject to browser support.

## Verification

`npm test`: **34 passed, 0 failed** across the whole project.

Five authenticated student WebSocket clients changed progress and activity flags. The teacher received those changes in **43 ms** in the latest local run, below the one-second test threshold. Separate tests cover persisted/deduplicated flags, permissions, multiple tabs, disconnect and reconnect.

This is a five-client functional check, not the 70–90-user soak test required in Phase 5.

## Acceptance still outstanding

The original criterion requires 3–5 actual browser student sessions and visible teacher updates. Computer-use could not start due to a Windows sandbox setup error, so this exact visual acceptance check remains **blocked/unverified**. The socket integration test verifies the event-delivery path, not browser rendering/layout.

Use separate browser profiles or browsers for distinct accounts; normal tabs in one profile share the same login cookie. Native browser/mobile acceptance and hosted PostgreSQL integration must still be recorded. Real accounts, original APIs and final deployment checks remain Phase 8 as requested.

## Review and handoff

Start `npm run demo`; teacher account and student instructions are in [Phase 2–3 setup](docs/phase-2-3-setup.md).

Source: `src/live.js`, `src/exam-api.js`, `public/workspace.js`, `public/workspace.css`, `public/dashboard.js`.
Evidence: `test/exams.test.js`.
Coordination and ownership: `PROGRESS_LOG.md`.
