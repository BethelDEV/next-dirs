import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Public reads are dynamic in v1. Do not enable ISR without configuring its store.
const config = defineCloudflareConfig();
config.buildCommand = "corepack pnpm build";
export default config;
