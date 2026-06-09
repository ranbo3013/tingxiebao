import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'tingxiebao.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    -- Word lists (textbook units or uploaded Excel files)
    CREATE TABLE IF NOT EXISTS word_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('textbook', 'upload')),
      textbook_version TEXT,
      grade TEXT,
      unit TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Individual words in a word list
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_list_id INTEGER NOT NULL,
      chinese TEXT NOT NULL,
      english TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (word_list_id) REFERENCES word_lists(id) ON DELETE CASCADE
    );

    -- Practice sessions
    CREATE TABLE IF NOT EXISTS practice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_list_id INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('full', 'review')),
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed')),
      total_words INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (word_list_id) REFERENCES word_lists(id)
    );

    -- Individual word results within a practice session
    CREATE TABLE IF NOT EXISTS practice_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 1,
      answer_type TEXT NOT NULL CHECK(answer_type IN ('voice', 'type')),
      user_answer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id)
    );

    -- Index for efficient error word queries
    CREATE INDEX IF NOT EXISTS idx_practice_results_session
      ON practice_results(session_id);
    CREATE INDEX IF NOT EXISTS idx_practice_results_word
      ON practice_results(word_id);
    CREATE INDEX IF NOT EXISTS idx_words_word_list
      ON words(word_list_id);
  `);

  console.log('[DB] Database initialized successfully');
}

export default db;
