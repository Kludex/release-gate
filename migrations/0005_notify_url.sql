-- A Slack or Discord incoming webhook that receives the repository's release and admin events.
ALTER TABLE repo_policies ADD COLUMN notify_url TEXT;
