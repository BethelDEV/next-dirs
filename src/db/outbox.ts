import { safeContentUrl } from "../lib/content-url";
import { findUser } from "./identity";
import { listingById, listingContentSchema } from "./listings";
import { type ListingRow, type UserRow, isVisible } from "./models";

export interface PublicProjection {
  _id: string;
  _type: "item";
  version: number;
  visible: boolean;
  submitter?: { name: string; image: string | null; link: string };
  name?: string;
  slug?: { _type: "slug"; current: string };
  description?: string;
  link?: string;
  introduction?: string;
  image?: {
    _type: "image";
    alt: string;
    asset: { _type: "reference"; _ref: string };
  };
  icon?: {
    _type: "image";
    alt: string;
    asset: { _type: "reference"; _ref: string };
  };
  categories?: { _type: "reference"; _ref: string; _key: string }[];
  tags?: { _type: "reference"; _ref: string; _key: string }[];
  publishDate?: string;
  featured?: boolean;
  sponsor?: boolean;
  sponsorStartDate?: string | null;
  sponsorEndDate?: string | null;
}

export function projectListing(
  row: ListingRow,
  now: string,
  owner?: UserRow,
): PublicProjection {
  const result: PublicProjection = {
    _id: `listing.${row.id}`,
    _type: "item",
    version: row.desired_version,
    visible: isVisible(row),
  };
  if (!result.visible) return result;
  const content = listingContentSchema.parse(JSON.parse(row.content_json));
  const media = (id: string) => ({
    _type: "image" as const,
    alt: content.name,
    asset: { _type: "reference" as const, _ref: id },
  });
  const refs = (ids: string[]) =>
    ids.map((id) => ({ _type: "reference" as const, _ref: id, _key: id }));
  return {
    ...result,
    ...(owner
      ? {
          submitter: {
            name: owner.name,
            image: owner.image ? safeContentUrl(owner.image) || null : null,
            link: safeContentUrl(owner.link),
          },
        }
      : {}),
    name: content.name,
    slug: { _type: "slug", current: row.slug },
    description: content.description,
    link: content.link,
    introduction: content.introduction,
    image: media(content.imageId),
    ...(content.iconId ? { icon: media(content.iconId) } : {}),
    categories: refs(content.categories),
    tags: refs(content.tags),
    publishDate: row.first_published_at ?? now,
    featured: Boolean(row.paid_plan),
    sponsor:
      row.paid_plan === "sponsor" &&
      Boolean(row.sponsor_ends_at && row.sponsor_ends_at > now),
    sponsorStartDate: row.sponsor_started_at,
    sponsorEndDate: row.sponsor_ends_at,
  };
}

export interface Publisher {
  write(value: PublicProjection): Promise<void>;
}

export async function drainOutbox(
  db: D1Database,
  publisher: Publisher,
  maximum = 10,
) {
  for (let count = 0; count < maximum; count++) {
    const now = new Date().toISOString();
    const lease = crypto.randomUUID();
    const job = await db
      .prepare(
        "UPDATE outbox SET status='running',lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM outbox WHERE (status IN ('pending','failed') AND available_at<=?) OR (status='running' AND lease_until<?) ORDER BY created_at LIMIT 1) RETURNING id,listing_id,attempts",
      )
      .bind(lease, new Date(Date.now() + 60_000).toISOString(), now, now)
      .first<{ id: string; listing_id: string; attempts: number }>();
    if (!job) break;
    try {
      let row = await listingById(db, job.listing_id);
      if (
        isVisible(row) &&
        row.paid_plan === "sponsor" &&
        !row.sponsor_started_at
      ) {
        await db
          .prepare(
            "UPDATE listings SET sponsor_started_at=?,sponsor_ends_at=? WHERE id=? AND sponsor_started_at IS NULL AND desired_version=?",
          )
          .bind(
            now,
            new Date(Date.now() + 30 * 86400_000).toISOString(),
            row.id,
            row.desired_version,
          )
          .run();
        row = await listingById(db, row.id);
      }
      await publisher.write(
        projectListing(row, now, await findUser(db, "id", row.owner_id)),
      );
      await db.batch([
        db
          .prepare(
            "UPDATE listings SET published_version=MAX(published_version,?),first_published_at=CASE WHEN ? THEN COALESCE(first_published_at,?) ELSE first_published_at END WHERE id=? AND EXISTS(SELECT 1 FROM outbox WHERE id=? AND lease_token=?)",
          )
          .bind(
            row.desired_version,
            isVisible(row) ? 1 : 0,
            now,
            row.id,
            job.id,
            lease,
          ),
        db
          .prepare(
            "INSERT INTO notifications(id,kind,payload_json) SELECT ?,'published',? WHERE ?=1 AND EXISTS(SELECT 1 FROM outbox WHERE id=? AND lease_token=?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(
            `published:${row.id}`,
            JSON.stringify({ userId: row.owner_id, listingId: row.id }),
            isVisible(row) ? 1 : 0,
            job.id,
            lease,
          ),
        db
          .prepare(
            "UPDATE outbox SET status='done',lease_token=NULL,lease_until=NULL,last_error=NULL WHERE id=? AND lease_token=?",
          )
          .bind(job.id, lease),
      ]);
    } catch {
      await db
        .prepare(
          "UPDATE outbox SET status='failed',lease_token=NULL,lease_until=NULL,last_error='Publication failed',available_at=? WHERE id=? AND lease_token=?",
        )
        .bind(
          new Date(
            Date.now() + Math.min(3600, 2 ** Math.min(job.attempts, 10)) * 1000,
          ).toISOString(),
          job.id,
          lease,
        )
        .run();
    }
  }
}
