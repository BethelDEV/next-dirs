import "server-only";
import Stripe from "stripe";
export function getStripe() {
  if (!process.env.STRIPE_API_KEY) throw new Error("Stripe is not configured");
  return new Stripe(process.env.STRIPE_API_KEY, {
    apiVersion: "2026-08-26.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 15000,
  });
}
