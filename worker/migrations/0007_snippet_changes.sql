CREATE TABLE IF NOT EXISTS snippet_changes (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  snippet_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'delete')),
  changed_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS snippet_changes_owner_sequence
  ON snippet_changes(owner_id, sequence);
