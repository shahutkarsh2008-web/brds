# Phase 0 — Foundation Readiness

## Purpose

Phase 0 prepares the BRDS CBT workspace for five UI phases. It locks the current contracts, removes generated scratch artifacts, keeps canonical assets discoverable, and makes every change recoverable through tests, checkpoints and the progress log.

## Canonical project contracts

- `src/` owns authentication, exam, assignment, scoring, practice and analytics APIs.
- `public/` owns the browser shell, dashboard tabs, exam room and admin/teacher surfaces.
- `fixtures/` owns normalized import-ready exam JSON.
- `public/media/` owns runtime images referenced by fixtures.
- `scripts/seed-exams.js` owns repeatable Library seeding.
- `PAPER_IMPORT_GUIDE.md` owns the JSON/ZIP import contract.
- `PROGRESS_LOG.md` is append-only and records evidence, ownership and handoffs.

## UI readiness baseline

The restored student shell has a collapsible icon/label rail, dark-first styling, Overview cards, Library routing, feature-specific tab cards, responsive sizing, and nested media serving. Imported Library exams must be launched through `POST /api/exams/{examId}/start` so the exam room receives an attempt ID.

## Five UI phases after Phase 0

1. **Shell and Library:** finish responsive navigation, Library catalog, paper metadata and launch flow.
2. **Practice and Mocks:** connect syllabus topics, filters, saved sets, bookmarks and timed mock states.
3. **Analytics and Overview:** connect attempts to KPIs, topic mastery, marks leaks, trends and recommendations.
4. **GK, Sketches, Guides and Settings:** replace remaining fixture cards with working feature flows.
5. **Acceptance:** browser QA, accessibility, error/loading states, regression tests, screenshots and final checkpoint.

## Phase 0 acceptance

- Temporary PDF render and extraction folders removed.
- Canonical source archives, fixtures, media and guides preserved.
- Dashboard and server syntax checks pass.
- Full automated suite previously passed 67/67; rerun before each phase checkpoint.
- No import work starts until the UI phases are complete.
