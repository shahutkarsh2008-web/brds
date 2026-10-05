import { readFile } from 'node:fs/promises';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/schema.js';
import { importExam, validateExam } from '../src/exams.js';

export async function seedExams(database) {
  const files = ['ceed-2026.json', 'ceed-2025.json', 'ceed-2024.json', 'ceed-2023.json', 'ceed-2022.json', 'ceed-2021.json', 'uceed-spatial-worksheet-260-revised.json', 'uceed-spatial-quantitative-worksheet-300-revised.json', 'uceed-2026.json', 'uceed-2026-mini-mock-01.json', 'uceed-2025-official-part-a.json', 'uceed-2024.json', 'uceed-2023.json', 'uceed-2022.json', 'uceed-2021.json', 'uceed-2020.json', 'uceed-2019.json', 'uceed-2018.json', 'uceed-2017.json', 'uceed-2016.json', 'uceed-2015.json', 'design-foundations.json', 'timed-sections.json', 'uceed-spatial-reasoning-diagnostic.json', 'uceed-spatial-reasoning-practice-48.json', 'uceed-spatial-reasoning-complete-120.json'];
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

  // Automatically assign seeded library exams to active student accounts
  try {
    await database.query(`
      INSERT INTO exam_assignments (exam_id, user_id)
      SELECT e.id, u.id FROM exams e
      CROSS JOIN users u
      WHERE u.role='student' AND u.active=1
      ON CONFLICT (exam_id, user_id) DO NOTHING
    `);
  } catch (err) {
    console.error('Failed to auto-assign seeded exams to students:', err.message || err);
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
