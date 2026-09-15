"use server";
import { applyListingAction } from "@/services/listing-actions";
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
};
export async function submitToReview(
  id: string,
): Promise<ServerActionResponse> {
  return applyListingAction(id, "request-review");
}
