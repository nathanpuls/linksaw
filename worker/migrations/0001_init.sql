CREATE TABLE IF NOT EXISTS login_requests (
  id TEXT PRIMARY KEY,
  code_challenge TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS snippets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS snippets_owner_updated ON snippets(owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS details (
  id TEXT PRIMARY KEY,
  snippet_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  body TEXT NOT NULL,
  FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS details_snippet_position ON details(snippet_id, position);
