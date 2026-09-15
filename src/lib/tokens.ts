import { getDb } from "@/db";
import { createToken } from "@/db/identity";
export const generateVerificationToken = async (email: string) =>
  createToken(await getDb(), email, "verify");
export const generatePasswordResetToken = async (email: string) =>
  createToken(await getDb(), email, "reset");
