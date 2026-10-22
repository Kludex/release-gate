export type Role = "admin" | "approver";

export type RepoPolicy = {
  repo_full_name: string;
  installation_id: number | null;
  min_approvals: number;
  prevent_self_review: number;
  require_default_branch: number;
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
  policy: Pick<RepoPolicy, "min_approvals" | "prevent_self_review" | "require_default_branch">,
): Promise<void> {
  await db
    .prepare(
      `UPDATE repo_policies SET min_approvals = ?, prevent_self_review = ?, require_default_branch = ?
       WHERE repo_full_name = ?`,
    )
    .bind(policy.min_approvals, policy.prevent_self_review, policy.require_default_branch, repo)
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
