"use server";
import { applyListingAction, requireActor } from "@/services/listing-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function moderateListing(form: FormData) {
  const action = z
    .enum(["approve", "reject", "hide", "restore"])
    .parse(form.get("action"));
  const id = z.string().min(1).parse(form.get("id"));
  const version = z.coerce.number().int().positive().parse(form.get("version"));
  const result = await applyListingAction(
    id,
    action,
    version,
    form.get("reason"),
  );
  if (result.status === "error") throw new Error(result.message);
  revalidatePath("/admin");
}

export async function retryPublication(form: FormData) {
  const { db, actor } = await requireActor();
  const id = z.string().min(1).parse(form.get("id"));
  const row = await db
    .prepare("SELECT owner_id FROM listings WHERE id=?")
    .bind(id)
    .first<{ owner_id: string }>();
  if (!row || (actor.role === "USER" && row.owner_id !== actor.id))
    throw new Error("Forbidden");
  await db
    .prepare(
      "UPDATE outbox SET status='pending',available_at=? WHERE listing_id=? AND status='failed'",
    )
    .bind(new Date().toISOString(), id)
    .run();
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function setUserRole(form: FormData) {
  const { db, actor } = await requireActor();
  if (actor.role !== "ADMIN") throw new Error("Forbidden");
  const id = z.string().min(1).parse(form.get("id"));
  const role = z.enum(["USER", "EDITOR", "ADMIN"]).parse(form.get("role"));
  const disabled = form.get("disabled") === "on" ? 1 : 0;
  await db.batch([
    db
      .prepare(
        "UPDATE users SET role=?,disabled=?,session_version=session_version+1 WHERE id=? AND (role!='ADMIN' OR (?='ADMIN' AND ?=0) OR (SELECT COUNT(*) FROM users WHERE role='ADMIN' AND disabled=0)>1)",
      )
      .bind(role, disabled, id, role, disabled),
    db
      .prepare(
        "INSERT INTO audit_logs(id,actor_id,action) SELECT ?,?,? WHERE changes()=1",
      )
      .bind(
        crypto.randomUUID(),
        actor.id,
        `user:${id}:role:${role}:disabled:${disabled}`,
      ),
  ]);
  revalidatePath("/admin");
}
