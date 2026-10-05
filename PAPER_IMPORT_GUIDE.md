# Paper Import Guide

Ye guide batata hai ki kisi bhi mock, PYQ ya worksheet ko JSON se Library mein kaise import karna hai.

## Recommended file package

Best package:

```text
paper-package.zip
├── paper.json
└── images/
    ├── q-001.png
    ├── q-002.png
    └── ...
```

Images ko question ID ke saath name karo. JSON mein image path `/media/<folder>/<filename>` hona chahiye.

## JSON structure

```json
{
  "id": "uceed-2026-mock-01",
  "title": "UCEED 2026 Mock 01",
  "durationSeconds": 7200,
  "totalQuestions": 57,
  "maxMarks": 200,
  "instructions": "Attempt every section according to the exam rules.",
  "sections": [
    {"id": "spatial", "title": "Spatial Reasoning"},
    {"id": "visual", "title": "Visual Reasoning"}
  ],
  "questions": []
}
```

## Question types

### MCQ

```json
{
  "id": "q-001",
  "sectionId": "spatial",
  "topic": "Rotation",
  "difficulty": "Medium",
  "type": "MCQ",
  "prompt": "Question text",
  "options": [
    {"id": "a", "text": "Option A"},
    {"id": "b", "text": "Option B"},
    {"id": "c", "text": "Option C"},
    {"id": "d", "text": "Option D"}
  ],
  "answer": "b",
  "marks": {"correct": 4, "incorrect": -1, "unanswered": 0},
  "tags": ["rotation", "spatial-reasoning"]
}
```

### MSQ

MSQ mein answer array hota hai:

```json
"type": "MSQ",
"answer": ["a", "c"]
```

### NAT

Exact value ya accepted range do:

```json
"type": "NAT",
"answer": {"min": 18.5, "max": 18.5}
```

### Drawing / subjective

Current CBT engine MCQ, MSQ aur NAT ko score karta hai. Drawing questions ko reference/portfolio mode mein import karo:

```json
{
  "id": "q-058",
  "sectionId": "drawing",
  "type": "DRAWING",
  "prompt": "Draw the required perspective scene.",
  "answerStatus": "manual_review",
  "image": "/media/uceed-2025/q-058.png"
}
```

## Images

Image question ke liye ye fields required hain:

```json
"image": "/media/uceed-2026-mock/q-001.png",
"imageAlt": "Rotation diagram for question 1"
```

Image filenames mein spaces avoid karo. PNG/JPG/WebP use karo.

## Topic-wise mock availability

Har mock question ko `sectionId`, `topic`, `difficulty` aur `tags` dena zaroori hai. Isse same imported mock ke questions custom practice builder mein bhi available rahenge.

Example:

```json
{
  "id": "q-014",
  "sectionId": "spatial",
  "topic": "Mirror and Water Images",
  "difficulty": "Easy",
  "tags": ["mirror-water", "reflection", "mock-01"]
}
```

Import ke baad questions do jagah available hone chahiye:

1. **Complete Mock:** original order, timer aur exam scoring ke saath.
2. **Topic Practice:** topic/difficulty/tag filters ke through individual questions ya generated practice set mein.

Isliye mock questions ko sirf ek combined paper JSON mein hide mat karo; har question ka topic metadata preserve karo.

## Import workflow

1. JSON ko `fixtures/` mein rakho.
2. Images ko `public/media/<paper-id>/` mein copy karo.
3. `scripts/seed-exams.js` ke fixture list mein filename add karo.
4. `validateExam()` se schema validation run karo.
5. `npm test` run karo.
6. Library/Papers page par paper card verify karo.
7. Practice Builder mein topic filter se imported questions verify karo.

## Import checklist

- Unique exam ID
- Unique question IDs
- `totalQuestions` actual count ke equal
- `maxMarks` marks total ke equal
- Har question ka valid `sectionId`
- MCQ answer option ID se match karta ho
- MSQ answer array ho
- NAT min/max valid ho
- Image path local `/media/` path ho
- `imageAlt` present ho
- Answer key missing ho toh `answerStatus: "pending_verification"` use karo
- Mock questions ke topic tags present hon
- Duplicate questions/IDs validation report mein zero hon

## Recommended naming

```text
fixtures/<paper-id>.json
public/media/<paper-id>/q-001.png
```

Example:

```text
fixtures/uceed-2025-official-part-a.json
public/media/uceed-2025/Q_03.png
```
