# Antigravity Task Plan — Five UI Phases

This file is the Antigravity ownership plan after Phase 0. Antigravity owns visual composition, tab-specific UI, responsive styling and interaction presentation. It must preserve existing API contracts and never overwrite uncommitted Codex work.

## Phase 1 — Shell and Library UI

Tasks:

- Polish collapsible icon/label sidebar and short navigation labels.
- Complete Overview header, metric cards, heatmap, next action and activity sections.
- Build the Library catalog layout with paper cards, year, question count, duration, marks and image indicator.
- Add visible loading, empty, error and retry states.
- Add selected-paper state before exam launch.
- Verify desktop, tablet and narrow layouts.

Owned files:

- `public/dashboard.js` visual sections
- `public/workspace-dark.css`
- dashboard-focused UI tests
- `PROGRESS_LOG.md`

Acceptance:

- No generic “Coming Next” card remains in Shell or Library.
- Sidebar collapse/open behavior is clear.
- Library cards are readable and do not overflow.
- Visual hierarchy matches the supplied Roughworks references while keeping Northstar branding.

## Phase 2 — Practice and Mocks UI

Tasks:

- Build topic browser from the UCEED syllabus: spatial, scientific, observation, design thinking, environment and Part-B topics.
- Add filters for exam, topic, difficulty, question type and set size.
- Build saved-set cards, bookmarks and revision queue views.
- Build mock calendar, status chips, resume and result states.
- Add question preview cards with image, topic and format labels.

Acceptance:

- Every control has a visible state change.
- Practice set creation has validation and feedback.
- Mock cards clearly distinguish available, in-progress, submitted and reviewed.
- UI remains usable with zero, few or many questions.

## Phase 3 — Analytics and Overview UI

Tasks:

- Build Analytics hero with date and exam filters.
- Build mock average/latest/best cards, overall accuracy and active-day metrics.
- Build marks-leakage, GK-retention and mock-timeline panels.
- Build question-type strategy and topic-risk map.
- Build strengths, weaknesses, opportunities and threats cards.
- Build next-45-minutes recommendations.
- Use clear “not enough data” states without fake diagnosis.

Acceptance:

- Cards render correctly for empty, partial and populated data.
- Charts/tables do not overflow at narrow widths.
- Loading and retry states are visually consistent.
- All labels match the feature report and syllabus terminology.

## Phase 4 — GK, Sketches, Guides and Settings UI

Tasks:

- GK Sprint: category cards, flashcard mode, retention and wrong-box views.
- Sketch Studio: prompt card, timer, upload area, gallery and feedback state.
- Guides: syllabus guide cards, search, worked examples and quick quizzes.
- Bookmarks: revision queue filters, source-paper labels and completion state.
- Settings: profile, target exam, preferences, theme and notification controls.
- Mocks: schedule cards, free/paid boundary and registration status.

Acceptance:

- Every tab has a feature-specific layout.
- No dead-looking generic placeholder remains.
- Buttons show disabled, loading, success and error states where needed.
- Visual language is consistent across all tabs.

## Phase 5 — Visual acceptance and handoff

Tasks:

- Run every navigation path manually.
- Compare dashboard and Analytics against supplied reference screenshots.
- Verify color contrast, spacing, typography, focus states and responsive breakpoints.
- Remove duplicate CSS and obsolete placeholder styles.
- Add UI smoke tests for each tab.
- Record screenshots/evidence in `PROGRESS_LOG.md`.
- Commit visual work before handing it to Codex.

Acceptance:

- All five phases have visible, complete tab surfaces.
- No tab produces a blank page.
- No horizontal overflow at target widths.
- Visual checkpoint is committed and handoff notes identify changed files.

Coordination rule: Antigravity must read `PROGRESS_LOG.md` before editing and append a DONE/IN PROGRESS entry immediately after each meaningful increment.

## Parallel execution protocol

Antigravity may work in parallel with Codex. Antigravity has exclusive ownership of visual UI sections, CSS styling and visual smoke tests. Antigravity must not modify `src/**`, API/database contracts, exam scoring, assignment security or import scripts.

Before every change:

1. Read the latest `PROGRESS_LOG.md` entry for the target file.
2. Claim the file with STATUS: IN PROGRESS and a concrete next step.
3. Do not edit a file claimed IN PROGRESS by Codex.
4. Append screenshots/test evidence immediately after the increment is verified.
5. Commit only the owned increment with the `[Antigravity]` prefix.

Shared-file rule: `public/dashboard.js`, `public/workspace-dark.css`, `PROGRESS_LOG.md` and UI tests require an explicit handoff entry before the other agent edits them. Never replace or regenerate a shared file wholesale.

Parallel lane per phase: Antigravity builds the visual surface in parallel while Codex wires contracts and fixtures. Antigravity marks a tab DONE only when loading, empty, error and populated states are represented and the UI has been browser-checked.
