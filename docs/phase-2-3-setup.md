# Phase 2–3 local review

## Isolated demo

Node.js 24.15+ (24.x) is required.

```sh
npm ci
npm test
npm run demo
```

Open http://localhost:3001. The demo uses `data/development.sqlite`, separate from the normal local database. It refuses production, Render and a process environment containing DATABASE_URL. It does not load production .env or send SMS.

| Role | Login ID | Password | Simulated OTP |
| --- | --- | --- | --- |
| Student | student1 through student5 | BRDS-local-demo-2026! | 123456 |
| Teacher | teacher | BRDS-local-demo-2026! | 123456 |
| Admin | admin | BRDS-local-demo-2026! | 123456 |

These are public test credentials, exclusively for the isolated localhost demo. The regular server does not install these accounts or use a fixed OTP.

The demo seeds an eight-question paper and a separate two-minute paper with two sequential timed sections. Existing attempts persist between demo restarts; each assigned student has one attempt per paper.

## Native browser checks still to perform

1. Sign in as a student, start a paper, answer MCQ/MSQ/NAT/image questions, mark review and check palette states.
2. Wait for saved confirmation, close the tab and reopen the same attempt. Confirm answers and the original deadline remain. Repeat after logout/re-login.
3. Interrupt connectivity, edit an answer, restore connectivity before the deadline, and confirm pending becomes saved. Repeat tab closure while a queued edit exists.
4. Check each timed section closes at its deadline; wait for automatic submission and inspect section totals.
5. Use separate browser profiles or browsers for teacher and 3–5 students. Normal same-profile tabs share cookies and cannot represent separate student logins.
6. Observe teacher progress/flags without refreshing. Switch student tabs, blur the window and enter/exit fullscreen. Check disconnect/reconnect.
7. Check phone layout and keyboard access.

Never assume a queued offline answer is server-saved. Edits received after their section/exam deadline are rejected. Cross-tab concurrent edits pause editing rather than silently overwrite a different version.

## Import another exam

For the normal configured server/database (not the isolated demo):

```sh
npm run exam:import -- fixtures/design-foundations.json student-login-id
```

Additional student IDs may follow. All must already exist and be active students. The script uses .env database configuration, so confirm which database is configured before importing.

Use a new unique exam ID for a new paper/version. Each question requires explicit correct, incorrect and unanswered marks. Exam totalQuestions/maxMarks must match the questions. MSQ uses exact-set matching; NAT uses an inclusive min/max range. Optional section durations must be present for every section and sum to exam duration. Local image paths must be valid files under public/media with descriptive imageAlt.

Visual authoring is Phase 6. No real API key is required to develop the exam engine or monitoring dashboard.

## Verification boundary

34 automated tests pass, including two simulated DOM tests. Actual browser visualization and multi-profile acceptance have not been performed because computer-use fails during Windows sandbox initialization. Hosted PostgreSQL, real OTP, original account/API setup and final deployment acceptance belong to Phase 8.

Phase 4 controls, Phase 5 soak testing, Phase 6 authoring and Phase 7 analytics remain.
