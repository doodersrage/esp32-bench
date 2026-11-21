-- Whether a lab result was a full check (the lab rig's parts wired to the board,
-- patterns that need them) or the bare-board boot check.
ALTER TABLE lab_results ADD COLUMN checked TEXT NOT NULL DEFAULT 'boot' CHECK (checked IN ('boot', 'full'));
