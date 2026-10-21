import type { Role } from "@/db/repos";

export type Invite = {
  code_hash: string;
  repo_full_name: string;
  github_login: string;
  role: Role;
  created_by: number;
  expires_at: number;
  used_at: number | null;
};

export async function isBootstrapUsed(db: D1Database, codeHash: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM bootstrap WHERE code_hash = ?")
    .bind(codeHash)
    .first();
  return row !== null;
}

export async function consumeBootstrap(db: D1Database, codeHash: string): Promise<boolean> {
  const result = await db
    .prepare("INSERT INTO bootstrap (code_hash, used_at) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(codeHash, Date.now())
    .run();
  return result.meta.changes === 1;
}

export async function insertInvite(db: D1Database, invite: Omit<Invite, "used_at">): Promise<void> {
  await db
    .prepare(
      `INSERT INTO invites (code_hash, repo_full_name, github_login, role, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      invite.code_hash,
      invite.repo_full_name,
      invite.github_login,
      invite.role,
      invite.created_by,
      invite.expires_at,
    )
    .run();
}

export async function findUsableInvite(db: D1Database, codeHash: string): Promise<Invite | null> {
  return db
    .prepare("SELECT * FROM invites WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(codeHash, Date.now())
    .first<Invite>();
}

export async function consumeInvite(db: D1Database, codeHash: string): Promise<Invite | null> {
  const now = Date.now();
  return db
    .prepare(
      `UPDATE invites SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?
       RETURNING *`,
    )
    .bind(now, codeHash, now)
    .first<Invite>();
}

export async function listOpenInvites(db: D1Database, repo: string): Promise<Invite[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM invites WHERE repo_full_name = ? AND used_at IS NULL AND expires_at > ?
       ORDER BY expires_at`,
    )
    .bind(repo, Date.now())
    .all<Invite>();
  return results;
}
