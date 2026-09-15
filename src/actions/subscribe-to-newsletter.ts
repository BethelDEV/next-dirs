"use server";
import { getDb } from "@/db";
import { DomainError } from "@/db/models";
import { subscribe } from "@/db/newsletter";
import { type NewsletterFormData, NewsletterFormSchema } from "@/lib/schemas";
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
};
export async function subscribeToNewsletter(
  input: NewsletterFormData,
): Promise<ServerActionResponse> {
  const parsed = NewsletterFormSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid email" };
  try {
    await subscribe(await getDb(), parsed.data.email);
    return { status: "success", message: "Subscription saved" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof DomainError
          ? error.message
          : "Subscription could not be saved",
    };
  }
}
