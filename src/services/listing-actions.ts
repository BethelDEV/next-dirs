import "server-only";
import { getDb } from "@/db";
import { findUser } from "@/db/identity";
import { listingById, transitionListing } from "@/db/listings";
import { DomainError } from "@/db/models";
import { currentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function requireActor() {
  const session = await currentUser();
  if (!session?.id) throw new DomainError("Unauthorized");
  const db = await getDb();
  const actor = await findUser(db, "id", session.id);
  if (!actor || actor.disabled) throw new DomainError("Unauthorized");
  return { db, actor };
}

export async function applyListingAction(
  id: string,
  action: Parameters<typeof transitionListing>[4],
  expected?: number,
  input?: unknown,
) {
  try {
    const { db, actor } = await requireActor();
    const row = await listingById(db, id);
    if (!row) throw new DomainError("Listing not found");
    await transitionListing(
      db,
      actor,
      id,
      expected ?? row.desired_version,
      action,
      input,
    );
    revalidatePath("/dashboard");
    revalidatePath(`/edit/${id}`);
    revalidatePath(`/publish/${id}`);
    return {
      status: "success" as const,
      message: "Saved. Publication changes are syncing.",
    };
  } catch (error) {
    return {
      status: "error" as const,
      message:
        error instanceof DomainError
          ? error.message
          : "Unable to save this change",
    };
  }
}
