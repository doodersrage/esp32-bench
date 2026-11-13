-- Sync codes: one browser's bench log, shopping list and parts drawer, shared
-- with any browser that knows the code. The code itself is never stored, only
-- its SHA-256, so this table alone cannot be used to read anyone's data.
CREATE TABLE sync (
  code_hash TEXT PRIMARY KEY,   -- SHA-256 of the normalised code, e.g. "7KQ4-M2XD-9PLA-R3TW"
  data TEXT NOT NULL,           -- JSON: the synced localStorage values, opaque to the API
  created_at INTEGER NOT NULL,  -- ms since 1970
  updated_at INTEGER NOT NULL
);
