-- Build reports that their senders agreed to publish. Each waits for the site
-- owner to approve or reject it from the link in the report email.
CREATE TABLE builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,            -- project id, e.g. "dht22"
  board TEXT NOT NULL,
  core TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL,
  output TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  public_name TEXT NOT NULL DEFAULT '',  -- '' shows as "Anonymous"
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  token_hash TEXT NOT NULL,         -- SHA-256 of the moderation token; the token itself is only in the email
  decided_at TEXT
);
CREATE INDEX builds_project_status ON builds (project, status, created_at);
