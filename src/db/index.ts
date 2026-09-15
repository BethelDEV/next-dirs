import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Resolve per request: never retain a D1 binding or user in module state. */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("DB binding is not configured");
  return env.DB;
}
