"use server";
import { getStripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";
import { requireActor } from "@/services/listing-actions";
import { redirect } from "next/navigation";
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
  stripeUrl?: string;
};
export async function openCustomerPortal(
  _customerId?: string,
): Promise<ServerActionResponse> {
  const { actor } = await requireActor();
  if (!actor.stripe_customer_id)
    return { status: "error", message: "No billing account found" };
  const session = await getStripe().billingPortal.sessions.create({
    customer: actor.stripe_customer_id,
    return_url: absoluteUrl("/dashboard"),
  });
  redirect(session.url);
}
