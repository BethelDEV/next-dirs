"use server";
import { getDb } from "@/db";
import { unsubscribe } from "@/db/newsletter";
import { z } from "zod";
export async function unsubscribeToNewsletter(input: { token: string }) {
  const parsed = z.object({ token: z.string().uuid() }).safeParse(input);
  if (!parsed.success)
    return { status: "error", message: "Invalid unsubscribe link" };
  await unsubscribe(await getDb(), parsed.data.token);
  return { status: "success", message: "You have been unsubscribed." };
}
