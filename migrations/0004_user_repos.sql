-- Repositories a user can set up, read with their sign-in token and refreshed on every sign-in.
CREATE TABLE user_repos (
  github_user_id INTEGER NOT NULL,
  repo_full_name TEXT NOT NULL,
  PRIMARY KEY (github_user_id, repo_full_name)
);
