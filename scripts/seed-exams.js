import { readFile } from 'node:fs/promises';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { importExam, validateExam } from '../src/exams.js';

export async function seedExams(database) {
  const files = ['uceed-2026.json', 'uceed-2026-mini-mock-01.json', 'design-foundations.json', 'timed-sections.json'];
  let seededCount = 0;
  for (const filename of files) {
    try {
      const filePath = new URL(`../fixtures/${filename}`, import.meta.url);
      const raw = await readFile(filePath, 'utf8');
      const examObj = validateExam(JSON.parse(raw));
      const exists = (await database.query('SELECT id FROM exams WHERE id=$1', [examObj.id])).rows[0];
      if (!exists) {
        await importExam(database, examObj, []);
        console.log(`✅ Seeded library exam: ${examObj.title} (${examObj.id})`);
        seededCount++;
      }
    } catch (err) {
      console.error(`Failed to seed fixture exam ${filename}:`, err.message || err);
    }
  }
  return seededCount;
}

// Allow standalone CLI execution via `node scripts/seed-exams.js`
if (process.argv[1]?.endsWith('seed-exams.js')) {
  const db = await openDatabase();
  try {
    await migrate(db);
    const count = await seedExams(db);
    console.log(`\n🎉 Exam seeding completed. ${count} new exam(s) added to Admin Library.`);
  } finally {
    await db.close();
  }
}
