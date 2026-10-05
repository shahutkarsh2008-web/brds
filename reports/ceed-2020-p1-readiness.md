# CEED 2020 P1 source readiness

Date: 2026-10-06

## Source review

The workspace contains `CEED2020qp.pdf` (25 pages) and `CEED2020ans.pdf` (1 page). The paper instructions and first question page, plus the full answer-key page, were rendered and visually inspected. The paper specifies Part A as 41 scored questions for 100 marks (8 NAT, 10 MSQ, 23 MCQ) and Part B as five descriptive questions for 100 marks. Part A takes one hour; Part B takes two hours.

Part A marking is NAT +3, incorrect/unanswered 0; MSQ +3 for the complete correct set, -0.2 for other answered sets, 0 unanswered; MCQ +2, -0.5 incorrect, 0 unanswered.

## Import blocker

The official key marks MCQ Q20 “FULL MARKS” for all candidates because the item may have more than one solution. The current exam schema/scorer has no dropped-question/full-credit-to-all state. Treating all four options as alternate correct answers would still fail to award the official credit to a blank response and would mislabel the item in post-submit review. A scored CEED 2020 fixture should wait until the backend can represent this marking rule and the result view can explain it.

Part B is descriptive and the current engine cannot score it automatically. It may be offered later as a clearly labeled manual-review/practice artifact, with a human rubric.

## Status

Source/key presence and the exact Part A marking scheme are verified. The 41-question fixture, diagram extraction, complete answer-key comparison and regression test remain to be done. CEED 2021–2026 imports are owned by Antigravity per the user's latest direction.
