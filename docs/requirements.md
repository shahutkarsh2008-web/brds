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

- Lock semantics are not defined in either document: proposed behavior is a persistent access block distinct from freeze; timer behavior and re-entry policy require a decision before Phase 4.
- OTP recipients, student phone records, and provider account/template configuration before Phase 1 acceptance.
- Exact roundel artwork is referenced but not included; do not claim a recreated text mark is the official logo. Current shell uses a text wordmark only.
- Estimated colors: red #E31E24, black #111111, yellow #FFD400; provisional until confirmed.
- MSQ partial-credit rules, NAT tolerance, tie rankings and optional section navigation rules require explicit configuration when scoring is built.

## Phased acceptance

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
