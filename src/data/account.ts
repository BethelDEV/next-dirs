import "server-only";
import { getDb } from "@/db";
export const getAccountByUserId = async (id: string) =>
  (await getDb())
    .prepare("SELECT id FROM accounts WHERE userId=? LIMIT 1")
    .bind(id)
    .first<{ id: string }>();
