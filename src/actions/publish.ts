"use server";
import { applyListingAction } from "@/services/listing-actions";
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
};
export async function publish(id: string): Promise<ServerActionResponse> {
  return applyListingAction(id, "publish");
}
