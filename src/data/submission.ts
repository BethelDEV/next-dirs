import "server-only";
import { type ListingTaxonomy, listingById, listingDto } from "@/db/listings";
import { canEdit } from "@/db/models";
import type { ListingRow } from "@/db/models";
import { SUBMISSIONS_PER_PAGE } from "@/lib/constants";
import { sanityFetch } from "@/sanity/lib/fetch";
import { requireActor } from "@/services/listing-actions";

/** Resolve CMS labels and public slugs without exposing private D1 rows to Sanity. */
export async function getListingDtos(rows: ListingRow[]) {
  if (!rows.length) return [];
  const items = rows.map((row) => listingDto(row));
  const ids = [
    ...new Set(
      items.flatMap((item) =>
        [...item.categories, ...item.tags].map((term) => term._id),
      ),
    ),
  ];
  let terms: ListingTaxonomy[] = [];
  try {
    terms = await sanityFetch<ListingTaxonomy[]>({
      query: '*[_type in ["category","tag"] && _id in $ids]{_id,name,slug}',
      params: { ids },
      perspective: "published",
    });
  } catch {
    // CMS downtime must not prevent authors from accessing saved D1 content.
    console.warn("Unable to resolve listing categories and tags");
  }
  const taxonomy = new Map(
    terms
      .filter((term) => term.name && term.slug?.current)
      .map((term) => [term._id, term]),
  );
  return rows.map((row) => listingDto(row, taxonomy));
}
export async function getSubmission(id: string) {
  const { db, actor } = await requireActor();
  const row = await listingById(db, id);
  return row && canEdit(actor, row) ? (await getListingDtos([row]))[0] : null;
}
export async function getSubmissions({ currentPage }: { currentPage: number }) {
  const { db, actor } = await requireActor();
  const page =
    Number.isSafeInteger(currentPage) && currentPage > 0 ? currentPage : 1;
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM listings WHERE owner_id=?")
    .bind(actor.id)
    .first<{ count: number }>();
  const rows = await db
    .prepare(
      "SELECT listings.*,EXISTS(SELECT 1 FROM outbox WHERE listing_id=listings.id AND status='failed') AS failed_sync,(SELECT status FROM orders WHERE listing_id=listings.id ORDER BY created_at DESC LIMIT 1) AS payment_status FROM listings WHERE owner_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(actor.id, SUBMISSIONS_PER_PAGE, (page - 1) * SUBMISSIONS_PER_PAGE)
    .all<ListingRow>();
  return {
    submissions: await getListingDtos(rows.results),
    totalCount: count.count,
  };
}
