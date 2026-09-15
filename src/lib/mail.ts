import "server-only";
import { getDb } from "@/db";
import { hashToken } from "@/db/identity";
async function enqueue(kind: string, to: string, token: string, name?: string) {
  const id = `${kind}:${await hashToken(token)}`;
  await (await getDb())
    .prepare(
      "INSERT INTO notifications(id,kind,payload_json) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(id, kind, JSON.stringify({ to, token, name }))
    .run();
}
export const sendVerificationEmail = async (email: string, token: string) =>
  enqueue("verify", email, token);
export const sendPasswordResetEmail = async (
  name: string,
  email: string,
  token: string,
) => enqueue("reset", email, token, name);
