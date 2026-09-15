import "server-only";
import { getDb } from "@/db";
import { findUser } from "@/db/identity";

export const getUserByEmail = async (email: string) => {
  const row = await findUser(await getDb(), "email", email);
  return row
    ? { ...row, _id: row.id, stripeCustomerId: row.stripe_customer_id }
    : null;
};
export const getUserById = async (id: string) => {
  const row = await findUser(await getDb(), "id", id);
  return row
    ? { ...row, _id: row.id, stripeCustomerId: row.stripe_customer_id }
    : null;
};
