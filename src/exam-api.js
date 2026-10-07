import { HttpError } from './auth.js';
import { createPracticeEngine } from './practice.js';
import { createStudentFeatures } from './student-features.js';

async function readStudentJson(req, limit) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

export function createExamApi(auth, engine, roster, database) {
  const practiceEngine = database ? createPracticeEngine(database) : null;
  const studentFeatures = database ? createStudentFeatures(database) : null;

  return async (req, res, path) => {
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };

    try {
      if (req.method === 'POST') auth.checkOrigin(req);

      if (path === '/api/monitor' && req.method === 'GET') {
        await auth.requireRole(req, ['teacher', 'admin']);
        await engine.sweep();
        return json(200, await roster());
      }

      // Student Practice & Dashboard routes
      if (path.startsWith('/api/student/')) {
        const user = await auth.requireRole(req, ['student']);

        if (path === '/api/student/dashboard' && req.method === 'GET') {
          return json(200, { ...(await engine.getStudentOverview(user.id)), user: { id: user.id, name: user.name, loginId: user.login_id || user.loginId, targetExam: user.target_exam || 'UCEED 2026' } });
        }
        if (path === '/api/student/analytics' && req.method === 'GET') return json(200, await engine.getStudentOverview(user.id));

        if (path === '/api/student/preferences' && req.method === 'GET') return json(200, { preferences: await studentFeatures.getPreferences(user.id) });
        if (path === '/api/student/preferences' && req.method === 'POST') {
          const input = await readStudentJson(req, 8192);
          return json(200, { preferences: await studentFeatures.savePreferences(user.id, input) });
        }
        if (path === '/api/student/features/gk/cards' && req.method === 'GET') return json(200, await studentFeatures.getGkCards(user.id));
        if (path === '/api/student/features/gk/review' && req.method === 'POST') {
          const input = await readStudentJson(req, 8192);
          return json(200, { progress: await studentFeatures.reviewGkCard(user.id, input.cardId, input.rating) });
        }
        if (path === '/api/student/features/sketches' && req.method === 'GET') return json(200, await studentFeatures.listSketches(user.id));
        if (path === '/api/student/features/sketches' && req.method === 'POST') {
          const input = await readStudentJson(req, 3 * 1024 * 1024);
          return json(201, { sketch: await studentFeatures.createSketch(user.id, input) });
        }
        const sketchDelete = path.match(/^\/api\/student\/features\/sketches\/([a-zA-Z0-9_-]+)\/delete$/);
        if (sketchDelete && req.method === 'POST') {
          const removed = await studentFeatures.deleteSketch(user.id, sketchDelete[1]);
          if (!removed) throw new HttpError(404, 'Sketch not found.');
          return json(200, { deleted: true });
        }
        if (path === '/api/student/features/guides' && req.method === 'GET') return json(200, studentFeatures.listGuides());
        if (path === '/api/student/features/guides/progress' && req.method === 'GET') return json(200, await studentFeatures.guideProgress(user.id));
        const guideQuiz = path.match(/^\/api\/student\/features\/guides\/([a-zA-Z0-9_-]+)\/quiz$/);
        if (guideQuiz && req.method === 'POST') {
          const input = await readStudentJson(req, 8192);
          return json(200, { result: await studentFeatures.submitGuideQuiz(user.id, guideQuiz[1], input.answers) });
        }

        if (path === '/api/student/practice/topics' && req.method === 'GET') {
          const filters = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams.entries());
          return json(200, await practiceEngine.topicCatalog(filters));
        }

        if (path === '/api/student/practice/sets' && req.method === 'GET') {
          const sets = practiceEngine ? await practiceEngine.getSets(user.id) : [];
          return json(200, { sets });
        }

      const practiceSet = path.match(/^\/api\/student\/practice\/sets\/([a-zA-Z0-9_-]+)$/);
        if (practiceSet && req.method === 'GET') {
          const set = practiceEngine ? await practiceEngine.getSet(user.id, practiceSet[1]) : null;
          if (!set) throw new HttpError(404, 'Practice set not found.');
          return json(200, { set });
        }

        if (path === '/api/student/practice/answer' && req.method === 'POST') {
          const input = await readStudentJson(req, 65536);
          if (typeof input.setId !== 'string' || typeof input.questionId !== 'string' || !Object.hasOwn(input, 'value')) throw new HttpError(400, 'Set, question and answer are required.');
          const saved = await practiceEngine.saveAnswer(user.id, input.setId, input.questionId, input.value);
          if (saved === null) throw new HttpError(404, 'Practice set not found.');
          if (saved === false) throw new HttpError(400, 'Question is not part of this practice set.');
          return json(200, { progress: saved });
        }

        if (path === '/api/student/bookmarks' && req.method === 'GET') return json(200, { bookmarks: await practiceEngine.listBookmarks(user.id) });
        if (path === '/api/student/bookmarks' && req.method === 'POST') {
          const input = await readStudentJson(req, 8192);
          if (typeof input.examId !== 'string' || typeof input.questionId !== 'string' || typeof input.bookmarked !== 'boolean') throw new HttpError(400, 'Exam, question and bookmark state are required.');
          const result = await practiceEngine.setBookmark(user.id, input.examId, input.questionId, input.bookmarked);
          if (result === false) throw new HttpError(404, 'Question was not found in that exam.');
          return json(200, result);
        }
        if (path === '/api/student/features/revision' && req.method === 'GET') {
          const [questions, reviewed] = await Promise.all([practiceEngine.listRevision(user.id), studentFeatures.reviewedRevisionKeys(user.id)]);
          return json(200, { questions: questions.map(question => ({ ...question, reviewed: reviewed.has(`${question.examId}:${question.originalQuestionId || question.questionId || question.id}`) })) });
        }
        if (path === '/api/student/features/revision/review' && req.method === 'POST') {
          const input = await readStudentJson(req, 8192);
          if (typeof input.examId !== 'string' || typeof input.questionId !== 'string' || typeof input.reviewed !== 'boolean') throw new HttpError(400, 'Paper, question and review status are required.');
          const questions = await practiceEngine.listRevision(user.id);
          const exists = questions.some(question => question.examId === input.examId && (question.originalQuestionId || question.questionId || question.id) === input.questionId);
          if (!exists) throw new HttpError(404, 'Question is not in your revision queue.');
          return json(200, { review: await studentFeatures.setRevisionReviewed(user.id, input.examId, input.questionId, input.reviewed) });
        }
        if (path === '/api/student/practice/revision' && req.method === 'GET') return json(200, { questions: await practiceEngine.listRevision(user.id) });

        if (path === '/api/student/practice/count' && (req.method === 'GET' || req.method === 'POST')) {
          const filters = req.method === 'GET' ? Object.fromEntries(new URL(req.url, 'http://localhost').searchParams.entries()) : await readStudentJson(req, 8192);
          if (filters.topics && typeof filters.topics === 'string') filters.topics = filters.topics.split(',').filter(Boolean);
          const countRes = practiceEngine ? await practiceEngine.countMatching(filters) : { count: 0 };
          return json(200, countRes);
        }

        if (path === '/api/student/practice/create' && req.method === 'POST') {
          if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
          const input = await readStudentJson(req, 65536);
          const created = practiceEngine ? await practiceEngine.createSet(user.id, input) : null;
          if (!created) throw new HttpError(503, 'Practice storage is unavailable.');
          return json(200, { set: created });
        }

        throw new HttpError(404, 'Endpoint not found.');
      }

      // Authoring routes for Teachers & Admins

      // Authoring routes for Teachers & Admins
      if (path.startsWith('/api/author/')) {
        await auth.requireRole(req, ['teacher', 'admin']);
        
        if (path === '/api/author/exams' && req.method === 'GET') {
          let list = await engine.listAuthored();
          if (!list.length && database) {
            try {
              const { seedExams } = await import('../scripts/seed-exams.js');
              await seedExams(database);
              list = await engine.listAuthored();
            } catch (err) {
              console.error('On-demand exam seeding error:', err.message);
            }
          }
          return json(200, { exams: list });
        }

        const detail = path.match(/^\/api\/author\/exams\/([a-zA-Z0-9_-]+)$/);
        if (detail && req.method === 'GET') {
          return json(200, await engine.getAuthored(detail[1]));
        }

        if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
        if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Use application/json.');

        let text = '', length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 1048576) throw new HttpError(413, 'Request too large.');
          text += chunk;
        }
        let input;
        try {
          input = JSON.parse(text);
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
        } catch {
          throw new HttpError(400, 'Invalid JSON.');
        }

        if (path === '/api/author/exams') {
          return json(200, await engine.saveExam(input));
        }

        const assign = path.match(/^\/api\/author\/exams\/([a-zA-Z0-9_-]+)\/assign$/);
        if (assign) {
          return json(200, await engine.assignExam(assign[1], input.userIds));
        }

        throw new HttpError(404, 'Endpoint not found.');
      }

      // Analytics routes
      if (path.startsWith('/api/analytics/')) {
        if (path === '/api/analytics/student' && req.method === 'GET') {
          const user = await auth.requireRole(req, ['student']);
          return json(200, await engine.getStudentHistory(user.id));
        }

        const examMatch = path.match(/^\/api\/analytics\/exams\/([a-zA-Z0-9_-]+)$/);
        if (examMatch && req.method === 'GET') {
          await auth.requireRole(req, ['teacher', 'admin']);
          return json(200, await engine.getExamAnalytics(examMatch[1]));
        }

        throw new HttpError(404, 'Endpoint not found.');
      }

      const control = path.match(/^\/api\/attempts\/([a-zA-Z0-9_-]+)\/control$/);
      const user = await auth.requireRole(req, control ? ['teacher', 'admin'] : ['student']);

      if (path === '/api/exams' && req.method === 'GET') return json(200, { exams: await engine.list(user.id) });

      const start = path.match(/^\/api\/exams\/([a-zA-Z0-9_-]+)\/start$/);
      if (start && req.method === 'POST') return json(200, await engine.start(start[1], user.id));
      const reattempt = path.match(/^\/api\/exams\/([a-zA-Z0-9_-]+)\/reattempt$/);
      if (reattempt && req.method === 'POST') return json(200, await engine.reattempt(reattempt[1], user.id));

      const route = path.match(/^\/api\/attempts\/([a-zA-Z0-9_-]+)(?:\/(answers|submit|flags|control))?$/);
      if (!route) throw new HttpError(404, 'Endpoint not found.');

      if (!route[2] && req.method === 'GET') return json(200, await engine.get(route[1], user.id));

      if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Use application/json.');

      let text = '', length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 8192) throw new HttpError(413, 'Request too large.');
        text += chunk;
      }
      let input;
      try {
        input = JSON.parse(text);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
      } catch {
        throw new HttpError(400, 'Invalid JSON.');
      }

      if (route[2] === 'control') return json(200, await engine.control(route[1], user.id, input));
      if (route[2] === 'answers') return json(200, await engine.answer(route[1], user.id, input));
      if (route[2] === 'submit') return json(200, await engine.submit(route[1], user.id, input.expectedVersion));
      if (route[2] === 'flags') return json(200, await engine.flag(route[1], user.id, input));

      throw new HttpError(404, 'Endpoint not found.');
    } catch (error) {
      json(error.status || 500, {
        error: error.status ? error.message : 'Request failed. Please try again.',
        ...(error.code ? { code: error.code } : {})
      });
    }
  };
}
