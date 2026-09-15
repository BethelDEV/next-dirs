"use server";
import { getDb } from "@/db";
import { hashToken, limitAction } from "@/db/identity";
import { sendVerificationEmail } from "@/lib/mail";
import { RegisterSchema } from "@/lib/schemas";
import { generateVerificationToken } from "@/lib/tokens";
import bcrypt from "bcryptjs";
import type { z } from "zod";
export type ServerActionResponse = {
  status: "success" | "error";
  message?: string;
};
export async function register(
  values: z.infer<typeof RegisterSchema>,
): Promise<ServerActionResponse> {
  const parsed = RegisterSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Invalid fields" };
  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const db = await getDb();
  if (!(await limitAction(db, `register:${await hashToken(email)}`, 3, 3600)))
    return { status: "error", message: "Please try later" };
  const result = await db
    .prepare(
      "INSERT INTO users(id,name,email,password) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING",
    )
    .bind(crypto.randomUUID(), name, email, await bcrypt.hash(password, 12))
    .run();
  if (result.meta.changes) {
    const token = await generateVerificationToken(email);
    await sendVerificationEmail(email, token.token);
  }
  return {
    status: "success",
    message: "If registration is available, check your email for verification",
  };
}
