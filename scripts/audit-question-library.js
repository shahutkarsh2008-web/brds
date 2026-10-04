import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { categoriseExam } from '../src/question-topics.js';
import { createPracticeEngine } from '../src/practice.js';

// Deliberately no .env loading or implicit production connection.
const args = process.argv.slice(2);
const sqlitePath = args.includes('--sqlite') ? args[args.indexOf('--sqlite') + 1] : null;
const apply = args.includes('--apply');
if (apply && !sqlitePath) throw new Error('--apply requires an explicit --sqlite path');
const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'reports/question-library-audit.json';
const report = { generatedAt: new Date().toISOString(), fixtures: [], unreadableFiles: [], database: null };
function audit(exam) {
  const classified = categoriseExam(exam);
  const topics = {};
  for (const q of classified.questions) topics[q.topic] = (topics[q.topic] || 0) + 1;
  return { examId: exam.id, title: exam.title, totalQuestions: classified.questions.length, topics,
    needsReview: classified.questions.filter(q => q.classification === 'needs-review').map(q => q.id),
    questions: classified.questions.map(q => ({ id: q.id, topic: q.topic, category: q.category, classification: q.classification })) };
}
for (const file of (await readdir('fixtures')).filter(file => file.endsWith('.json')).sort()) {
  let exam;
  try { exam = JSON.parse(await readFile(`fixtures/${file}`, 'utf8')); }
  catch (error) { report.unreadableFiles.push({ file, error: error.code || error.message }); continue; }
  if (exam.id && exam.durationSeconds && Array.isArray(exam.sections) && Array.isArray(exam.questions)) report.fixtures.push({ file, ...audit(exam) });
}
if (sqlitePath) {
  const db = new DatabaseSync(resolve(sqlitePath), { readOnly: !apply });
  try {
    const rows = db.prepare('SELECT id,definition FROM exams ORDER BY id').all();
    report.database = { path: resolve(sqlitePath), applied: apply, exams: rows.map(row => audit(JSON.parse(row.definition))) };
    if (apply) {
      await mkdir('data/backups', { recursive: true });
      const backup = `data/backups/question-topics-${Date.now()}.json`;
      await writeFile(backup, JSON.stringify(rows), { flag: 'wx' });
      report.database.backup = backup;
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const row of rows) {
          const result = db.prepare('UPDATE exams SET definition=? WHERE id=? AND definition=?').run(JSON.stringify(categoriseExam(JSON.parse(row.definition))), row.id, row.definition);
          if (result.changes !== 1) throw new Error(`Concurrent exam edit detected: ${row.id}`);
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    report.database.practiceCatalog = await createPracticeEngine({ query: async sql => ({ rows: db.prepare(sql).all() }) }).topicCatalog();
  } finally { db.close(); }
}
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
for (const [source, exams] of [['fixtures', report.fixtures], ['database', report.database?.exams || []]]) {
  console.log(JSON.stringify({ source, papers: exams.length, questions: exams.reduce((sum, e) => sum + e.totalQuestions, 0), needsReview: exams.reduce((sum, e) => sum + e.needsReview.length, 0) }));
}
console.log(`Audit: ${output}`);
