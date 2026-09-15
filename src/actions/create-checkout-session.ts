"use server";
import { priceConfig } from "@/config/price";
import { listingById } from "@/db/listings";
import type { OrderRow } from "@/db/payments";
import { getStripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";
import { requireActor } from "@/services/listing-actions";
import { redirect } from "next/navigation";
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
  stripeUrl?: string;
};
export async function createCheckoutSession(
  itemId: string,
  _priceId: string,
  plan: string,
): Promise<ServerActionResponse> {
  let url: string;
  try {
    const { db, actor } = await requireActor();
    const listing = await listingById(db, itemId);
    const config = priceConfig.plans.find((p) => p.title === plan);
    const priceId =
      plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : plan === "sponsor"
          ? process.env.STRIPE_SPONSOR_PRICE_ID
          : null;
    if (
      !listing ||
      listing.owner_id !== actor.id ||
      listing.admin_hidden ||
      !priceId ||
      !config ||
      config.price <= 0
    )
      return { status: "error", message: "Invalid checkout request" };
    if (
      listing.paid_plan &&
      !(
        plan === "sponsor" &&
        listing.sponsor_ends_at &&
        listing.sponsor_ends_at <= new Date().toISOString()
      )
    )
      return {
        status: "error",
        message: "This listing already has paid access",
      };
    const stripe = getStripe();
    let customerId = actor.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: actor.email },
        { idempotencyKey: `customer:${actor.id}` },
      );
      customerId = customer.id;
      await db
        .prepare(
          "UPDATE users SET stripe_customer_id=? WHERE id=? AND stripe_customer_id IS NULL",
        )
        .bind(customerId, actor.id)
        .run();
    }
    const orderId = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO orders(id,user_id,listing_id,plan,price_id,amount,currency) VALUES(?,?,?,?,?,?,'usd') ON CONFLICT DO NOTHING",
      )
      .bind(
        orderId,
        actor.id,
        itemId,
        plan,
        priceId,
        Math.round(config.price * 100),
      )
      .run();
    const order = await db
      .prepare(
        "SELECT * FROM orders WHERE listing_id=? AND status IN ('pending','processing')",
      )
      .bind(itemId)
      .first<OrderRow>();
    if (!order || order.plan !== plan)
      return {
        status: "error",
        message: "Finish or expire the existing checkout first",
      };
    if (order.checkout_url) url = order.checkout_url;
    else {
      const session = await stripe.checkout.sessions.create(
        {
          customer: customerId,
          mode: "payment",
          line_items: [{ price: priceId, quantity: 1 }],
          metadata: { orderId: order.id },
          success_url: absoluteUrl(`/publish/${itemId}?pay=success`),
          cancel_url: absoluteUrl(`/payment/${itemId}?pay=cancelled`),
          allow_promotion_codes: false,
        },
        { idempotencyKey: `checkout:${order.id}` },
      );
      await db
        .prepare(
          "UPDATE orders SET stripe_session_id=?,checkout_url=? WHERE id=? AND stripe_session_id IS NULL",
        )
        .bind(session.id, session.url, order.id)
        .run();
      url = session.url;
    }
  } catch {
    return {
      status: "error",
      message: "Unable to start checkout. Please retry.",
    };
  }
  redirect(url);
}
