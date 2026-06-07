import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import fs from 'fs';

const DB_FILE = process.env.SQLITE_DB_PATH || 'sqlite.db';

function removeIfExists(filePath: string) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function createConnection() {
  const sqlite = new Database(DB_FILE);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  return sqlite;
}

function getDatabaseConnection() {
  try {
    return createConnection();
  } catch (err: any) {
    const isCorrupt = err.message?.includes('malformed') || err.message?.includes('corrupt') || err.code === 'SQLITE_CORRUPT';
    if (!isCorrupt) throw err;

    console.error(`[DATABASE] Local SQLite file is corrupted: ${err.message}`);
    console.warn('[DATABASE] Recreating a clean local development database.');
    try {
      removeIfExists(DB_FILE);
      removeIfExists(`${DB_FILE}-wal`);
      removeIfExists(`${DB_FILE}-shm`);
    } catch (cleanupError: any) {
      console.error(`[DATABASE] Cleanup failed: ${cleanupError.message}`);
    }
    return createConnection();
  }
}

const sqlite = getDatabaseConnection();

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'personal',
    due_date INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'text/plain',
    content TEXT NOT NULL,
    summary TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pending_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const safeAlterStatements = [
  `ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`,
  `ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'personal'`,
  `ALTER TABLE memories ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE files ADD COLUMN summary TEXT`,
];

for (const statement of safeAlterStatements) {
  try {
    sqlite.exec(statement);
  } catch {
    // Column already exists or table already has the new shape.
  }
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
