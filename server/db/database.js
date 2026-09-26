import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const poolConfig = { connectionString: process.env.DATABASE_URL };
if (process.env.DATABASE_SSL === 'true') poolConfig.ssl = { rejectUnauthorized: false };
if (process.env.DATABASE_SSL === 'false') poolConfig.ssl = false;

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export async function initializeDatabase() {
  await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_one_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_two_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (user_one_id < user_two_id),
        UNIQUE (user_one_id, user_two_id)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS messages_conversation_created
        ON messages (conversation_id, created_at, id);
    `);
}

export function closeDatabase() {
  return pool.end();
}

export default {
  query: (text, params) => pool.query(text, params),
  get: async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows[0];
  },
  all: async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows;
  },
  run: async (text, params) => {
    const result = await pool.query(text, params);
    return { lastInsertRowid: result.rows[0]?.id, changes: result.rowCount };
  },
};