import "server-only";
import type { UserRow } from "@/db/models";
import { uploadImage as storeImage } from "@/db/uploads";
import { publishingClient } from "@/sanity/lib/publish-client";
export async function uploadImage(
  db: D1Database,
  actor: UserRow,
  bytes: Uint8Array,
  mime: string,
) {
  return storeImage(db, actor, bytes, mime, {
    upload: (data, type, filename) =>
      publishingClient().assets.upload("image", Buffer.from(data), {
        contentType: type,
        filename,
      }),
  });
}
