import "server-only";
import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "./api";

export function publishingClient() {
  const token = process.env.SANITY_PUBLISH_TOKEN;
  if (!token) throw new Error("SANITY_PUBLISH_TOKEN is missing");
  return createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
    perspective: "raw",
    timeout: 15000,
    maxRetries: 0,
  });
}
