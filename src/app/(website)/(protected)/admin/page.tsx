import {
  moderateListing,
  retryPublication,
  setUserRole,
} from "@/actions/moderation";
import { CustomMdx } from "@/components/shared/custom-mdx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getListingDtos } from "@/data/submission";
import type { ListingRow } from "@/db/models";
import { currentUser } from "@/lib/auth";
import { urlForImage } from "@/lib/image";
import { requireActor } from "@/services/listing-actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminPage({
  searchParams,
}: { searchParams: Promise<{ page?: string }> }) {
  if (!(await currentUser())) redirect("/auth/login");
  const { db, actor } = await requireActor();
  if (actor.role === "USER") redirect("/dashboard");
  const page = Math.max(1, Math.floor(Number((await searchParams).page) || 1));
  const deliveries =
    actor.role === "ADMIN"
      ? await db
          .prepare(
            "SELECT id,kind,status,attempts,last_error FROM notifications WHERE status IN ('failed','paused') ORDER BY created_at LIMIT 30",
          )
          .all<{
            id: string;
            kind: string;
            status: string;
            attempts: number;
            last_error: string;
          }>()
      : null;
  const rows = await db
    .prepare(
      "SELECT listings.*,EXISTS(SELECT 1 FROM outbox WHERE listing_id=listings.id AND status='failed') AS failed_sync FROM listings WHERE review_status='pending' OR first_published_at IS NOT NULL ORDER BY updated_at DESC LIMIT 50 OFFSET ?",
    )
    .bind((page - 1) * 50)
    .all<ListingRow>();
  const items = await getListingDtos(rows.results);
  const audits = await db
    .prepare(
      "SELECT id,actor_id,action,before_version,after_version,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 30",
    )
    .all<{
      id: string;
      actor_id: string;
      action: string;
      before_version: number;
      after_version: number;
      created_at: string;
    }>();
  return (
    <div className="space-y-8 py-8">
      <div className="flex justify-between gap-4">
        <h1 className="text-3xl font-bold">Directory management</h1>
        <Link href="/studio">Open CMS</Link>
      </div>
      <p>
        Review first submissions and manage published listings. Edits keep the
        author’s publication choice.
      </p>
      {rows.results.map((row, index) => {
        const item = items[index];
        return (
          <section key={row.id} className="rounded-lg border p-5 space-y-3">
            <h2 className="text-xl font-semibold">{item.name}</h2>
            <p>{item.description}</p>
            <details>
              <summary className="cursor-pointer underline">
                Review full content
              </summary>
              <div className="mt-4 space-y-4">
                <a
                  href={item.link}
                  rel="noreferrer"
                  target="_blank"
                  className="underline break-all"
                >
                  {item.link}
                </a>
                <img
                  src={urlForImage(item.image)?.src}
                  alt={item.name}
                  className="max-w-xl w-full rounded"
                />
                <CustomMdx source={item.introduction} />
                <p className="text-sm break-all">
                  Categories: {item.categories.map((c) => c.name).join(", ")} ·
                  Tags: {item.tags.map((t) => t.name).join(", ")}
                </p>
              </div>
            </details>
            <p className="text-sm">
              Review: {row.review_status} · Sync: {item.syncStatus} ·
              Visibility: {row.admin_hidden ? "Hidden by staff" : "Allowed"}
            </p>
            {row.first_published_at && (
              <Link href={`/edit/${row.id}`} className="underline">
                Edit content
              </Link>
            )}
            <form action={moderateListing} className="flex flex-wrap gap-3">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="version" value={row.desired_version} />
              {!row.first_published_at && row.review_status === "pending" && (
                <>
                  <Input
                    name="reason"
                    placeholder="Reason if rejecting"
                    className="max-w-md"
                  />
                  <Button name="action" value="approve">
                    Approve
                  </Button>
                  <Button name="action" value="reject" variant="outline">
                    Reject
                  </Button>
                </>
              )}
              <Button
                name="action"
                value={row.admin_hidden ? "restore" : "hide"}
                variant="outline"
              >
                {row.admin_hidden ? "Restore visibility" : "Hide listing"}
              </Button>
            </form>
            <form action={retryPublication}>
              <input type="hidden" name="id" value={row.id} />
              <Button variant="outline">Retry failed publication</Button>
            </form>
          </section>
        );
      })}
      <nav className="flex gap-4">
        {page > 1 && <Link href={`/admin?page=${page - 1}`}>Previous</Link>}
        {rows.results.length === 50 && (
          <Link href={`/admin?page=${page + 1}`}>Next</Link>
        )}
      </nav>
      {deliveries && (
        <section>
          <h2 className="text-xl">Delivery failures</h2>
          <ul className="text-sm break-all">
            {deliveries.results.map((row) => (
              <li key={row.id}>
                {row.kind} · {row.status} · Attempts: {row.attempts} ·{" "}
                {row.last_error} · {row.id}
              </li>
            ))}
          </ul>
          <p>
            Paused deliveries require a provider delivery check before retrying.
          </p>
        </section>
      )}
      {actor.role === "ADMIN" && (
        <section className="border rounded-lg p-5 space-y-4">
          <h2 className="text-xl font-semibold">Account access</h2>
          <form
            action={setUserRole}
            className="flex flex-wrap gap-4 items-center"
          >
            <Input
              name="id"
              placeholder="User ID"
              required
              className="max-w-md"
            />
            <select
              name="role"
              aria-label="Role"
              className="rounded border p-2 bg-background"
            >
              <option>USER</option>
              <option>EDITOR</option>
              <option>ADMIN</option>
            </select>
            <label>
              <input name="disabled" type="checkbox" /> Disable account
            </label>
            <Button>Save access</Button>
          </form>
        </section>
      )}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent activity</h2>
        <ul className="space-y-2 break-all text-sm">
          {audits.results.map((log) => (
            <li key={log.id}>
              {log.created_at} · {log.actor_id} · {log.action} ·{" "}
              {log.before_version} → {log.after_version}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
