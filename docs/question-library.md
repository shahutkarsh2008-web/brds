# Shared mock and topic question library

Every exam remains in `exams`, with its original question IDs, question order,
answer keys, marking rules and student assignments. Topic practice reads the same
definitions; there is no second manually maintained bank to forget to update.

## Classification

`src/question-topic-map.json` contains content-fingerprinted classifications for
the supplied 2019–2026 UCEED papers, demo questions and spatial diagnostic/short
worksheet. The full worksheet's named sections supply its topic metadata.
Classification was based on the supplied question text and diagrams. Image-only
items were visually inspected, including original PDF pages where image assets
were missing or unreadable. These are local editorial classifications, not an
official IIT question-by-question taxonomy.

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

The completed local audit covers 14 valid fixture papers / 745 question entries
and 10 already imported local papers / 456 entries, with no uncategorised entries.
Fixture files are not overwritten because another agent maintains paper imports.
The local development database has been backed up and updated. Hosted data and
deployment acceptance remain Phase 8 work.

Known source-content issues encountered during classification: the 2019 Q43 and
2025 Q18 fixture references lacked images, and the 2023 Q42/Q52 image files could
not be decoded. Classification was confirmed from their original PDF pages;
repairing those paper assets remains with the import lane. Classification does
not certify OCR, answer-key or diagram integrity across the uploaded papers.

## Validation

`test/question-library.test.js` covers cross-year ID collisions, scoring, reload,
bookmarks/revision, future imports, copy deduplication, two questions on one page,
unknown difficulty, exact topic matching, unchanged answers, and legacy safety.
`test/question-library-ui.test.js` covers actual catalog counts, topic selection,
error/retry behavior. Full-suite evidence is recorded in `PROGRESS_LOG.md`.
