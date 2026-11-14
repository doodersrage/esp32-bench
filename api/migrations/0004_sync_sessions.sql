-- Sign in with GitHub, for sync. Each signed-in browser holds a random key;
-- only its SHA-256 is stored, pointing at a sync row whose key is the SHA-256
-- of "github:<numeric account id>". No GitHub token, name or email is stored.
CREATE TABLE sync_sessions (
  key_hash TEXT PRIMARY KEY,   -- SHA-256 of the browser's sign-in key (gh_…)
  sync_hash TEXT NOT NULL,     -- sync.code_hash of the account's row
  created_at INTEGER NOT NULL, -- ms since 1970
  used_at INTEGER NOT NULL
);
CREATE INDEX sync_sessions_by_row ON sync_sessions (sync_hash);
