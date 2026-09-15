export type Role = "USER" | "EDITOR" | "ADMIN";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: string | null;
  image: string | null;
  password: string | null;
  link: string;
  role: Role;
  disabled: number;
  session_version: number;
  stripe_customer_id: string | null;
}

export interface ListingContent {
  name: string;
  link: string;
  description: string;
  introduction: string;
  imageId: string;
  iconId?: string;
  categories: string[];
  tags: string[];
}

export interface ListingRow {
  failed_sync?: number;
  payment_status?: string;
  id: string;
  owner_id: string;
  slug: string;
  content_json: string;
  review_status: "draft" | "pending" | "approved" | "rejected";
  review_reason: string | null;
  publish_requested: number;
  admin_hidden: number;
  first_published_at: string | null;
  desired_version: number;
  published_version: number;
  paid_plan: "pro" | "sponsor" | null;
  sponsor_started_at: string | null;
  sponsor_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export class DomainError extends Error {}

export function canPublish(row: ListingRow) {
  return Boolean(
    row.first_published_at || row.review_status === "approved" || row.paid_plan,
  );
}

export function isVisible(row: ListingRow) {
  return Boolean(row.publish_requested && !row.admin_hidden && canPublish(row));
}

export function canEdit(
  actor: Pick<UserRow, "id" | "role" | "disabled">,
  row: ListingRow,
) {
  return (
    !actor.disabled &&
    (row.owner_id === actor.id ||
      (actor.role !== "USER" && Boolean(row.first_published_at)))
  );
}
