import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwords.js';
import { OtpUnavailable } from './otp.js';

const MINUTE = 60000;
const SESSION_AGE = 12 * 60 * MINUTE;
const CHALLENGE_AGE = 5 * MINUTE;
export const digest = value => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const publicUser = user => ({ id: user.id, loginId: user.login_id, name: user.name, role: user.role });

export async function createUser(database, input) {
  const loginId = typeof input.loginId === 'string' ? input.loginId.trim().toLowerCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.replace(/[\s+-]/g, '') : '';
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(loginId)) throw new HttpError(400, 'Use a login ID of 3–40 letters, numbers, dots, underscores or hyphens.');
  if (!name || name.length > 100) throw new HttpError(400, 'Enter a name of 1–100 characters.');
  if (!/^91[6-9]\d{9}$/.test(phone)) throw new HttpError(400, 'Enter an Indian mobile number with country code 91.');
  if (!['student', 'teacher', 'admin'].includes(input.role)) throw new HttpError(400, 'Choose a valid role.');
  if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) throw new HttpError(400, 'Use a password of 12–128 characters.');
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const result = await database.query(`INSERT INTO users(id,login_id,name,password_hash,phone,role,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(login_id) DO NOTHING RETURNING id`,
  [id, loginId, name, passwordHash, phone, input.role, Date.now()]);
  if (!result.rowCount) throw new HttpError(409, 'That login ID already exists.');
  return { id, loginId, name, role: input.role };
}

export function createAuth(database, { otp, env = process.env, now = Date.now, onLogout = () => {}, onChange = () => {} }) {
  const production = env.NODE_ENV === 'production';
  const origin = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL;
  if (production && (!origin || new URL(origin).protocol !== 'https:')) throw new Error('HTTPS APP_ORIGIN or RENDER_EXTERNAL_URL is required');
  const sessionName = production ? '__Host-brds_session' : 'brds_session';
  const challengeName = production ? '__Host-brds_challenge' : 'brds_challenge';
  const dummyHash = hashPassword(randomBytes(24).toString('hex'));
  function cookie(name, token, seconds) { return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${production ? '; Secure' : ''}`; }
  function readCookie(req, name) {
    const part = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
    const value = part?.slice(name.length + 1) || '';
    return /^[a-f0-9]{64}$/.test(value) ? value : '';
  }
  async function limit(key, maximum, window = 15 * MINUTE) {
    const time = now();
    const bucket = digest(`${key}:${Math.floor(time / window)}`);
    const result = await database.query(`INSERT INTO auth_limits(bucket,count,expires_at) VALUES($1,1,$2)
      ON CONFLICT(bucket) DO UPDATE SET count=auth_limits.count+1 RETURNING count`, [bucket, time + window]);
    if (result.rows[0].count > maximum) throw new HttpError(429, 'Too many attempts. Please wait and try again.');
  }
  async function session(req) {
    const token = readCookie(req, sessionName);
    if (!token) return null;
    const result = await database.query(`SELECT u.*, s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.active=1`, [digest(token), now()]);
    return result.rows[0] || null;
  }
  async function requireRole(req, roles) {
    const user = await session(req);
    if (!user) throw new HttpError(401, 'Please sign in.');
    if (!roles.includes(user.role)) throw new HttpError(403, 'You do not have permission to access this area.');
    return user;
  }
  function checkOrigin(req) {
    const expected = origin ? new URL(origin).origin : `http://${req.headers.host}`;
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
    if (allowedOrigins.length > 0) {
      if (!allowedOrigins.includes(req.headers.origin)) throw new HttpError(403, 'Request origin was rejected.');
    } else {
      if (req.headers.origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Request origin was rejected.');
    }
  }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
    let text = ''; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 8192) throw new HttpError(413, 'Request is too large.'); text += chunk; }
    try { const value = JSON.parse(text); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
    catch { throw new HttpError(400, 'Invalid JSON request.'); }
  }
  function json(res, status, value, cookies) {
    if (cookies) res.setHeader('Set-Cookie', cookies);
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value));
  }
  async function handle(req, res, path) {
    try {
      if (req.method === 'POST') checkOrigin(req);
      if (path === '/api/log-client-event' && req.method === 'POST') {
        const input = await body(req);
        await limit(`telemetry:ip:${req.socket.remoteAddress}`, 100);
        const currentUser = await session(req);
        console.error('[CLIENT TELEMETRY EVENT]', {
          timestamp: new Date(now()).toISOString(),
          userId: currentUser?.id || 'anonymous',
          role: currentUser?.role || 'none',
          path: input.path || 'unknown',
          message: input.message || 'No error message',
          stack: input.stack || null,
          userAgent: req.headers['user-agent']
        });
        return json(res, 200, { logged: true });
      }
      if (path === '/api/login' && req.method === 'POST') {
        const input = await body(req);
        const loginId = typeof input.loginId === 'string' ? input.loginId.trim().toLowerCase() : '';
        if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(loginId) || typeof input.password !== 'string' || input.password.length > 128) throw new HttpError(401, 'Incorrect login ID or password.');
        await limit(`login:ip:${req.socket.remoteAddress}`, 300);
        await limit(`login:user:${loginId}`, 10);
        const user = (await database.query('SELECT * FROM users WHERE login_id=$1', [loginId])).rows[0];
        const valid = await verifyPassword(input.password, user?.password_hash || await dummyHash);
        if (!user || !valid || user.active !== 1) throw new HttpError(401, 'Incorrect login ID or password.');
        await limit(`sms:${user.id}`, 1, MINUTE);
        const providerSession = await otp.send(user.phone);
        const token = randomBytes(32).toString('hex');
        await database.transaction(async query => {
          await query('DELETE FROM auth_challenges WHERE user_id=$1', [user.id]);
          await query('INSERT INTO auth_challenges(token_hash,user_id,provider_session,expires_at) VALUES($1,$2,$3,$4)', [digest(token), user.id, providerSession, now() + CHALLENGE_AGE]);
        });
        return json(res, 200, { otpRequired: true, phoneHint: `••••••${user.phone.slice(-4)}`, expiresIn: CHALLENGE_AGE / 1000 }, [cookie(challengeName, token, CHALLENGE_AGE / 1000)]);
      }
      if (path === '/api/verify-otp' && req.method === 'POST') {
        const input = await body(req);
        const token = readCookie(req, challengeName);
        if (!token || typeof input.code !== 'string' || !/^\d{4,8}$/.test(input.code)) throw new HttpError(400, 'Enter the OTP from your phone.');
        const challenge = (await database.query(`UPDATE auth_challenges SET attempts=attempts+1
          WHERE token_hash=$1 AND expires_at>$2 AND attempts<5 RETURNING *`, [digest(token), now()])).rows[0];
        if (!challenge) throw new HttpError(401, 'OTP expired or attempts exhausted. Sign in again.');
        if (!await otp.verify(challenge.provider_session, input.code)) throw new HttpError(401, 'Incorrect or expired OTP.');
        const rawSession = randomBytes(32).toString('hex');
        const user = await database.transaction(async query => {
          const consumed = await query('DELETE FROM auth_challenges WHERE token_hash=$1 AND expires_at>$2 RETURNING user_id', [digest(token), now()]);
          if (!consumed.rowCount) throw new HttpError(401, 'This OTP challenge has already been used or expired.');
          const account = (await query('SELECT * FROM users WHERE id=$1 AND active=1', [challenge.user_id])).rows[0];
          if (!account) throw new HttpError(401, 'Account unavailable.');
          const oldToken = readCookie(req, sessionName);
          if (oldToken) await query('DELETE FROM sessions WHERE token_hash=$1', [digest(oldToken)]);
          await query('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)', [digest(rawSession), account.id, now(), now() + SESSION_AGE]);
          await query('INSERT INTO login_history(id,user_id,logged_in_at) VALUES($1,$2,$3)', [randomUUID(), account.id, now()]);
          return account;
        });
        const oldToken = readCookie(req, sessionName); if (oldToken) onLogout(digest(oldToken));
        onChange();
        return json(res, 200, { user: publicUser(user), redirect: `/${user.role}` }, [cookie(sessionName, rawSession, SESSION_AGE / 1000), cookie(challengeName, '', 0)]);
      }
      if (path === '/api/logout' && req.method === 'POST') {
        const token = readCookie(req, sessionName);
        if (token) { await database.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]); onLogout(digest(token)); }
        const challenge = readCookie(req, challengeName);
        if (challenge) await database.query('DELETE FROM auth_challenges WHERE token_hash=$1', [digest(challenge)]);
        onChange();
        return json(res, 200, { ok: true }, [cookie(sessionName, '', 0), cookie(challengeName, '', 0)]);
      }
      if (path === '/api/me' && req.method === 'GET') {
        const user = await session(req);
        return json(res, 200, { user: user ? publicUser(user) : null });
      }
      if (['/api/student', '/api/teacher', '/api/admin'].includes(path) && req.method === 'GET') {
        const role = path.split('/').at(-1);
        const user = await requireRole(req, role === 'teacher' ? ['teacher', 'admin'] : [role]);
        return json(res, 200, { user: publicUser(user), phase: 1 });
      }
      if (path === '/api/admin/verify-pin' && req.method === 'POST') {
        const user = await requireRole(req, ['admin']);
        const input = await body(req);
        if (typeof input.password !== 'string') throw new HttpError(400, 'Enter password to confirm.');
        const valid = await verifyPassword(input.password, user.password_hash);
        if (!valid) throw new HttpError(401, 'Incorrect password verification.');
        return json(res, 200, { verified: true });
      }
      if (path === '/api/admin/backup' && req.method === 'GET') {
        await requireRole(req, ['admin']);
        const users = (await database.query('SELECT id, login_id, name, role, created_at FROM users')).rows;
        const exams = (await database.query('SELECT * FROM exams')).rows;
        const attempts = (await database.query('SELECT * FROM attempts')).rows;
        const flags = (await database.query('SELECT * FROM activity_flags')).rows;
        res.setHeader('Content-Disposition', `attachment; filename="brds-cbt-backup-${new Date(now()).toISOString().slice(0,10)}.json"`);
        return json(res, 200, {
          exportedAt: new Date(now()).toISOString(),
          summary: { users: users.length, exams: exams.length, attempts: attempts.length, flags: flags.length },
          users, exams, attempts, flags
        });
      }
      if (path === '/api/admin/users') {
        await requireRole(req, ['admin']);
        if (req.method === 'GET') {
          const users = (await database.query('SELECT id,login_id,name,role,active FROM users ORDER BY login_id LIMIT 1000')).rows;
          return json(res, 200, { users: users.map(user => ({ ...publicUser(user), active: user.active === 1 })) });
        }
        if (req.method === 'POST') return json(res, 201, { user: await createUser(database, await body(req)) });
      }
      throw new HttpError(404, 'Endpoint not found.');
    } catch (error) {
      if (error.status === 429) res.setHeader('Retry-After', '900');
      const statusCode = error.status || (error instanceof OtpUnavailable ? 503 : 500);
      if (statusCode >= 500) {
        console.error('[AUTH SERVER ERROR]', { path, status: statusCode, message: error.message, stack: error.stack });
      } else {
        console.warn('[AUTH REJECTED]', { path, status: statusCode, message: error.message });
      }
      json(res, statusCode, { error: error.status ? error.message : error instanceof OtpUnavailable ? 'OTP delivery is unavailable. Contact your BRDS administrator.' : 'Request failed. Please try again.' });
    }
  }
  return { handle, session, requireRole, checkOrigin, async cleanup() {
    for (const table of ['sessions', 'auth_challenges', 'auth_limits']) await database.query(`DELETE FROM ${table} WHERE expires_at<$1`, [now()]);
  } };
}
