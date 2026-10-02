import { randomUUID } from 'node:crypto';

const parseDefinition = row => {
  try { return JSON.parse(row.definition); } catch { return null; }
};

export function createPracticeEngine(database, { now = Date.now } = {}) {
  async function matchingQuestions(filters = {}) {
    const { rows = [] } = await database.query('SELECT id, definition FROM exams ORDER BY id');
    const selected = [];
    const examFilter = String(filters.exam || 'ALL').toLowerCase();
    const topics = Array.isArray(filters.topics) ? filters.topics.map(String).filter(x => x && x !== 'ALL') : [];
    const wantedType = String(filters.types || filters.type || 'ALL').toUpperCase();
    const wantedDifficulty = String(filters.difficulty || 'ALL').toLowerCase();

    for (const row of rows) {
      const exam = parseDefinition(row);
      if (!exam || !Array.isArray(exam.questions)) continue;
      if (examFilter !== 'all' && !`${row.id} ${exam.title || ''}`.toLowerCase().includes(examFilter)) continue;
      for (const question of exam.questions) {
        if (wantedType !== 'ALL' && String(question.type || '').toUpperCase() !== wantedType) continue;
        if (wantedDifficulty !== 'all' && question.difficulty && String(question.difficulty).toLowerCase() !== wantedDifficulty) continue;
        const tags = Array.isArray(question.tags) ? question.tags.map(String) : [];
        const haystack = [question.topic, question.category, question.sectionId, question.prompt, ...tags].filter(Boolean).join(' ').toLowerCase();
        if (topics.length && !topics.some(topic => {
          const lower = topic.toLowerCase();
          return haystack.includes(lower) || lower.split(/[\s,–—()/]+/).filter(word => word.length > 3).some(word => haystack.includes(word));
        })) continue;
        selected.push({
          id: question.id,
          examId: row.id,
          type: question.type || 'MCQ',
          topic: question.topic || question.category || question.sectionId || '',
          difficulty: question.difficulty || null,
          tags
        });
      }
    }
    return selected;
  }

  async function countMatching(filters = {}) {
    const questions = await matchingQuestions(filters);
    return { count: questions.length };
  }

  async function createSet(userId, options = {}) {
    if (!userId) throw new Error('User ID is required.');
    const exam = options.exam || 'ALL';
    const topics = Array.isArray(options.topics) ? options.topics : [];
    const types = options.types || options.type || 'ALL';
    const difficulty = options.difficulty || 'ALL';
    const skipDone = options.skipDone !== false;
    const setSize = Number.isInteger(Number(options.setSize)) ? Math.max(1, Math.min(100, Number(options.setSize))) : 10;
    let questions = await matchingQuestions({ exam, topics, types, difficulty });

    if (skipDone && questions.length) {
      const { rows = [] } = await database.query('SELECT question_ids_json FROM practice_sets WHERE user_id=$1', [userId]);
      const seen = new Set();
      for (const row of rows) {
        try { for (const id of JSON.parse(row.question_ids_json || '[]')) seen.add(id); } catch {}
      }
      questions = questions.filter(question => !seen.has(question.id));
    }
    const questionIds = [...new Set(questions.map(question => question.id))].slice(0, setSize);
    const id = `set-${randomUUID()}`;
    const createdAt = now();
    const title = String(options.title || `Custom ${exam} Practice Set (${questionIds.length} Qs)`).slice(0, 160);
    const filters = { exam, topics, types, difficulty, skipDone, setSize };
    await database.query(
      'INSERT INTO practice_sets (id,user_id,title,filters_json,question_ids_json,total_questions,completed_questions,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8)',
      [id, userId, title, JSON.stringify(filters), JSON.stringify(questionIds), questionIds.length, questionIds.length ? 'in_progress' : 'empty', createdAt]
    );
    return { id, userId, title, filters, questionIds, totalQuestions: questionIds.length, completedQuestions: 0, status: questionIds.length ? 'in_progress' : 'empty', createdAt };
  }

  async function getSets(userId) {
    if (!userId) return [];
    const { rows = [] } = await database.query('SELECT * FROM practice_sets WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return rows.map(row => ({
      id: row.id, userId: row.user_id, title: row.title,
      filters: JSON.parse(row.filters_json || '{}'), questionIds: JSON.parse(row.question_ids_json || '[]'),
      totalQuestions: Number(row.total_questions), completedQuestions: Number(row.completed_questions),
      status: row.status, createdAt: Number(row.created_at)
    }));
  }

  async function getSet(userId, setId) {
    const { rows = [] } = await database.query('SELECT * FROM practice_sets WHERE id=$1 AND user_id=$2', [setId, userId]);
    const row = rows[0];
    if (!row) return null;
    const questionIds = JSON.parse(row.question_ids_json || '[]');
    const answers = await database.query('SELECT question_id,answer_json,answered_at FROM practice_answers WHERE set_id=$1 ORDER BY answered_at', [setId]);
    const answered = new Map((answers.rows || []).map(answer => [answer.question_id, { value: JSON.parse(answer.answer_json), answeredAt: Number(answer.answered_at) }]));
    return { id: row.id, title: row.title, questionIds, totalQuestions: Number(row.total_questions), completedQuestions: Number(row.completed_questions), status: row.status, answers: Object.fromEntries(answered) };
  }

  async function saveAnswer(userId, setId, questionId, value) {
    return database.transaction(async query => {
      const { rows = [] } = await query('SELECT * FROM practice_sets WHERE id=$1 AND user_id=$2', [setId, userId]);
      const row = rows[0];
      if (!row) return null;
      const questionIds = JSON.parse(row.question_ids_json || '[]');
      if (!questionIds.includes(questionId)) return false;
      const answeredAt = now();
      await query('INSERT INTO practice_answers(set_id,question_id,answer_json,answered_at) VALUES($1,$2,$3,$4) ON CONFLICT(set_id,question_id) DO UPDATE SET answer_json=excluded.answer_json,answered_at=excluded.answered_at', [setId, questionId, JSON.stringify(value), answeredAt]);
      const count = Number((await query('SELECT COUNT(*) AS count FROM practice_answers WHERE set_id=$1', [setId])).rows[0].count);
      const status = count >= Number(row.total_questions) ? 'completed' : 'in_progress';
      await query('UPDATE practice_sets SET completed_questions=$1,status=$2 WHERE id=$3 AND user_id=$4', [count, status, setId, userId]);
      return { completedQuestions: count, totalQuestions: Number(row.total_questions), status };
    });
  }

  async function listBookmarks(userId) {
    const { rows = [] } = await database.query('SELECT question_id AS "questionId",exam_id AS "examId",created_at AS "createdAt" FROM practice_bookmarks WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
    return rows.map(row => ({ questionId: row.questionId || row.question_id, examId: row.examId || row.exam_id, createdAt: Number(row.createdAt ?? row.created_at) }));
  }

  async function setBookmark(userId, examId, questionId, bookmarked) {
    if (bookmarked) await database.query('INSERT INTO practice_bookmarks(user_id,question_id,exam_id,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,question_id,exam_id) DO NOTHING', [userId, questionId, examId, now()]);
    else await database.query('DELETE FROM practice_bookmarks WHERE user_id=$1 AND question_id=$2 AND exam_id=$3', [userId, questionId, examId]);
    return { questionId, examId, bookmarked: Boolean(bookmarked) };
  }

  return { countMatching, createSet, getSets, getSet, saveAnswer, listBookmarks, setBookmark };
}
