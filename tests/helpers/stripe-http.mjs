import assert from "node:assert/strict";

/** Stripe protocol double. Idempotency keys return the same synthetic object. */
export function stripeHttpProvider() {
  const sessions = new Map();
  return async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "api.stripe.com" || request.method !== "POST")
      return null;
    const params = new URLSearchParams(await request.text());
    if (url.pathname === "/v1/customers") {
      assert.ok(
        request.headers.get("idempotency-key")?.startsWith("customer:"),
      );
      return Response.json({ id: "cus_local_checkout", object: "customer" });
    }
    if (url.pathname !== "/v1/checkout/sessions")
      throw new Error("Unexpected Stripe operation");
    const orderId = params.get("metadata[orderId]");
    assert.equal(request.headers.get("idempotency-key"), `checkout:${orderId}`);
    assert.ok(
      ["price_local_pro", "price_local_sponsor"].includes(
        params.get("line_items[0][price]"),
      ),
    );
    assert.equal(params.get("line_items[0][quantity]"), "1");
    assert.equal(params.get("allow_promotion_codes"), "false");
    if (!sessions.has(orderId)) {
      const destination = new URL(params.get("success_url"));
      destination.pathname = destination.pathname.replace(
        "/publish/",
        "/payment/",
      );
      destination.search = new URLSearchParams({
        fixtureCheckout: orderId,
      }).toString();
      sessions.set(orderId, {
        id: `cs_${orderId}`,
        object: "checkout.session",
        url: destination.href,
      });
    }
    return Response.json(sessions.get(orderId));
  };
}
