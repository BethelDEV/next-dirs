import { hashToken, limitAction } from "./identity";
import { DomainError } from "./models";

export async function subscribe(db: D1Database, inputEmail: string) {
  const email = inputEmail.toLowerCase();
  if (!(await limitAction(db, `newsletter:${await hashToken(email)}`, 3, 3600)))
    throw new DomainError("Please try later");
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        "INSERT INTO newsletter_subscriptions(email,status,consent_at,unsubscribe_hash,updated_at) VALUES(?,'subscribed',?,?,?) ON CONFLICT(email) DO UPDATE SET status='subscribed',consent_at=excluded.consent_at,unsubscribe_hash=excluded.unsubscribe_hash,updated_at=excluded.updated_at WHERE status='unsubscribed'",
      )
      .bind(email, now, await hashToken(token), now),
    db
      .prepare(
        "INSERT INTO notifications(id,kind,payload_json) SELECT ?,'newsletter-sync',? WHERE changes()=1",
      )
      .bind(`newsletter:${id}`, JSON.stringify({ to: email })),
    db
      .prepare(
        "INSERT INTO notifications(id,kind,payload_json) SELECT ?,'newsletter-welcome',? WHERE changes()=1",
      )
      .bind(
        `welcome:${id}`,
        JSON.stringify({ to: email, unsubscribeToken: token }),
      ),
  ]);
}

export async function unsubscribe(db: D1Database, token: string) {
  const hash = await hashToken(token);
  await db.batch([
    db
      .prepare(
        "UPDATE newsletter_subscriptions SET status='unsubscribed',updated_at=? WHERE unsubscribe_hash=? AND status='subscribed'",
      )
      .bind(new Date().toISOString(), hash),
    db
      .prepare(
        "INSERT INTO notifications(id,kind,payload_json) SELECT ?,'newsletter-sync',json_object('to',email) FROM newsletter_subscriptions WHERE unsubscribe_hash=? AND changes()=1",
      )
      .bind(`unsubscribe:${crypto.randomUUID()}`, hash),
  ]);
}
