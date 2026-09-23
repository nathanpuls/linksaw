CREATE TABLE IF NOT EXISTS snippet_shares (
  token TEXT PRIMARY KEY,
  snippet_id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS snippet_shares_owner ON snippet_shares(owner_id);
