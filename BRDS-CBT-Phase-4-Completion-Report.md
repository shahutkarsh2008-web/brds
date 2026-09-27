# Phase 4 — Teacher controls completion report

Date: 27 September 2026
Status: **Code complete; 40 automated tests pass. Native-browser visual acceptance remains unverified.**

## Delivered behavior

- **Freeze:** persists a pause and rejects answer edits and student submission on the server. Exam and optional section clocks stop; the student sees a frozen notice and disabled inputs.
- **Resume:** preserves the time remaining at freeze by extending the deadline and section-clock offset by the paused duration. The original attempt start timestamp is retained.
- **Force submit:** grades the last server-saved answers and permanently closes the attempt, including a frozen attempt.
- **Lock & submit:** the user explicitly chose permanent submission rather than reversible locking. It marks the attempt locked and submits saved answers; restarting, editing or resuming that attempt is prohibited.
- Teacher and administrator roles can act through the monitoring dashboard. Each action identifies the student/paper and requires confirmation.
- Persistent audit records include action ID, actor, attempt, action and server timestamp. Retries of the same action ID are idempotent.
- Version checks reject stale or competing actions. Origin checks and role restrictions protect the HTTP endpoint.
- Changes use existing authenticated WebSockets. The student updates without refreshing; controls also apply to disconnected students when they return.
- Pending device-local edits are not silently counted as saved. If teacher controls invalidate pending edits, the client preserves them and requires explicit recovery to the saved version.

## Implementation

Endpoint: POST /api/attempts/:id/control with action, expectedVersion and requestId.

Database migration adds attempt_controls and teacher_actions, and advances schema metadata to 4. Existing attempt status values and answers remain intact. A paused attempt is excluded from expiry sweeps. Attempts whose deadline has already passed cannot be revived through freezing.

This is attempt-level locking, not permanent account deactivation. New exams assigned to that student remain available.

## Verified

npm test: **40 passed, 0 failed**.

New backend coverage:
- Freeze retained across engine recreation using stored database state.
- Exam and section remaining time preserved after a pause longer than the original exam.
- Writes and student submission rejected during freeze.
- Lock submits saved answers and prevents continuation.
- Force-submit works on a frozen attempt.
- Role/origin restrictions, stale versions, concurrent actions, idempotent retries/audit count.
- Expired attempts cannot be revived.

Two new simulated DOM tests run the actual student client with real local WebSockets. They verify freeze disables editing within one second, timers stay paused, resume enables editing, and lock/force-submit replace the exam with the correct result message.

All previous authentication, exam recovery, scoring and monitoring tests pass. A follow-up refresh guard prevents an event received during an existing state fetch from being silently skipped.

## Remaining acceptance

Actual browser/mobile visual review, multi-profile teacher-button demonstrations and hosted PostgreSQL verification have not been performed. Computer-use was previously blocked by Windows sandbox initialization. Simulated DOM tests are not native-browser visual acceptance.

Real account provisioning, original API credentials, OTP and final hosted acceptance remain Phase 8 under the user's code-first schedule. No deployment is claimed for this local change.

## Try locally

Run npm run demo and open http://localhost:3001.

Teacher: teacher
Student: student1 through student5
Local demo password: BRDS-local-demo-2026!
Simulated OTP: 123456

Use separate browser profiles for teacher/student accounts because tabs in one profile share login cookies. Start an assigned student exam, then use its teacher roster row to Freeze, Resume, Force submit or Lock & submit. Final actions cannot be undone.

Next implementation phase: **Phase 5 — load-test tooling and local soak testing**.
