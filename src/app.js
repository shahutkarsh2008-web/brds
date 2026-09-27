import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import { createAuth } from './auth.js';
import { createOtpProvider } from './otp.js';
import { createExamEngine } from './exams.js';
import { createExamApi } from './exam-api.js';
import { createLiveHub } from './live.js';

const assets = new Map([
  ['/', ['login.html', 'text/html; charset=utf-8']],
  ['/login', ['login.html', 'text/html; charset=utf-8']],
  ['/setup', ['index.html', 'text/html; charset=utf-8']],
  ['/student', ['dashboard.html', 'text/html; charset=utf-8']],
  ['/exam', ['exam.html', 'text/html; charset=utf-8']],
  ['/exam.js', ['exam.js', 'text/javascript; charset=utf-8']],
  ['/exam.css', ['exam.css', 'text/css; charset=utf-8']],
  ['/workspace.js', ['workspace.js', 'text/javascript; charset=utf-8']],
  ['/workspace.css', ['workspace.css', 'text/css; charset=utf-8']],
  ['/teacher', ['dashboard.html', 'text/html; charset=utf-8']],
  ['/admin', ['dashboard.html', 'text/html; charset=utf-8']],
  ['/login.js', ['login.js', 'text/javascript; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/auth.css', ['auth.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

export function createApp(database, options = {}) {
  if (options.development && ((options.env || process.env).NODE_ENV === 'production' || process.env.RENDER)) throw new Error('Development fixtures cannot run in production.');
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
  let live;
  const engine = createExamEngine(database, { now: options.now, changed: () => live?.changed() });
  const auth = createAuth(database, { ...options, onChange: () => live?.changed(), otp: options.otp || createOtpProvider(options.env), onLogout(hash) {
    for (const ws of sockets.clients) if (ws.sessionHash === hash) ws.close(4001, 'Signed out');
  } });
  live = createLiveHub(engine, auth, { now: options.now });
  const examApi = createExamApi(auth, engine, live.snapshot);
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Cache-Control', 'no-store');
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; }
    catch { res.writeHead(400); return res.end('Invalid request target'); }
    if (path === '/api/development' && req.method === 'GET') { res.writeHead(200, { 'Content-Type':'application/json' }); return res.end(JSON.stringify({ enabled: options.development === true })); }
    if (path === '/api/exams' || path.startsWith('/api/exams/') || path.startsWith('/api/attempts/') || path === '/api/monitor') return examApi(req, res, path);
    if (path.startsWith('/api/')) return auth.handle(req, res, path);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end();
    }
    if (path === '/health') {
      try {
        await database.check();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', database: database.kind, phase: 3 }));
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'unavailable' }));
      }
    }
    if (['/student', '/teacher', '/admin', '/exam'].includes(path)) {
      try { await auth.requireRole(req, path === '/teacher' ? ['teacher', 'admin'] : [path === '/exam' ? 'student' : path.slice(1)]); }
      catch (error) {
        if (error.status === 401) { res.writeHead(302, { Location: '/login' }); return res.end(); }
        res.writeHead(error.status || 503); return res.end(error.status === 403 ? 'Access denied' : 'Service unavailable');
      }
    }
    const media = path.match(/^\/media\/([a-zA-Z0-9_-]+\.(svg|png|jpg|jpeg|webp))$/);
    const types = { svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp' };
    const asset = media ? ['media/' + media[1], types[media[2]]] : assets.get(path);
    if (!asset) { res.writeHead(404); return res.end('Not found'); }
    try {
      const body = await readFile(new URL(`../public/${asset[0]}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': asset[1] }); res.end(body);
    } catch { res.writeHead(500); res.end('Unable to load page'); }
  });
  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => {});
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; }
    catch { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
    if (!['/ws', '/session-ws'].includes(path)) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return;
    }
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) throw new Error('Origin mismatch');
      } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    }
    let user;
    if (path === '/session-ws') {
      try { auth.checkOrigin(req); user = await auth.session(req); }
      catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
      if (!user) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
    }
    if (socket.destroyed) return;
    sockets.handleUpgrade(req, socket, head, ws => {
      ws.sessionHash = user?.token_hash;
      ws.request = user ? req : null;
      sockets.emit('connection', ws);
      if (user) { ws.send(JSON.stringify({ type: 'connected', role: user.role })); live.add(ws, user); }
    });
  });
  sockets.on('connection', ws => {
    ws.alive = true;
    ws.on('error', () => {});
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', async (data, isBinary) => {
      try {
        if (ws.request && !await auth.session(ws.request)) return ws.close(4001, 'Session expired');
        if (ws.readyState === 1) ws.send(data, { binary: isBinary });
      } catch { ws.close(1011, 'Service unavailable'); }
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of sockets.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false; ws.ping();
      if (ws.request) auth.session(ws.request).then(user => { if (!user) ws.close(4001, 'Session expired'); }).catch(() => ws.close(1011, 'Service unavailable'));
    }
  }, 30000);
  heartbeat.unref();
  const cleanup = setInterval(() => auth.cleanup().catch(() => console.error('Session cleanup failed')), 300000);
  cleanup.unref();
  let sweepRunning = false;
  const expiry = setInterval(async () => {
    if (sweepRunning) return; sweepRunning = true;
    try { await engine.sweep(); } catch { console.error('Exam deadline sweep failed'); } finally { sweepRunning = false; }
  }, 500);
  expiry.unref();
  return {
    server, engine,
    async close() {
      clearInterval(expiry);
      await live.close();
      clearInterval(heartbeat);
      clearInterval(cleanup);
      for (const ws of sockets.clients) ws.terminate();
      await new Promise(resolve => sockets.close(resolve));
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await database.close();
    },
  };
}
