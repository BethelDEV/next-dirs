import "server-only";
import { requireActor } from "@/services/listing-actions";
export async function getOrderByUserIdAndItemId(
  userId: string,
  itemId: string,
) {
  const { db, actor } = await requireActor();
  if (actor.id !== userId) return null;
  return db
    .prepare(
      "SELECT id,plan,amount,currency,status FROM orders WHERE user_id=? AND listing_id=? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(actor.id, itemId)
    .first();
}
