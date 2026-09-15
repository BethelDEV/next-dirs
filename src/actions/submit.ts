"use server";
import { type SubmissionDto, createListing } from "@/db/listings";
import type { ListingContent } from "@/db/models";
import { requireActor } from "@/services/listing-actions";
export type SubmitFormData = ListingContent;
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
  id?: string;
};
export async function submit(
  formData: SubmitFormData,
): Promise<ServerActionResponse> {
  try {
    const { db, actor } = await requireActor();
    const id = await createListing(db, actor, formData);
    return { status: "success", message: "Draft saved", id };
  } catch {
    return {
      status: "error",
      message: "Unable to save draft. Check fields and uploaded images.",
    };
  }
}
