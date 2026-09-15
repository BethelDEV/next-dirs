import { z } from "zod";
import { safeContentUrl } from "../lib/content-url";
import {
  DomainError,
  type ListingContent,
  type ListingRow,
  type UserRow,
  canEdit,
  canPublish,
} from "./models";

const reference = z
  .string()
  .regex(/^[a-zA-Z0-9_.-]+$/)
  .max(128);
export const listingContentSchema = z
  .object({
    name: z.string().trim().min(1).max(32),
    link: z
      .string()
      .url()
      .max(2048)
      .refine((url) => Boolean(safeContentUrl(url))),
    description: z.string().trim().min(1).max(256),
    introduction: z.string().min(1).max(4096),
    imageId: reference,
    iconId: reference.optional(),
    categories: z.array(reference).min(1).max(10),
    tags: z.array(reference).min(1).max(20),
  })
  .strict();

export async function listingById(db: D1Database, id: string) {
  return db
    .prepare(
      "SELECT listings.*,EXISTS(SELECT 1 FROM outbox WHERE listing_id=listings.id AND status='failed') AS failed_sync,(SELECT status FROM orders WHERE listing_id=listings.id ORDER BY created_at DESC LIMIT 1) AS payment_status FROM listings WHERE id=?",
    )
    .bind(id)
    .first<ListingRow>();
}

async function checkUploads(
  db: D1Database,
  actor: UserRow,
  content: z.infer<typeof listingContentSchema>,
  ownerId = actor.id,
) {
  for (const id of [content.imageId, content.iconId].filter(Boolean)) {
    const upload = await db
      .prepare(
        "SELECT id FROM uploads WHERE asset_id=? AND status='ready' AND (owner_id=? OR owner_id=?)",
      )
      .bind(id, actor.id, ownerId)
      .first();
    if (!upload)
      throw new DomainError("Upload is missing or belongs to another user");
  }
}

export async function createListing(
  db: D1Database,
  actor: UserRow,
  input: unknown,
) {
  if (actor.disabled) throw new DomainError("Unauthorized");
  const content = listingContentSchema.parse(input);
  await checkUploads(db, actor, content);
  const id = crypto.randomUUID();
  const base =
    content.name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "listing";
  // Including a short ID avoids racing on duplicate names; slug never changes.
  const slug = `${base}-${id.slice(0, 8)}`;
  await db
    .prepare(
      "INSERT INTO listings(id,owner_id,slug,content_json) VALUES(?,?,?,?)",
    )
    .bind(id, actor.id, slug, JSON.stringify(content))
    .run();
  return id;
}

type Transition =
  | "edit"
  | "request-review"
  | "approve"
  | "reject"
  | "publish"
  | "unpublish"
  | "hide"
  | "restore";

/** Optimistic concurrency: all consequences are guarded by the successful UPDATE. */
export async function transitionListing(
  db: D1Database,
  actor: UserRow,
  id: string,
  expected: number,
  action: Transition,
  input?: unknown,
) {
  const row = await listingById(db, id);
  if (!row || actor.disabled) throw new DomainError("Listing not found");
  if (row.desired_version !== expected)
    throw new DomainError("This listing changed. Reload before saving.");
  const ownerAction = ["request-review", "publish", "unpublish"].includes(
    action,
  );
  if (ownerAction && actor.id !== row.owner_id)
    throw new DomainError("Only the author controls publication");
  if (
    ["approve", "reject", "hide", "restore"].includes(action) &&
    actor.role === "USER"
  )
    throw new DomainError("Forbidden");
  if (action === "edit") {
    if (!canEdit(actor, row)) throw new DomainError("Forbidden");
    const content = listingContentSchema.parse(input);
    await checkUploads(db, actor, content, row.owner_id);
    row.content_json = JSON.stringify(content);
    if (!row.first_published_at && row.review_status !== "draft")
      row.review_status = "pending";
  } else if (action === "request-review") {
    if (!row.first_published_at && row.review_status !== "approved")
      row.review_status = "pending";
  } else if (action === "approve" || action === "reject") {
    if (row.first_published_at || row.review_status !== "pending")
      throw new DomainError(
        "Only first submissions awaiting review can be reviewed",
      );
    row.review_status = action === "approve" ? "approved" : "rejected";
    row.review_reason =
      action === "reject"
        ? z.string().trim().min(1).max(1000).parse(input)
        : null;
  } else if (action === "publish") {
    if (!canPublish(row) || row.admin_hidden)
      throw new DomainError("This listing cannot be published yet");
    row.publish_requested = 1;
  } else if (action === "unpublish") row.publish_requested = 0;
  else if (action === "hide") row.admin_hidden = 1;
  else if (action === "restore") row.admin_hidden = 0;
  else throw new DomainError("Invalid action");
  const version = expected + 1;
  const job = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await db.batch([
    db
      .prepare(
        "UPDATE listings SET content_json=?,review_status=?,review_reason=?,publish_requested=?,admin_hidden=?,desired_version=?,updated_at=? WHERE id=? AND desired_version=?",
      )
      .bind(
        row.content_json,
        row.review_status,
        row.review_reason,
        row.publish_requested,
        row.admin_hidden,
        version,
        now,
        id,
        expected,
      ),
    db
      .prepare(
        "INSERT INTO outbox(id,listing_id,version) SELECT ?,?,? WHERE changes()=1",
      )
      .bind(job, id, version),
    db
      .prepare(
        "INSERT INTO audit_logs(id,actor_id,listing_id,action,before_version,after_version) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM outbox WHERE id=?)",
      )
      .bind(crypto.randomUUID(), actor.id, id, action, expected, version, job),
    db
      .prepare(
        "INSERT INTO notifications(id,kind,payload_json) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM outbox WHERE id=?) AND ? IN ('request-review','approve','reject')",
      )
      .bind(
        `listing:${job}`,
        action,
        JSON.stringify({ userId: row.owner_id, listingId: id }),
        job,
        action,
      ),
    db
      .prepare(
        "INSERT INTO notifications(id,kind,payload_json) SELECT ?,'review-admin',? WHERE EXISTS(SELECT 1 FROM outbox WHERE id=?) AND ?='request-review'",
      )
      .bind(
        `review-admin:${job}`,
        JSON.stringify({ listingId: id }),
        job,
        action,
      ),
  ]);
  if (!result[0].meta.changes)
    throw new DomainError("This listing changed. Reload before saving.");
  return version;
}

/** Separate application DTO. No private fields are inherited from Sanity types. */
export type ListingTaxonomy = {
  _id: string;
  name: string;
  slug: { current: string };
};

export function listingDto(
  row: ListingRow,
  taxonomy?: Map<string, ListingTaxonomy>,
) {
  const content = listingContentSchema.parse(JSON.parse(row.content_json));
  const media = (id: string) =>
    id
      ? {
          _type: "image" as const,
          asset: { _type: "reference" as const, _ref: id },
          alt: content.name,
          blurDataURL: null,
        }
      : null;
  const terms = (ids: string[], kind: string) =>
    ids.map(
      (id) =>
        taxonomy?.get(id) ?? {
          _id: id,
          name: `Unavailable ${kind}`,
          slug: { current: "" },
        },
    );
  return {
    _id: row.id,
    _createdAt: row.created_at,
    slug: { current: row.slug },
    ...content,
    image: media(content.imageId),
    icon: media(content.iconId),
    categories: terms(content.categories, "category"),
    tags: terms(content.tags, "tag"),
    submitter: { _id: row.owner_id, _ref: row.owner_id },
    pricePlan: row.paid_plan ?? "free",
    paid: Boolean(row.paid_plan),
    freePlanStatus:
      row.review_status === "draft" ? "submitting" : row.review_status,
    proPlanStatus: row.paid_plan === "pro" ? "success" : "submitting",
    sponsorPlanStatus: row.paid_plan === "sponsor" ? "success" : "submitting",
    rejectionReason: row.review_reason,
    publishDate:
      row.publish_requested && !row.admin_hidden
        ? row.first_published_at
        : null,
    publishRequested: Boolean(row.publish_requested),
    adminHidden: Boolean(row.admin_hidden),
    firstPublishedAt: row.first_published_at,
    version: row.desired_version,
    publishedVersion: row.published_version,
    syncStatus:
      row.desired_version === row.published_version
        ? "synced"
        : row.failed_sync
          ? "failed"
          : row.desired_version === 1
            ? "draft"
            : "pending",
    paymentStatus: row.payment_status ?? "none",
  };
}

export type SubmissionDto = ReturnType<typeof listingDto>;
