import { limitAction } from "./identity";
import { DomainError, type UserRow } from "./models";
export interface AssetUploader {
  upload(
    bytes: Uint8Array,
    mime: string,
    filename: string,
  ): Promise<{ _id: string; url: string }>;
}

export async function uploadImage(
  db: D1Database,
  actor: UserRow,
  bytes: Uint8Array,
  mime: string,
  uploader: AssetUploader,
) {
  const png =
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (
    actor.disabled ||
    bytes.length === 0 ||
    bytes.length > 5 * 1024 * 1024 ||
    !((mime === "image/png" && png) || (mime === "image/jpeg" && jpeg))
  )
    throw new DomainError("Upload a PNG or JPEG image under 5 MB");
  if (!(await limitAction(db, `upload:${actor.id}`, 30, 3600)))
    throw new DomainError("Upload limit reached. Try later.");
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO uploads(id,owner_id,status,mime_type,size_bytes) VALUES(?,?,'pending',?,?)",
    )
    .bind(id, actor.id, mime, bytes.length)
    .run();
  try {
    const asset = await uploader.upload(
      bytes,
      mime,
      `${id}.${png ? "png" : "jpg"}`,
    );
    // Equal bytes share a public asset. Ownership records stay per user and the
    // conditional batch also handles two concurrent uploads of the same bytes.
    await db.batch([
      db
        .prepare(
          "UPDATE uploads SET status='ready',asset_id=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM uploads WHERE owner_id=? AND asset_id=?)",
        )
        .bind(asset._id, id, actor.id, asset._id),
      db
        .prepare(
          "UPDATE uploads SET status='abandoned' WHERE id=? AND status='pending'",
        )
        .bind(id),
    ]);
    return { _id: asset._id, url: asset.url };
  } catch {
    await db
      .prepare(
        "UPDATE uploads SET status='failed' WHERE id=? AND status='pending'",
      )
      .bind(id)
      .run();
    throw new DomainError("Image upload failed. Please retry.");
  }
}
