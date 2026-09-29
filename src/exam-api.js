import { HttpError } from './auth.js';

export function createExamApi(auth, engine, roster, database) {
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
