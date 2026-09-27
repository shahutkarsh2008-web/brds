# Phase 2 — Core exam engine completion report

Date: 27 September 2026
Status: **Code complete; automated checks pass. Native-browser acceptance blocked.**
User-approved schedule: real accounts, APIs and hosted integration are deferred to final Phase 8.

## Delivered

- MCQ, exact-match MSQ, numeric answers with configured inclusive tolerance ranges, and accessible image questions.
- Exam timer and optional sequential section timers, calculated from server timestamps. Server expiry worker submits abandoned attempts automatically.
- Palette tracks visited/unanswered, answered, marked for review and unvisited questions; answered-and-review is distinguished.
- Immediate answer/visit/review persistence, immutable exam snapshots and one attempt per assigned student/exam.
- Version checks prevent silent overwrites; unique mutation IDs make retries idempotent.
- Device-local pending queue retries interrupted saves and survives tab recreation. Saved and pending states are visible.
- Server-enforced section/exam deadlines. Offline edits arriving after the relevant deadline cannot be accepted; the UI reports pending edits excluded from submission.
- Manual submission and immediate overall/section scores with explicit positive, negative and unanswered marking.
- JSON validation/import and two sample papers, including a two-minute section-timed paper. No external provider required for the isolated demo.

## Verification

`npm test`: **34 passed, 0 failed** across the whole project.

Relevant backend tests cover assignment/ownership, answer-key privacy, simultaneous starts, duplicate retries, stale/concurrent edits, MCQ/MSQ/NAT validation, negative marking, timed-section rejection, abandoned-attempt expiry, and saved-answer/deadline recovery after database reopening.

Two simulated DOM tests run the actual exam client against the actual local HTTP API. They verify pending edits survive window recreation, replay and submit successfully; review state persists; results render; incomplete numeric entries block navigation; valid numeric entries autosave; clearing removes the saved value. A warning-overwrite bug discovered by these tests was fixed.

These are simulated DOM tests, not native-browser visual tests.

## Acceptance still outstanding

The build plan asks for an actual browser tab to be closed and reopened, with re-login and correct answers/time. The computer-use kernel could not start because of a Windows sandbox setup error, so that exact demonstration and mobile/layout review remain **blocked/unverified**. Existing automated persistence/session/client tests cover the underlying behavior.

Current changes have not been deployed or tested against hosted PostgreSQL. Real OTP/accounts and hosted acceptance remain Phase 8. Further coding can continue under the user's code-first instruction.

## Review and handoff

Run `npm run demo`, then open http://localhost:3001. Demo and import instructions: [Phase 2–3 setup](docs/phase-2-3-setup.md).

Source: `src/exams.js`, `src/exam-api.js`, `src/schema.js`, `public/exam.*`.
Tests: `test/exams.test.js`, `test/exam-ui.test.js`.

Phase 4 teacher actions are not included. Rich-text authoring remains Phase 6.
