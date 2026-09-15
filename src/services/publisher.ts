import type { PublicProjection, Publisher } from "@/db/outbox";
import { type SanityClient, createClient } from "@sanity/client";

/** CAS protects against concurrent and expired-lease writers, including tombstones. */
export class SanityPublisher implements Publisher {
  constructor(private client: SanityClient) {}
  async write(value: PublicProjection) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const previous = await this.client.getDocument<
        PublicProjection & { _rev: string }
      >(value._id);
      if (previous && previous.version >= value.version) return;
      if (!previous) {
        await this.client.createIfNotExists(value);
        continue;
      }
      try {
        const { _id, _type, ...fields } = value;
        let patch = this.client
          .patch(_id)
          .ifRevisionId(previous._rev)
          .set(fields);
        const optional = [
          "name",
          "slug",
          "description",
          "link",
          "affiliateLink",
          "introduction",
          "image",
          "icon",
          "categories",
          "tags",
          "collections",
          "submitter",
          "publishDate",
          "featured",
          "sponsor",
          "sponsorStartDate",
          "sponsorEndDate",
        ];
        const absent = optional.filter((key) => !Object.hasOwn(value, key));
        if (absent.length) patch = patch.unset(absent);
        await patch.commit();
        return;
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("statusCode" in error) ||
          error.statusCode !== 409
        )
          throw error;
      }
    }
    throw new Error("Concurrent publication; retry required");
  }
}

export function workerPublisher(env: {
  NEXT_PUBLIC_SANITY_PROJECT_ID?: string;
  NEXT_PUBLIC_SANITY_DATASET?: string;
  SANITY_PUBLISH_TOKEN?: string;
}) {
  if (!env.SANITY_PUBLISH_TOKEN) throw new Error("Publishing token missing");
  return new SanityPublisher(
    createClient({
      projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
      dataset: env.NEXT_PUBLIC_SANITY_DATASET,
      token: env.SANITY_PUBLISH_TOKEN,
      apiVersion: "2026-09-15",
      perspective: "raw",
      useCdn: false,
      timeout: 15000,
      maxRetries: 0,
    }),
  );
}
