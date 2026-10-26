import { readFile } from 'node:fs/promises';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { validateExam } from '../src/exams.js';

async function importInto(env) {
  const isPg = Boolean(env.DATABASE_URL);
  console.log(`Connecting to ${isPg ? 'PostgreSQL' : 'SQLite'}...`);
  const db = await openDatabase(env);
  try {
    await migrate(db);
    const raw = await readFile(new URL('../fixtures/spatial-visual-test-01.json', import.meta.url), 'utf8');
    const exam = validateExam(JSON.parse(raw));

    await db.query(
      'INSERT INTO exams(id, title, definition, created_at) VALUES($1, $2, $3, $4) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, definition=EXCLUDED.definition',
      [exam.id, exam.title, JSON.stringify(exam), Date.now()]
    );

    await db.query(
      "INSERT INTO library_exams(exam_id, source_file, published, practice_eligible, kind) VALUES($1, $2, 1, 1, $3) ON CONFLICT(exam_id) DO UPDATE SET source_file=EXCLUDED.source_file, published=1, practice_eligible=1, kind=EXCLUDED.kind",
      [exam.id, 'spatial-visual-test-01.json', 'diagnostic']
    );

    await db.query(`
      INSERT INTO exam_assignments (exam_id, user_id)
      SELECT l.exam_id, u.id FROM library_exams l
      CROSS JOIN users u
      WHERE l.published=1 AND u.role='student' AND u.active=1
      ON CONFLICT (exam_id, user_id) DO NOTHING
    `);

    const result = (await db.query('SELECT id, title FROM exams WHERE id=$1', [exam.id])).rows[0];
    const assignments = (await db.query('SELECT count(*) as count FROM exam_assignments WHERE exam_id=$1', [exam.id])).rows[0];
    console.log(`✅ [${isPg ? 'PostgreSQL' : 'SQLite'}] Exam imported successfully: ${result.title} (${result.id})`);
    console.log(`✅ [${isPg ? 'PostgreSQL' : 'SQLite'}] Assigned to ${assignments.count} student(s)`);
  } finally {
    await db.close();
  }
}

async function run() {
  // 1. Import to local SQLite
  await importInto({});

  // 2. Import to PostgreSQL if DATABASE_URL is set in process.env
  if (process.env.DATABASE_URL) {
    await importInto(process.env);
  }
}

run().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
