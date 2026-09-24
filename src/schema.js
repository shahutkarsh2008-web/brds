export async function migrate(database) {
  await database.transaction(async query => {
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, login_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        password_hash TEXT NOT NULL, phone TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
        active INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS auth_challenges (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        provider_session TEXT NOT NULL, expires_at BIGINT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS login_history (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), logged_in_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS auth_limits (
        bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL)`,
      'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS challenges_user ON auth_challenges(user_id)',
      "UPDATE system_metadata SET value = '1' WHERE key = 'schema_version'",
    ]) await query(sql);
  });
}
