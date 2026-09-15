"use server";
import type { ListingContent } from "@/db/models";
import { applyListingAction } from "@/services/listing-actions";
export type EditFormData = ListingContent & { id: string; version: number };
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
};
export async function edit({
  id,
  version,
  ...content
}: EditFormData): Promise<ServerActionResponse> {
  if (!Number.isSafeInteger(version))
    return { status: "error", message: "Reload this page before saving" };
  return applyListingAction(id, "edit", version, content);
}
