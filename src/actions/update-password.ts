"use server";
import { getDb } from "@/db";
import { findUser } from "@/db/identity";
import { currentUser } from "@/lib/auth";
import { type UserPasswordData, UserPasswordSchema } from "@/lib/schemas";
import bcrypt from "bcryptjs";
export async function updateUserPassword(values: UserPasswordData) {
  const actor = await currentUser();
  const parsed = UserPasswordSchema.safeParse(values);
  if (!actor || !parsed.success)
    return { status: "error", message: "Invalid request" };
  const db = await getDb();
  const user = await findUser(db, "id", actor.id);
  if (
    !user?.password ||
    !(await bcrypt.compare(parsed.data.password, user.password))
  )
    return { status: "error", message: "Incorrect password" };
  const result = await db
    .prepare(
      "UPDATE users SET password=?,session_version=session_version+1 WHERE id=? AND password=? AND disabled=0",
    )
    .bind(
      await bcrypt.hash(parsed.data.newPassword, 12),
      user.id,
      user.password,
    )
    .run();
  return {
    status: result.meta.changes ? "success" : "error",
    message: "Sign in again to continue",
  };
}
