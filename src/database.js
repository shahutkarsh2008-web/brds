import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import pg from 'pg';

export async function openDatabase(env = process.env) {
  if (env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10,
      connectionTimeoutMillis: 5000, query_timeout: 5000 });
    pool.on('error', () => console.error('Idle database connection failed'));
    try {
      await pool.query('CREATE TABLE IF NOT EXISTS system_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      await pool.query("INSERT INTO system_metadata(key, value) VALUES ('schema_version', '0') ON CONFLICT (key) DO NOTHING");
    } catch (error) { await pool.end(); throw error; }
    return { kind: 'postgres', query: (sql, args = []) => pool.query(sql, args),
      async transaction(work) {
        const client = await pool.connect();
        try { await client.query('BEGIN'); const result = await work((sql, args = []) => client.query(sql, args)); await client.query('COMMIT'); return result; }
        catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      }, check: () => pool.query('SELECT 1'), close: () => pool.end() };
  }
  if (env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production');
  const { DatabaseSync } = await import('node:sqlite');
  const path = env.SQLITE_PATH || './data/brds.sqlite';
  if (path !== ':memory:') await mkdir(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS system_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT OR IGNORE INTO system_metadata VALUES ('schema_version', '0');");
  db.exec('PRAGMA foreign_keys=ON');
  const execute = (sql, args = []) => {
    const ordered = [];
    const statement = db.prepare(sql.replace(/\$(\d+)/g, (_, index) => { ordered.push(args[Number(index) - 1]); return '?'; }));
    if (/^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
      const rows = statement.all(...ordered); return { rows, rowCount: rows.length };
    }
    const result = statement.run(...ordered); return { rows: [], rowCount: Number(result.changes) };
  };
  let queue = Promise.resolve();
  const exclusive = work => { const result = queue.then(work); queue = result.catch(() => {}); return result; };
  return { kind: 'sqlite', query: (sql, args) => exclusive(() => execute(sql, args)),
    transaction: work => exclusive(async () => {
      db.exec('BEGIN IMMEDIATE');
      try { const result = await work(execute); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    }), check: () => exclusive(() => db.prepare('SELECT 1').get()), close: () => exclusive(() => db.close()) };
}
