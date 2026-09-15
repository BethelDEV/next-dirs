"use server";
import { getDb } from "@/db";
import { consumeToken } from "@/db/identity";
export async function newVerification(token: string) {
  const ok =
    typeof token === "string" &&
    token.length < 256 &&
    (await consumeToken(await getDb(), token, "verify"));
  return {
    status: ok ? "success" : "error",
    message: ok ? "Email verified!" : "Invalid or expired token",
  };
}
