export type Role = "admin" | "approver";

export type RepoPolicy = {
  repo_full_name: string;
  installation_id: number | null;
  min_approvals: number;
  prevent_self_review: number;
  require_default_branch: number;
  notify_url: string | null;
};

export type Approver = {
  repo_full_name: string;
  github_user_id: number;
  login: string;
  role: Role;
  added_by: number | null;
  created_at: number;
};

export async function upsertInstallation(
  db: D1Database,
  id: number,
  account: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO installations (id, account_login, created_at) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET account_login = excluded.account_login`,
    )
    .bind(id, account, Date.now())
    .run();
}

export async function getPolicy(db: D1Database, repo: string): Promise<RepoPolicy | null> {
  return db
    .prepare("SELECT * FROM repo_policies WHERE repo_full_name = ?")
    .bind(repo)
    .first<RepoPolicy>();
}

export function ensurePolicy(db: D1Database, repo: string): D1PreparedStatement {
  return db.prepare("INSERT OR IGNORE INTO repo_policies (repo_full_name) VALUES (?)").bind(repo);
}

export async function setPolicyInstallation(
  db: D1Database,
  repo: string,
  id: number,
): Promise<void> {
  await db
    .prepare("UPDATE repo_policies SET installation_id = ? WHERE repo_full_name = ?")
    .bind(id, repo)
    .run();
}

export async function updatePolicy(
  db: D1Database,
  repo: string,
  policy: Omit<RepoPolicy, "repo_full_name" | "installation_id">,
): Promise<void> {
  await db
    .prepare(
      `UPDATE repo_policies SET min_approvals = ?, prevent_self_review = ?, require_default_branch = ?,
         notify_url = ?
       WHERE repo_full_name = ?`,
    )
    .bind(
      policy.min_approvals,
      policy.prevent_self_review,
      policy.require_default_branch,
      policy.notify_url,
      repo,
    )
    .run();
}

export async function getApprover(
  db: D1Database,
  repo: string,
  userId: number,
): Promise<Approver | null> {
  return db
    .prepare("SELECT * FROM approvers WHERE repo_full_name = ? AND github_user_id = ?")
    .bind(repo, userId)
    .first<Approver>();
}

export async function listApprovers(db: D1Database, repo: string): Promise<Approver[]> {
  const { results } = await db
    .prepare("SELECT * FROM approvers WHERE repo_full_name = ? ORDER BY login")
    .bind(repo)
    .all<Approver>();
  return results;
}

export async function listAdminRepos(db: D1Database, userId: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      "SELECT repo_full_name FROM approvers WHERE github_user_id = ? AND role = 'admin' ORDER BY 1",
    )
    .bind(userId)
    .all<{ repo_full_name: string }>();
  return results.map((row) => row.repo_full_name);
}

/** Replaces the repositories `userId` could set up, as GitHub reported them at sign-in. */
export async function replaceUserRepos(
  db: D1Database,
  userId: number,
  repos: string[],
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM user_repos WHERE github_user_id = ?").bind(userId),
    ...repos.map((repo) =>
      db
        .prepare("INSERT INTO user_repos (github_user_id, repo_full_name) VALUES (?, ?)")
        .bind(userId, repo),
    ),
  ]);
}

export type UserRepo = { repo_full_name: string; claimed: number };

/** Repositories from the user's last sign-in, and whether someone has set them up. */
export async function listUserRepos(db: D1Database, userId: number): Promise<UserRepo[]> {
  const { results } = await db
    .prepare(
      `SELECT repo_full_name, repo_full_name IN (SELECT repo_full_name FROM approvers) AS claimed
       FROM user_repos WHERE github_user_id = ? ORDER BY 1`,
    )
    .bind(userId)
    .all<UserRepo>();
  return results;
}

export function upsertApprover(
  db: D1Database,
  approver: Omit<Approver, "created_at">,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO approvers (repo_full_name, github_user_id, login, role, added_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (repo_full_name, github_user_id) DO UPDATE SET login = excluded.login,
         role = CASE WHEN approvers.role = 'admin' THEN 'admin' ELSE excluded.role END`,
    )
    .bind(
      approver.repo_full_name,
      approver.github_user_id,
      approver.login,
      approver.role,
      approver.added_by,
      Date.now(),
    );
}

/** Removes an approver, unless they are the repository's last admin. */
export async function removeApprover(
  db: D1Database,
  repo: string,
  userId: number,
): Promise<"removed" | "missing" | "last-admin"> {
  const result = await db
    .prepare(
      `DELETE FROM approvers WHERE repo_full_name = ? AND github_user_id = ?
       AND (role != 'admin'
         OR (SELECT COUNT(*) FROM approvers WHERE repo_full_name = ? AND role = 'admin') > 1)`,
    )
    .bind(repo, userId, repo)
    .run();
  if (result.meta.changes === 1) return "removed";
  return (await getApprover(db, repo, userId)) ? "last-admin" : "missing";
}
