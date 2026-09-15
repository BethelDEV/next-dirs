"use server";
import { getDb } from "@/db";
import { currentUser } from "@/lib/auth";
import { type UserNameData, UserNameSchema } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
export async function updateUserName(values: UserNameData) {
  const user = await currentUser();
  const parsed = UserNameSchema.safeParse(values);
  if (!user || !parsed.success)
    return { status: "error", message: "Invalid request" };
  const db = await getDb();
  const event = crypto.randomUUID();
  await db.batch([
    db
      .prepare("UPDATE users SET name=? WHERE id=? AND disabled=0")
      .bind(parsed.data.name, user.id),
    db
      .prepare(
        "UPDATE listings SET desired_version=desired_version+1,updated_at=? WHERE owner_id=? AND (first_published_at IS NOT NULL OR publish_requested=1)",
      )
      .bind(new Date().toISOString(), user.id),
    db
      .prepare(
        "INSERT INTO outbox(id,listing_id,version) SELECT ?||':'||id,id,desired_version FROM listings WHERE owner_id=? AND (first_published_at IS NOT NULL OR publish_requested=1)",
      )
      .bind(event, user.id),
  ]);
  revalidatePath("/settings");
  return { status: "success", message: "Name updated" };
}
