export type RequestStatus =
  | "checking"
  | "pending"
  | "delivering"
  | "approved"
  | "rejected"
  | "error";
export type Decision = "approved" | "rejected";
export type Vote = "approve" | "reject";

export type ApprovalRequest = {
  id: string;
  delivery_id: string;
  installation_id: number;
  repo_full_name: string;
  environment: string;
  run_id: number;
  ref: string;
  sha: string;
  sender_login: string;
  sender_id: number;
  initiator_ids: string;
  callback_url: string;
  status: RequestStatus;
  decision: Decision | null;
  status_reason: string | null;
  created_at: number;
  decided_at: number | null;
};

export type NewRequest = Omit<
  ApprovalRequest,
  "status" | "decision" | "status_reason" | "decided_at" | "initiator_ids"
>;

export type VoteRow = {
  request_id: string;
  github_user_id: number;
  login: string;
  decision: Vote;
  credential_id: string;
  created_at: number;
};

export async function insertRequest(db: D1Database, r: NewRequest): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO approval_requests (id, delivery_id, installation_id, repo_full_name, environment,
         run_id, ref, sha, sender_login, sender_id, initiator_ids, callback_url, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'checking', ?)
       ON CONFLICT (delivery_id) DO NOTHING`,
    )
    .bind(
      r.id,
      r.delivery_id,
      r.installation_id,
      r.repo_full_name,
      r.environment,
      r.run_id,
      r.ref,
      r.sha,
      r.sender_login,
      r.sender_id,
      JSON.stringify([r.sender_id]),
      r.callback_url,
      r.created_at,
    )
    .run();
  return result.meta.changes === 1;
}

export async function getRequest(db: D1Database, id: string): Promise<ApprovalRequest | null> {
  return db
    .prepare("SELECT * FROM approval_requests WHERE id = ?")
    .bind(id)
    .first<ApprovalRequest>();
}

export async function markPending(
  db: D1Database,
  id: string,
  initiatorIds: number[],
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE approval_requests SET status = 'pending', initiator_ids = ? WHERE id = ? AND status = 'checking'",
    )
    .bind(JSON.stringify(initiatorIds), id)
    .run();
  return result.meta.changes === 1;
}

export async function startDelivery(
  db: D1Database,
  id: string,
  from: RequestStatus,
  decision: Decision,
  reason: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE approval_requests SET status = 'delivering', decision = ?, status_reason = ?
       WHERE id = ? AND status = ?`,
    )
    .bind(decision, reason, id, from)
    .run();
  return result.meta.changes === 1;
}

export async function finishDelivery(
  db: D1Database,
  id: string,
  status: Decision | "error",
): Promise<void> {
  await db
    .prepare("UPDATE approval_requests SET status = ?, decided_at = ? WHERE id = ?")
    .bind(status, status === "error" ? null : Date.now(), id)
    .run();
}

export async function listRequestsForApprover(
  db: D1Database,
  userId: number,
  open: boolean,
): Promise<ApprovalRequest[]> {
  const statuses = open
    ? "('checking', 'pending', 'delivering', 'error')"
    : "('approved', 'rejected')";
  const { results } = await db
    .prepare(
      `SELECT r.* FROM approval_requests r
       JOIN approvers a ON a.repo_full_name = r.repo_full_name AND a.github_user_id = ?
       WHERE r.status IN ${statuses} ORDER BY r.created_at DESC LIMIT 50`,
    )
    .bind(userId)
    .all<ApprovalRequest>();
  return results;
}

export async function insertVote(db: D1Database, vote: VoteRow): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO approval_votes (request_id, github_user_id, login, decision, credential_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    )
    .bind(
      vote.request_id,
      vote.github_user_id,
      vote.login,
      vote.decision,
      vote.credential_id,
      vote.created_at,
    )
    .run();
  return result.meta.changes === 1;
}

export async function listVotes(db: D1Database, requestId: string): Promise<VoteRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM approval_votes WHERE request_id = ? ORDER BY created_at")
    .bind(requestId)
    .all<VoteRow>();
  return results;
}
