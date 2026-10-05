# UCEED 2015–2016 source verification

Date: 2026-10-05

## Scope and sources

Compared the seeded paper fixtures with `UCEED2015_Question_Paper.pdf`, `UCEED2015_Answer_Key.pdf`, `UCEED2016_Question_Paper.pdf`, and `UCEED2016_Answer_Key.pdf`. The answer-key pages were visually read in full; answer, question type, section and marking expectations were checked against all fixture entries. The paper instruction pages establish the question counts and scoring rules. Extracted question text was checked against fixture prompts; image-led questions were checked against rendered source pages where needed.

## Verified import inventory

| Year | Questions | NAT / MSQ / MCQ | Maximum marks | Questions with local media | Missing media / generic stems |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2015 | 100 | 20 / 30 / 50 | 300 | 72 | 0 / 0 |
| 2016 | 80 | 20 / 20 / 40 | 300 | 46 | 0 / 0 |

Every fixture answer was compared with a transcribed expected key in the focused tests. All 180 entries match the supplied final key, including the accepted NAT values/ranges. The score tables match each year's paper instructions.

## Source-key corrections

- **UCEED 2015 Q67:** the final key marks the question dropped and awards +3 to all candidates. The fixture now accepts A, B, C, and D.
- **UCEED 2015 Q78:** the final key accepts B or C. Both options now score correctly.
- **UCEED 2016 Q79:** the final key accepts A or B. Both options now score correctly.

The import scripts already declared these alternatives, but the backend schema only permitted MSQ alternatives, so they were not retained by fixture validation. MCQs now support a list of alternative option IDs; MSQ alternatives continue to be lists of option sets. A database-backed test verifies that alternate keys survive exam import, stay hidden in the active student attempt, and score correctly on submission.

## Source-page review and limits

Rendered UCEED 2015 pages 22, 27 and 32, and UCEED 2016 page 30. These confirm the image-only UCEED 2015 Q52 prompt/diagram, the imported UCEED 2015 Q67 and Q78 diagrams, and the UCEED 2016 Q79 text/options. All 118 fixture media references resolve to local files and all have alt text. This was a targeted visual check, not a page-by-page visual comparison of every diagram; a full editorial visual pass remains open.

The automated prompt-text comparison found matching source question segments for all 80 UCEED 2016 items. UCEED 2015 Q52 is image-led and has no text stem after its number; its prompt and figure were visually checked on source page 22. The adjacent Q53 boundary was separately checked on that page because a text-only extraction can merge it with the image-led item.

## Verification

- `node --test test/uceed-2015.test.js test/uceed-2016.test.js`: 5/5 passed.
- `npm test`: 93/93 passed.
- The 2015 and 2016 fixture answer-key regression tests compare all 180 answers with the supplied final keys.

This closes the UCEED 2015–2016 answer-key and import-contract increment. It does not close all P1 work: the deck's available CEED-paper verification/import and a full visual review of all diagram crops remain outstanding.
