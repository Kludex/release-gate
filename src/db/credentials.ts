export type Credential = {
  credential_id: string;
  github_user_id: number;
  public_key: ArrayBuffer;
  counter: number;
  transports: string;
  name: string;
  created_at: number;
  last_used_at: number | null;
};

export type Challenge = {
  id: string;
  github_user_id: number;
  purpose: string;
  request_id: string | null;
  challenge: string;
  expires_at: number;
  used_at: number | null;
};

export async function listCredentials(db: D1Database, userId: number): Promise<Credential[]> {
  const { results } = await db
    .prepare("SELECT * FROM credentials WHERE github_user_id = ? ORDER BY created_at")
    .bind(userId)
    .all<Credential>();
  return results;
}

export async function getCredential(db: D1Database, id: string): Promise<Credential | null> {
  return db
    .prepare("SELECT * FROM credentials WHERE credential_id = ?")
    .bind(id)
    .first<Credential>();
}

export function insertCredential(
  db: D1Database,
  credential: Omit<Credential, "created_at" | "last_used_at" | "public_key"> & {
    public_key: Uint8Array;
  },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO credentials (credential_id, github_user_id, public_key, counter, transports, name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      credential.credential_id,
      credential.github_user_id,
      credential.public_key,
      credential.counter,
      credential.transports,
      credential.name,
      Date.now(),
    );
}

export async function recordCredentialUse(
  db: D1Database,
  id: string,
  counter: number,
): Promise<void> {
  await db
    .prepare("UPDATE credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?")
    .bind(counter, Date.now(), id)
    .run();
}

export async function insertChallenge(
  db: D1Database,
  challenge: Omit<Challenge, "used_at">,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO challenges (id, github_user_id, purpose, request_id, challenge, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      challenge.id,
      challenge.github_user_id,
      challenge.purpose,
      challenge.request_id,
      challenge.challenge,
      challenge.expires_at,
    )
    .run();
}

export async function consumeChallenge(
  db: D1Database,
  id: string,
  userId: number,
): Promise<Challenge | null> {
  return db
    .prepare(
      `UPDATE challenges SET used_at = ? WHERE id = ? AND github_user_id = ? AND used_at IS NULL
       RETURNING *`,
    )
    .bind(Date.now(), id, userId)
    .first<Challenge>();
}
