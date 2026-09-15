export async function maintainDatabase(db: D1Database) {
  const now = new Date().toISOString();
  const expired = await db
    .prepare(
      "SELECT id FROM listings WHERE paid_plan='sponsor' AND sponsor_ends_at<=? LIMIT 50",
    )
    .bind(now)
    .all<{ id: string }>();
  for (const row of expired.results) {
    await db.batch([
      db
        .prepare(
          "UPDATE listings SET paid_plan='pro',desired_version=desired_version+1,updated_at=? WHERE id=? AND paid_plan='sponsor' AND sponsor_ends_at<=?",
        )
        .bind(now, row.id, now),
      db
        .prepare(
          "INSERT INTO outbox(id,listing_id,version) SELECT ?,id,desired_version FROM listings WHERE id=? AND changes()=1",
        )
        .bind(crypto.randomUUID(), row.id),
    ]);
  }
  await db.batch([
    db.prepare("DELETE FROM verification_tokens WHERE expires_at<?").bind(now),
    db.prepare("DELETE FROM rate_limits WHERE reset_at<?").bind(Date.now()),
    // Unbound assets remain public. Do not delete shared Sanity assets by guesswork.
    db
      .prepare(
        "UPDATE uploads SET status='abandoned' WHERE status='pending' AND created_at<?",
      )
      .bind(new Date(Date.now() - 86400_000).toISOString()),
  ]);
}
