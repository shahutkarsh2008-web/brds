export async function migrate(database) {
  await database.transaction(async query => {
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,password_hash TEXT NOT NULL, phone TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),active INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS auth_challenges (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),provider_session TEXT NOT NULL,expires_at BIGINT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),created_at BIGINT NOT NULL,expires_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS login_history (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),logged_in_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS exams (id TEXT PRIMARY KEY,title TEXT NOT NULL,definition TEXT NOT NULL,created_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS exam_assignments (exam_id TEXT NOT NULL REFERENCES exams(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(exam_id,user_id))`,
      `CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY,exam_id TEXT NOT NULL REFERENCES exams(id),user_id TEXT NOT NULL REFERENCES users(id),exam_json TEXT NOT NULL,answers_json TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','submitted')),started_at BIGINT NOT NULL,deadline BIGINT NOT NULL,version INTEGER NOT NULL,submitted_at BIGINT,result_json TEXT,UNIQUE(exam_id,user_id))`,
      `CREATE TABLE IF NOT EXISTS answer_mutations (attempt_id TEXT NOT NULL REFERENCES attempts(id),id TEXT NOT NULL,PRIMARY KEY(attempt_id,id))`,
      `CREATE TABLE IF NOT EXISTS activity_flags (id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL REFERENCES attempts(id),user_id TEXT NOT NULL REFERENCES users(id),type TEXT NOT NULL,created_at BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS attempt_controls (attempt_id TEXT PRIMARY KEY REFERENCES attempts(id),paused_at BIGINT,offset_ms BIGINT NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS teacher_actions (id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL REFERENCES attempts(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,created_at BIGINT NOT NULL)`,
      'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS challenges_user ON auth_challenges(user_id)',
      'CREATE INDEX IF NOT EXISTS attempts_deadline ON attempts(status,deadline)',
      'CREATE INDEX IF NOT EXISTS flags_attempt ON activity_flags(attempt_id,type,created_at)',
      "UPDATE system_metadata SET value = '4' WHERE key = 'schema_version'",
    ]) await query(sql);
  });
}
