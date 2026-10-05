# Shared mock and topic question library

Every exam remains in `exams`, with its original question IDs, question order,
answer keys, marking rules and student assignments. Topic practice reads the same
definitions; there is no second manually maintained bank to forget to update.

## Classification

`src/question-topic-map.json` contains reviewed, content-fingerprinted labels;
`src/question-topics.js` applies concept rules to explicit question stems. The
current audit covers all 18 seeded fixtures (UCEED 2015–2026, three practice
sets, and two demo papers): 1,095 questions, each with a topic and category and
zero review items. Classification is based on source question text and diagrams;
it is a local editorial taxonomy, not an official IIT question-by-question list.

## User-supplied UCEED subtopic coverage target

Use the supplied `media_1790718535711.pdf` checklist as the target hierarchy for
UCEED question coverage. It groups preparation subtopics under these syllabus
areas:

- Part A: Visualization & Spatial Reasoning; Practical & Scientific Knowledge;
  Observation & Design Sensitivity; Environment & Society; Analytical & Logical
  Reasoning; Language; Creativity.
- Part B: Drawing; Design Aptitude.

The full checklist in the PDF is user-supplied preparation guidance. Its final
page explicitly says it is not an official IIT Bombay chapter-by-chapter list;
do not describe it as one. A future coverage audit should count real questions
for each listed subtopic and report zero-coverage items separately for Part A
and Part B. A question should be mapped from its paper, stem and diagram. Keep
the source paper/year and question ID attached; do not infer a subtopic only
from the question format, fabricate coverage, or rewrite an uncertain item as
an official syllabus classification. Overlapping syllabus concepts may be
represented with secondary tags where the question actually tests them.

The accompanying topic-breakdown image is a historical UCEED 2015–2026 view,
not a question quota. Its 15 displayed topic totals add up to more than the
year totals, so topic rows overlap and must not be treated as mutually
exclusive shares or targets. Use it to prioritize historically common topics;
use the PDF checklist to identify the subtopic coverage gaps.

The existing 1,095-question audit only establishes that every current fixture
has a label in the present editorial taxonomy. It does not yet prove that every
subtopic in this supplied checklist has a question. The next content step is a
separate parent-area/subtopic coverage matrix, followed by sourcing and
reviewing content for real gaps (especially Part B and underrepresented areas).

The 2015–2017 import builders now skip the cover and numbered instruction page.
Their first six records had incorrectly been populated with paper instructions
instead of actual question stems. Those stems were restored from the official
question papers. UCEED 2015 Q52 is image-led in the source, so its topic was
assigned from the supplied diagram rather than inventing missing prompt text.

`src/question-topics.js` applies the same classifications when importing and when
reading older definitions for practice. It supports the earlier UI topic aliases
without loose partial-word matching. Correct answer keys and marks are unchanged.
Fingerprints prevent a revised question at the same ID inheriting an unrelated
reviewed classification.

New imports automatically join the shared library. Supplied specific topics are
supported; explicit concepts can receive a `suggested-rule` classification.
Unknown/image-only future questions are labelled `Uncategorised — needs review`,
remain available, and appear in the audit instead of acquiring invented topics.
Review those against their actual paper before treating them as categorised.

## Practice and source identity

The topic picker calls `GET /api/student/practice/topics` and shows actual topic
counts for the selected exam, format and difficulty. Missing difficulty metadata
only matches All Levels. Empty/error states remain explicit.

Repeated local IDs such as `q01` are qualified with their paper ID in new practice
sets. Every new set also pins its original `{examId, questionId}` in its saved
filters, so later imports cannot redirect its answers. Answer saving, revision,
bookmarks and skip-done use that source. Answer keys never enter student question
responses. Timed mock attempts and assignment checks remain separate.

Exact content copies are collapsed only in the selected practice pool; originals
remain in every mock. Worksheet copies use both page and printed question label,
so multiple questions on one diagram page remain distinct. Different answer keys
are not merged. Ambiguous legacy sets return a clear 409 requesting a new set;
they are not silently resolved to an arbitrary paper.

## Audit and existing local data

Run `node scripts/audit-question-library.js --sqlite data/development.sqlite`.
The report contains per-paper/per-question topics and review gaps, not answers.
Use `--apply` to back up definitions under `data/backups/` and apply metadata only.
The script requires an explicit SQLite path, never reads `.env`, and refuses a
concurrent definition change within its transactional update. It does not reset
sessions, import unseeded papers, or alter attempts.

The current fixture audit covers 18 papers / 1,095 questions and the local
development database audit covers 10 papers / 456 questions, with zero
uncategorised items in both. Audit results are recorded in
`reports/question-library-audit.json`. Hosted data and deployment acceptance
remain separate operational launch checks.

Known source-content issues encountered during classification: the 2019 Q43 and
2025 Q18 fixture references lacked images, and the 2023 Q42/Q52 image files could
not be decoded. Classification was confirmed from their original PDF pages;
repairing those paper assets remains with the import lane. Classification does
not certify OCR, answer-key or diagram integrity across the uploaded papers.

## Validation

`test/question-library.test.js` covers all-seeded-fixture topic coverage,
cross-year ID collisions, scoring, reload,
bookmarks/revision, future imports, copy deduplication, two questions on one page,
unknown difficulty, exact topic matching, unchanged answers, and legacy safety.
`test/question-library-ui.test.js` covers actual catalog counts, topic selection,
error/retry behavior. Full-suite evidence is recorded in `PROGRESS_LOG.md`.
