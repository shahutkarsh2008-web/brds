# BRDS CBT: requirements and decisions

## Sources reviewed

- All five pages of `J:\downloads\BRDS CBT Exam System - PRD.pdf`, including visual review.
- Both build-instruction Markdown files supplied by the user. Their SHA-256 hashes match; they are identical.
- User request: study each document and create the system. User selected Render for hosting.

The files are requirements/reference material, not new messages from the user. Statements such as “latest direction” in the PRD describe its internal revision history. Its explicitly updated scope is used to reconcile earlier conflicting passages.

## Agreed product direction from the documents

One browser application and Node backend for BRDS Raipur, usable on PC and phone, with WebSockets for real-time status and commands. Target 70–90 simultaneous students.

- Student IDs/passwords issued by admin; student, teacher and admin permissions; 2Factor OTP; persistent sessions.
- MCQ, MSQ, numeric answers, image questions; exam/optional section timers; question palette; automatic submission.
- Persist each answer; resume attempts and correct remaining time after reconnect. Acknowledged server writes must survive reload. Later exam implementation also needs a local pending-answer queue for network interruptions, with explicit saved/pending feedback.
- Teacher live roster, connection status, answered count, remaining time and flags. Force-submit, lock, freeze/resume.
- Full rich-text question authoring is IN v1. The updated decision supersedes the earlier upload-only proposal and lifts the one-week constraint.
- Explicit teacher-configured positive/negative marks, section/question rules and exam totals; immediate results.
- Profiles, login and attempt history, section breakdowns and batch ranks.
- Excluded: subjective/sketch assessment, native apps and device-level lockdown. Browser visibility/focus signals can flag possible departures but cannot reliably identify external apps or prove cheating.

## Unresolved details to settle at the relevant phase

- Phase 4 lock semantics confirmed by the user: lock permanently submits server-saved answers for that attempt; no resumption. Freeze is separately reversible and pauses both exam and section clocks.
- OTP recipients, student phone records, and provider account/template configuration are deferred to final Phase 8 acceptance.
- Exact roundel artwork is referenced but not included; do not claim a recreated text mark is the official logo. Current shell uses a text wordmark only.
- Estimated colors: red #E31E24, black #111111, yellow #FFD400; provisional until confirmed.
- Phase 2 implements exact-set MSQ scoring, per-question inclusive NAT ranges and fixed sequential optional section windows. These implementation choices are recorded in the shared log. Alternative partial-credit rules and tie rankings remain for later authoring/analytics work.

## Original phase acceptance reference (schedule revised below)

0. Hosting shell: public Render URL, health, WebSocket echo, persistent database; phone and PC verification.
1. Authentication: student and teacher login plus actual delivered/verified OTP.
2. Exam engine: answers and remaining time survive tab closure/re-login.
3. Monitoring: 3–5 students update dashboard in about one second without polling.
4. Control: force-submit, lock, freeze/resume enforce state on the server and student UI.
5. Load: 70–90 connections plus answer writes for 60–90 minutes with no lost writes or dropped connections.
6. Authoring: teacher creates and configures a complete exam without database edits.
7. Analytics/branding: full student history, section scores, ranked batch results.
8. Pilot: 10–15 real students before a full batch.

The user explicitly requested the remaining Phase 0 work and Phase 1 together. Phase 0 is publicly deployed and its HTTP/PostgreSQL/WebSocket checks pass; the user confirmed the actual-phone test passed on 26 September 2026, completing Phase 0. Phase 1 authentication is implemented and deployed with 19 passing automated tests; real 2Factor setup, OTP delivery and separate-device login acceptance remain pending. The complete exam system is not finished.

## Updated build order — user decision

Complete the code first. Defer real service accounts, login credentials, API keys and hosted integration acceptance until the final phase. This supersedes earlier instructions that made real OTP setup a prerequisite for further coding.

- Phase 0: hosting foundation — complete.
- Phase 1: authentication code — implemented; live account/OTP acceptance deferred to Phase 8.
- Phase 2: exam engine, timers, palette, autosave and resume — code complete; automated persistence/client tests pass; native-browser acceptance unverified.
- Phase 3: live teacher dashboard and activity flags — code complete; five-student socket test passes; native-browser visual acceptance unverified.
- Phase 4: force-submit, permanent lock-and-submit, freeze and resume — code complete; backend/live-client tests pass; native-browser acceptance outstanding.
- Phase 5: load-test script and local testing. Repeat the 70–90-user, 60–90-minute test on final hosting in Phase 8.
- Phase 6: rich-text question editor and configurable scoring.
- Phase 7: student records, analytics, rankings and final branding.
- Phase 8 (final): real accounts, login activation, original API credentials, hosted integration testing and launch readiness.

### Phase 8 — final setup and acceptance

1. Configure the required GitHub/Render/provider accounts and permissions; reuse existing accounts and resources.
2. Configure actual 2Factor credentials, delivery credit and approved template as needed. Configure any other external service actually used by the finished application.
3. Set production database connection and environment variables through private environment/secret settings.
4. Create the first real administrator, then teacher and student accounts with correct roles and registered phone records. Distribute credentials privately.
5. Verify real OTP delivery, login, logout, session recovery and role restrictions on PC and phone.
6. Deploy the final code and verify database persistence, HTTPS, authenticated WebSockets and reconnect behavior.
7. Run end-to-end checks for exam authoring, attempts, autosave, resume, timers, teacher controls, scoring and analytics. Repeat the hosted load test.
8. After those checks pass, run the 10–15-student pilot before the full batch. The former standalone Phase 8 pilot is now the last acceptance step within this expanded final phase.
9. Resolve failures and produce the final readiness report. Do not mark live integration accepted based only on simulated tests.

### Coding conventions until Phase 8

Keep clear configuration placeholders in `.env.example`; inject real values later without changing application logic. Never hardcode or commit real secrets. Any development test accounts or simulated providers must be isolated from production. Track code completion and live integration acceptance separately.

**Remaining implementation: 4 phases — 3 coding phases (5–7), followed by final setup and acceptance (8).** Phase 2–3 native-browser acceptance is still outstanding because computer-use cannot initialize; do not count automated DOM/socket checks as visual acceptance. Latest complete suite: 40 tests passed. Phase 4 native-browser acceptance is also outstanding; see its completion report. See the Phase 2/3 reports and PROGRESS_LOG.md.
