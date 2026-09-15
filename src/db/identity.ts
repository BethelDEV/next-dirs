import type { UserRow } from "./models";

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

export async function findUser(
  db: D1Database,
  key: "id" | "email",
  value: string,
) {
  return db
    .prepare(`SELECT * FROM users WHERE ${key} = ?`)
    .bind(value)
    .first<UserRow>();
}

export async function createToken(
  db: D1Database,
  email: string,
  purpose: "verify" | "reset",
) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + 3600_000).toISOString();
  await db
    .prepare(
      "INSERT INTO verification_tokens(token_hash,identifier,purpose,expires_at) VALUES(?,?,?,?) ON CONFLICT(identifier,purpose) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at",
    )
    .bind(await hashToken(token), email.toLowerCase(), purpose, expires)
    .run();
  return { token, identifier: email, expires };
}

/** Mutation and token deletion share one atomic batch; a replay cannot mutate again. */
export async function consumeToken(
  db: D1Database,
  token: string,
  purpose: "verify" | "reset",
  password?: string,
) {
  const hash = await hashToken(token);
  const now = new Date().toISOString();
  const assignment =
    purpose === "verify"
      ? "emailVerified = ?"
      : "password = ?, session_version = session_version + 1";
  const results = await db.batch([
    db
      .prepare(
        `UPDATE users SET ${assignment} WHERE disabled=0 AND email = (SELECT identifier FROM verification_tokens WHERE token_hash=? AND purpose=? AND expires_at > ?)`,
      )
      .bind(purpose === "verify" ? now : password, hash, purpose, now),
    db
      .prepare(
        "DELETE FROM verification_tokens WHERE token_hash=? AND purpose=?",
      )
      .bind(hash, purpose),
  ]);
  return results[0].meta.changes === 1;
}

export async function limitAction(
  db: D1Database,
  key: string,
  limit: number,
  seconds: number,
) {
  const now = Date.now();
  const row = await db
    .prepare(
      "INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at <= ? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END RETURNING count",
    )
    .bind(key, now + seconds * 1000, now, now)
    .first<{ count: number }>();
  return row.count <= limit;
}
