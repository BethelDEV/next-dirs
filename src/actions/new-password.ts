"use server";
import { getDb } from "@/db";
import { consumeToken } from "@/db/identity";
import { NewPasswordSchema } from "@/lib/schemas";
import bcrypt from "bcryptjs";
import type { z } from "zod";
export async function newPassword(
  values: z.infer<typeof NewPasswordSchema>,
  token?: string | null,
) {
  const parsed = NewPasswordSchema.safeParse(values);
  if (!parsed.success || !token || token.length > 256)
    return { status: "error", message: "Invalid fields or token" };
  const ok = await consumeToken(
    await getDb(),
    token,
    "reset",
    await bcrypt.hash(parsed.data.password, 12),
  );
  return {
    status: ok ? "success" : "error",
    message: ok
      ? "Password updated. Sign in again."
      : "Invalid or expired token",
  };
}
