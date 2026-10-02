# Codex Task Plan — Five UI Phases

This file is the Codex ownership plan after Phase 0. Codex owns integration, backend contracts, data correctness, tests, browser verification, and recovery checkpoints.

## Phase 1 — Shell and Library

Tasks:

- Verify dashboard shell, responsive rail, dark/light mode and route loading.
- Connect Library to `/api/exams` and validate exam metadata.
- Keep exam assignment/security rules intact.
- Verify `POST /api/exams/{examId}/start` returns an attempt ID.
- Verify nested fixture image paths through the media route.
- Add loading, empty, error and retry handling for Library.
- Run browser checks at desktop and narrow widths.

Owned files:

- `src/exams.js`
- `src/exam-api.js`
- `src/app.js`
- `public/dashboard.js` integration portions
- relevant tests and `PROGRESS_LOG.md`

Acceptance:

- All seeded assigned papers appear.
- Selecting a paper creates an attempt and opens the exam room.
- Unassigned users cannot start restricted exams.
- No broken image, blank page or invalid attempt route.

## Phase 2 — Practice and Mocks

Tasks:

- Connect syllabus topic filters to the practice API.
- Verify imported questions retain topic, difficulty, type and tags.
- Wire saved sets, bookmarks and revision queue.
- Verify mock status, resume and submit states.
- Add meaningful API and integration tests.

Acceptance:

- A student can create a topic-wise set from imported questions.
- Questions do not duplicate unexpectedly.
- Practice and mock attempts remain separate.
- Saved progress survives reload.

## Phase 3 — Analytics and Overview

Tasks:

- Connect completed attempts to dashboard counters.
- Implement KPI calculations: accuracy, time, marks, skipped and negative marks.
- Populate topic mastery, marks leaks, question strategy and risk map.
- Add empty, partial-data and reliable-sample thresholds.
- Wire sparks, consistency calendar and next-best-action logic.

Acceptance:

- Empty state is honest and non-diagnostic.
- One attempt produces basic result data.
- Three completed mocks produce meaningful trends.
- Overview, Library and Analytics statuses remain consistent.

## Phase 4 — GK, Sketches, Guides and Settings

Tasks:

- Define API/storage contracts for GK cards, sketch submissions, guides and preferences.
- Wire feature-specific actions to the UI delivered by Antigravity.
- Verify local persistence and server persistence where required.
- Add error, retry and empty states.

Acceptance:

- Every sidebar tab has at least one complete working flow.
- No generic placeholder card remains where a feature is claimed as working.
- Settings persist after reload.

## Phase 5 — Acceptance and hardening

Tasks:

- Run full automated suite and focused feature tests.
- Browser-verify every tab and every primary action.
- Test narrow/desktop layouts, keyboard focus and theme toggle.
- Verify exam security, answer-key privacy and assignment checks.
- Review performance, route errors and console errors.
- Update `PROGRESS_LOG.md` and create a Git checkpoint.

Acceptance:

- Full suite green.
- All tabs load without blank screens.
- Library → Exam → Result → Analytics works end to end.
- Recovery checkpoint exists before import expansion.

Coordination rule: Codex does not rewrite Antigravity-owned visual blocks without recording the reason in `PROGRESS_LOG.md`.

## Parallel execution protocol

Codex may work in parallel with Antigravity. Codex has exclusive ownership of `src/**`, API/database tests, browser verification scripts and backend contracts. Codex may edit `public/dashboard.js` only for API wiring, state handling and error recovery after recording a handoff note.

Before every change:

1. Read the latest `PROGRESS_LOG.md` entry for the target file.
2. Claim the file with STATUS: IN PROGRESS and a concrete next step.
3. Do not edit a file claimed IN PROGRESS by Antigravity.
4. Append evidence immediately after the increment is verified.
5. Commit only the owned increment with the `[Codex]` prefix.

Shared-file rule: `public/dashboard.js`, `public/workspace-dark.css`, `PROGRESS_LOG.md` and UI tests require an explicit handoff entry before the other agent edits them. Never overwrite another agent's uncommitted work.

Parallel lane per phase: Codex wires contracts and fixtures in parallel while Antigravity builds the visual surface. Codex runs integration tests only after Antigravity marks the relevant UI increment DONE.
