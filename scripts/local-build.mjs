import { spawnSync } from "node:child_process";

// Explicit synthetic build configuration; no provider credentials or real data.
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
  WRANGLER_SEND_METRICS: "false",
  NEXT_PUBLIC_APP_URL: "http://localhost:8787",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "localtest",
  NEXT_PUBLIC_SANITY_DATASET: "local",
  AUTH_SECRET: "local-only-example-auth-secret-must-never-be-used-on-a-server",
  SANITY_API_TOKEN: "",
  SANITY_PUBLISH_TOKEN: "",
  SANITY_PREVIEW_TOKEN: "",
  STRIPE_API_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  RESEND_API_KEY: "",
};
const command = process.argv.includes("--worker")
  ? ["pnpm", "exec", "opennextjs-cloudflare", "build"]
  : ["pnpm", "build"];
const result = spawnSync("corepack", command, { env, stdio: "inherit" });
process.exit(result.status ?? 1);
