import { getDb } from "@/db";
import { recordPayment, recordRefund } from "@/db/payments";
import { boundedBody } from "@/lib/bounded-body";
import { getStripe } from "@/lib/stripe";
import Stripe from "stripe";
export async function POST(request: Request) {
  let event: Stripe.Event;
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
      return new Response(null, { status: 400 });
    const body = new TextDecoder().decode(
      await boundedBody(request, 1024 * 1024),
    );
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const db = await getDb();
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const paymentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (paymentId)
        await recordRefund(db, {
          eventId: event.id,
          paymentId,
          refunded: charge.amount_refunded,
          currency: charge.currency,
        });
    } else if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (!orderId) return new Response(null, { status: 400 });
      const paymentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      const state =
        event.type === "checkout.session.expired"
          ? "expired"
          : event.type === "checkout.session.async_payment_failed"
            ? "failed"
            : session.payment_status === "paid"
              ? "paid"
              : "processing";
      await recordPayment(db, {
        eventId: event.id,
        eventType: event.type,
        orderId,
        sessionId: session.id,
        paymentId,
        amount: session.amount_total,
        currency: session.currency,
        state,
      });
    }
    return new Response(null, { status: 200 });
  } catch {
    console.error("Payment event processing failed", { eventId: event.id });
    return new Response(null, { status: 500 });
  }
}
