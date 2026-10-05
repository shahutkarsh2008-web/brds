# v2 Roughworks Feature Alignment

## Current v2 evidence

The latest progress log records Phase 3 Custom Practice Set Builder as DONE. Existing v2 tests cover practice-set APIs, persistence, topic filtering, deduplication, matching counts, saved sets and the dynamic UI. Phase 4 is the next planned increment: Overview Command Center and a 365-day consistency heatmap.

## Feature matrix

| Live Roughworks capability | v2 alignment | Current status / next implementation |
|---|---|---|
| Overview greeting, target exam, Sparks | Partial | Phase 4 command center |
| Date-range quick stats | Partial | Add 7/28/90/all-time controls |
| 365-day activity heatmap | Planned | Phase 4 |
| Next-best-action carousel | Missing/partial | Phase 4 action ranking and resume state |
| Recent mock attempts | Partial | Normalize started/submitted/graded states |
| Topic mastery | Partial | Add stable sample thresholds and empty state |
| Recommended practice sets | Partial | Existing builder; add recommendation rules |
| Custom practice builder | Aligned | Phase 3 DONE |
| Saved set Start/Rename/Redo/Delete | Aligned | Verify browser acceptance |
| Public question bank | Partial | Add public browse filters and direct practice links |
| MCQ/MSQ/NAT scoring | Aligned for current exam engine | Preserve official marking and partial credit |
| Timed exam timer/palette/review | Aligned | Verify full browser flow |
| Question bookmarks | Partial | Wire dashboard bookmarks list and review |
| Discrepancy reporting | Partial | Add student report API/UI if absent |
| Analytics KPI cards | Partial | Phase 7/analytics alignment |
| Topic risk map and question strategy | Missing/partial | Add data-backed empty and populated states |
| GK flashcards | Missing | Add topic catalogue and card outcomes |
| GK quiz | Missing | Add 10-question quiz and scoring |
| GK Wrong Box/cooldown | Missing | Add spaced-repetition persistence |
| Drawing prompt library | Missing | Add public prompt model and filters |
| Drawing timer/rubric | Missing | Add prompt detail and timer |
| Sketch upload/gallery/comments/claps | Missing | Add moderation-safe community workflow |
| Sketch Studio dashboard | Missing | Add submission history and status |
| Sparks rules | Partial | Add event ledger and visible explanation |
| Leaderboard/anonymous mode | Missing | Add points aggregation and privacy toggle |
| Guides and quick quizzes | Missing | Add content model and public routes |
| Paid All India Mock | Partial | Event/registration/payments remain separate Phase 8 work |
| Settings/profile target | Partial | Add account settings UI and save path |
| Privacy/support pages | Partial | Add public informational pages |

## Alignment decision

Current v2 is aligned with the live product foundation only through the practice-set builder and exam engine. It is not yet feature-complete against the live Roughworks reference. The correct implementation order is:

1. Phase 4: Overview command center, normalized progress states and 365-day heatmap.
2. Phase 5: question bank, bookmarks and saved-review flow.
3. Phase 6: analytics KPI/diagnostics and Sparks ledger.
4. Phase 7: GK Sprint, drawing prompts, gallery and guides.
5. Phase 8: paid mock registration, payment, event operations and hosted acceptance.

Credentials, real payment, OTP delivery and hosted event acceptance remain deferred per project instructions.
