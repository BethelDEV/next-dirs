import { DomainError } from "./models";

export interface OrderRow {
  id: string;
  user_id: string;
  listing_id: string;
  plan: "pro" | "sponsor";
  price_id: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "paid" | "failed" | "expired" | "refunded";
  stripe_session_id: string | null;
  stripe_payment_id: string | null;
  checkout_url: string | null;
  refunded_amount: number;
}

export async function recordPayment(
  db: D1Database,
  input: {
    eventId: string;
    eventType: string;
    orderId: string;
    sessionId: string;
    paymentId: string | null;
    amount: number;
    currency: string;
    state: "paid" | "processing" | "failed" | "expired";
  },
) {
  const order = await db
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(input.orderId)
    .first<OrderRow>();
  if (
    !order ||
    order.stripe_session_id !== input.sessionId ||
    order.amount !== input.amount ||
    order.currency !== input.currency ||
    (input.state === "paid" && !input.paymentId)
  )
    throw new DomainError("Payment does not match an order");
  const now = new Date().toISOString();
  const job = crypto.randomUUID();
  const results = await db.batch([
    db
      .prepare(
        "INSERT INTO payment_events(id,event_type,order_id) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING",
      )
      .bind(input.eventId, input.eventType, order.id),
    db
      .prepare(
        "UPDATE orders SET status=?,stripe_payment_id=COALESCE(stripe_payment_id,?),paid_at=CASE WHEN ?='paid' THEN ? ELSE paid_at END WHERE id=? AND status NOT IN ('paid','refunded') AND (?='paid' OR status IN ('pending','processing')) AND changes()=1",
      )
      .bind(
        input.state,
        input.paymentId,
        input.state,
        now,
        order.id,
        input.state,
      ),
    db
      .prepare(
        "UPDATE listings SET paid_plan=?,sponsor_started_at=NULL,sponsor_ends_at=NULL,desired_version=desired_version+1,updated_at=? WHERE id=? AND changes()=1 AND ?='paid'",
      )
      .bind(order.plan, now, order.listing_id, input.state),
    db
      .prepare(
        "INSERT INTO outbox(id,listing_id,version) SELECT ?,id,desired_version FROM listings WHERE id=? AND changes()=1",
      )
      .bind(job, order.listing_id),
    db
      .prepare(
        "INSERT INTO notifications(id,kind,payload_json) SELECT ?,'payment',? WHERE EXISTS(SELECT 1 FROM outbox WHERE id=?)",
      )
      .bind(
        `payment:${order.id}`,
        JSON.stringify({ userId: order.user_id, listingId: order.listing_id }),
        job,
      ),
  ]);
  return results[1].meta.changes === 1;
}

/** A refund is a provider fact. It does not initiate a refund or undo author intent. */
export async function recordRefund(
  db: D1Database,
  input: {
    eventId: string;
    paymentId: string;
    refunded: number;
    currency: string;
  },
) {
  const order = await db
    .prepare("SELECT * FROM orders WHERE stripe_payment_id=?")
    .bind(input.paymentId)
    .first<OrderRow>();
  if (
    !order ||
    input.refunded < 0 ||
    input.refunded > order.amount ||
    input.currency !== order.currency
  )
    throw new DomainError("Refund does not match an order");
  const job = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        "INSERT INTO payment_events(id,event_type,order_id) VALUES(?,'charge.refunded',?) ON CONFLICT(id) DO NOTHING",
      )
      .bind(input.eventId, order.id),
    db
      .prepare(
        "UPDATE orders SET refunded_amount=?,status=CASE WHEN ?=amount THEN 'refunded' ELSE status END WHERE id=? AND refunded_amount<? AND changes()=1",
      )
      .bind(input.refunded, input.refunded, order.id, input.refunded),
    db
      .prepare(
        "UPDATE listings SET paid_plan=NULL,sponsor_ends_at=NULL,sponsor_started_at=NULL,desired_version=desired_version+1 WHERE id=? AND changes()=1 AND ?=? AND NOT EXISTS(SELECT 1 FROM orders WHERE listing_id=? AND status='paid' AND id!=?)",
      )
      .bind(
        order.listing_id,
        input.refunded,
        order.amount,
        order.listing_id,
        order.id,
      ),
    db
      .prepare(
        "INSERT INTO outbox(id,listing_id,version) SELECT ?,id,desired_version FROM listings WHERE id=? AND changes()=1",
      )
      .bind(job, order.listing_id),
  ]);
}
