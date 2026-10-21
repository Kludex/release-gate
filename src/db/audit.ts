export type AuditEntry = {
  actor?: { id: number; login: string } | null;
  action: string;
  repo?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown>;
};

export type AuditRow = {
  id: number;
  at: number;
  actor_id: number | null;
  actor_login: string | null;
  action: string;
  repo_full_name: string | null;
  request_id: string | null;
  details_json: string | null;
};

export async function audit(db: D1Database, entry: AuditEntry): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (at, actor_id, actor_login, action, repo_full_name, request_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      Date.now(),
      entry.actor?.id ?? null,
      entry.actor?.login ?? null,
      entry.action,
      entry.repo ?? null,
      entry.requestId ?? null,
      entry.details ? JSON.stringify(entry.details) : null,
    )
    .run();
}

export async function listAudit(db: D1Database, repos: string[]): Promise<AuditRow[]> {
  if (repos.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT * FROM audit_log WHERE repo_full_name IN (${repos.map(() => "?").join(", ")})
       ORDER BY id DESC LIMIT 200`,
    )
    .bind(...repos)
    .all<AuditRow>();
  return results;
}
