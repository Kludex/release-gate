CREATE TABLE installations (
  id INTEGER PRIMARY KEY,
  account_login TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE repo_policies (
  repo_full_name TEXT PRIMARY KEY,
  installation_id INTEGER,
  min_approvals INTEGER NOT NULL DEFAULT 1,
  -- Like GitHub's environment setting: whoever started the deployment cannot approve it.
  prevent_self_review INTEGER NOT NULL DEFAULT 1,
  require_default_branch INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE approvers (
  repo_full_name TEXT NOT NULL,
  github_user_id INTEGER NOT NULL,
  login TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'approver')),
  added_by INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (repo_full_name, github_user_id)
);

CREATE TABLE credentials (
  credential_id TEXT PRIMARY KEY,
  github_user_id INTEGER NOT NULL,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX credentials_user ON credentials (github_user_id);

CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL UNIQUE,
  installation_id INTEGER NOT NULL,
  repo_full_name TEXT NOT NULL,
  environment TEXT NOT NULL,
  run_id INTEGER NOT NULL,
  ref TEXT NOT NULL,
  sha TEXT NOT NULL,
  sender_login TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  -- JSON array of user ids that started the deployment: tag pusher, run actor, triggering actor.
  initiator_ids TEXT NOT NULL DEFAULT '[]',
  callback_url TEXT NOT NULL,
  -- checking -> pending -> delivering -> approved | rejected | error
  status TEXT NOT NULL,
  -- The state sent to GitHub once decided, kept so a failed callback can be retried.
  decision TEXT CHECK (decision IN ('approved', 'rejected')),
  status_reason TEXT,
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX approval_requests_repo_status ON approval_requests (repo_full_name, status);

CREATE TABLE approval_votes (
  request_id TEXT NOT NULL,
  github_user_id INTEGER NOT NULL,
  login TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  credential_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (request_id, github_user_id)
);

CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  github_user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  request_id TEXT,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE invites (
  code_hash TEXT PRIMARY KEY,
  repo_full_name TEXT NOT NULL,
  github_login TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'approver')),
  created_by INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE bootstrap (
  code_hash TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor_id INTEGER,
  actor_login TEXT,
  action TEXT NOT NULL,
  repo_full_name TEXT,
  request_id TEXT,
  details_json TEXT
);
CREATE INDEX audit_log_repo ON audit_log (repo_full_name, at);
