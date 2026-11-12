-- Hardware lab runs: the owner's Raspberry Pi flashes each project's prebuilt
-- firmware onto real boards, checks the serial output, and posts one run.
CREATE TABLE lab_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  runner TEXT NOT NULL DEFAULT '',        -- a label for the rig, e.g. "garage-pi"
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  core TEXT NOT NULL DEFAULT '',          -- Arduino-ESP32 core the firmware was built with
  firmware_built_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES lab_runs(id),
  project TEXT NOT NULL,
  board TEXT NOT NULL,
  chip TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'flash_failed', 'skipped')),
  seconds INTEGER NOT NULL DEFAULT 0,
  matched TEXT NOT NULL DEFAULT '[]',     -- JSON array of pattern sources that matched
  missing TEXT NOT NULL DEFAULT '[]',     -- JSON array of pattern sources that did not
  output TEXT NOT NULL DEFAULT ''         -- the last lines the board printed
);
CREATE INDEX lab_results_project ON lab_results (project, run_id);
CREATE INDEX lab_results_run ON lab_results (run_id);
