-- When the decision was last handed to GitHub, so a delivery stuck by a crashed worker can be retried.
ALTER TABLE approval_requests ADD COLUMN delivery_started_at INTEGER NOT NULL DEFAULT 0;
