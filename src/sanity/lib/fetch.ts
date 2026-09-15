import "server-only";
import type { ClientPerspective, QueryParams } from "next-sanity";
import { draftMode } from "next/headers";
import { sanityClient } from "./client";
import { previewToken } from "./token";
export async function sanityFetch<T>({
  query,
  params = {},
  perspective,
}: {
  query: string;
  params?: QueryParams;
  perspective?: ClientPerspective;
  disableCache?: boolean;
}) {
  // Catalog visibility cannot be bypassed through CMS preview.
  const cms = !query.includes('"item"') && !query.includes("'item'");
  const preview =
    cms && (await draftMode()).isEnabled && perspective !== "published";
  return sanityClient.fetch<T>(query, params, {
    perspective: preview ? "drafts" : "published",
    ...(preview ? { token: previewToken() } : {}),
    useCdn: false,
    cache: "no-store",
  });
}
