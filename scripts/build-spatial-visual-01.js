import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { validateExam } from '../src/exams.js';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(rootDir, 'tmp', 'spatial-visual-test-01-import');
const rawJsonPath = join(srcDir, 'uceed_test_02_test_bank.json');
const raw = JSON.parse(readFileSync(rawJsonPath, 'utf8'));

// 1. Copy images to public/media/spatial-visual-test-01
const publicMediaDir = join(rootDir, 'public', 'media', 'spatial-visual-test-01');
if (!existsSync(publicMediaDir)) {
  mkdirSync(publicMediaDir, { recursive: true });
}

const srcImagesDir = join(srcDir, 'images');
const srcImages = readdirSync(srcImagesDir);
for (const file of srcImages) {
  copyFileSync(join(srcImagesDir, file), join(publicMediaDir, file));
}
console.log(`Copied ${srcImages.length} images to ${publicMediaDir}`);

// 2. Build CBT fixture
let calculatedMaxMarks = 0;
const questions = raw.questions.map((q, idx) => {
  const qNum = idx + 1;
  const qId = 'q' + String(qNum).padStart(2, '0');
  const type = q.type;

  let marks;
  if (type === 'MCQ') {
    marks = { correct: q.correctMarks || 3, incorrect: -0.71, unanswered: 0 };
  } else if (type === 'MSQ') {
    marks = { correct: q.correctMarks || 4, incorrect: -1, unanswered: 0 };
  } else {
    marks = { correct: q.correctMarks || 4, incorrect: 0, unanswered: 0 };
  }
  calculatedMaxMarks += marks.correct;

  const imgFile = basename(q.image || q.images[0]);
  const qObj = {
    id: qId,
    sectionId: 'spatial-visual',
    type: type,
    prompt: q.prompt.trim(),
    marks: marks,
    topic: q.topic || 'Visualization & Spatial Reasoning',
    category: 'Visualization & Spatial Reasoning',
    tags: q.tags || ['spatial-and-visual-test-01'],
    image: `/media/spatial-visual-test-01/${imgFile}`,
    imageAlt: `Spatial and Visual Test 01 Question ${qNum} Diagram`
  };

  if (type === 'NAT') {
    const ans = q.answer;
    if (typeof ans === 'number') {
      qObj.answer = { min: ans, max: ans };
    } else if (typeof ans === 'object' && ans !== null) {
      qObj.answer = { min: ans.min, max: ans.max };
    }
  } else {
    qObj.options = q.options.map(opt => {
      const optId = opt.id.toLowerCase();
      const txt = (opt.text && opt.text.trim()) ? opt.text.trim() : `${optId.toUpperCase()} — see diagram`;
      return { id: optId, text: txt };
    });
    if (type === 'MCQ') {
      qObj.answer = typeof q.answer === 'string' ? q.answer.toLowerCase() : q.answer;
    } else if (type === 'MSQ') {
      qObj.answer = Array.isArray(q.answer) ? q.answer.map(a => String(a).toLowerCase()) : [String(q.answer).toLowerCase()];
    }
  }

  return qObj;
});

const examFixture = {
  id: 'spatial-visual-test-01',
  title: 'Spatial and Visual Test 01',
  durationSeconds: 3600,
  totalQuestions: questions.length,
  maxMarks: calculatedMaxMarks,
  instructions: `Spatial and Visual Test 01. Total 40 questions (MCQ, MSQ, NAT). NAT: +4, 0; MSQ: +4, -1; MCQ: +3, -0.71. Time: 60 minutes.`,
  sections: [
    {
      id: 'spatial-visual',
      title: 'Spatial and Visual Reasoning'
    }
  ],
  questions: questions
};

const validated = validateExam(examFixture);
console.log(`validateExam PASSED! ID: ${validated.id}, Title: ${validated.title}, Questions: ${validated.questions.length}, Max Marks: ${validated.maxMarks}`);

const fixturePath = join(rootDir, 'fixtures', 'spatial-visual-test-01.json');
writeFileSync(fixturePath, JSON.stringify(examFixture, null, 2), 'utf8');
console.log(`Saved fixture to ${fixturePath}`);
