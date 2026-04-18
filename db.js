import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL 환경변수가 설정되지 않았습니다. .env 파일 또는 호스팅 대시보드에서 설정해 주세요.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
  max: 4,
  idleTimeoutMillis: 30_000,
});

// Convert SQLite-style `?` placeholders to PostgreSQL `$1, $2, ...`
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function query(sql, params = []) {
  const { rows } = await pool.query(toPgPlaceholders(sql), params);
  return rows;
}

export async function get(sql, params = []) {
  const { rows } = await pool.query(toPgPlaceholders(sql), params);
  return rows[0] || null;
}

/**
 * INSERT / UPDATE / DELETE helper.
 * For INSERT returning an id, append `RETURNING id` to the SQL.
 * The returned object exposes `lastInsertRowid` for call-site compatibility.
 */
export async function run(sql, params = []) {
  const { rows, rowCount } = await pool.query(toPgPlaceholders(sql), params);
  return {
    lastInsertRowid: rows[0]?.id ?? null,
    changes: rowCount,
  };
}

/**
 * Transaction helper. Pass an async callback that receives a client with
 * scoped { query, get, run } methods. Automatically BEGIN/COMMIT/ROLLBACK.
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scoped = {
      query: async (sql, params = []) => (await client.query(toPgPlaceholders(sql), params)).rows,
      get: async (sql, params = []) => (await client.query(toPgPlaceholders(sql), params)).rows[0] || null,
      run: async (sql, params = []) => {
        const { rows, rowCount } = await client.query(toPgPlaceholders(sql), params);
        return { lastInsertRowid: rows[0]?.id ?? null, changes: rowCount };
      },
    };
    const result = await fn(scoped);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ============ SCHEMA MIGRATION (runs once on startup) ============
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    avatar TEXT,
    bio TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    cover_image TEXT,
    category TEXT DEFAULT '일상',
    published BOOLEAN NOT NULL DEFAULT TRUE,
    likes INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS post_images (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    caption TEXT,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS invites (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'member',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_posts_user    ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_images_post   ON post_images(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
`;

export async function ensureSchema() {
  await pool.query(SCHEMA);
}
