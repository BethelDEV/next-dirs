import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
require("tsx/cjs");
const { projectListing } = require("../../src/db/outbox.ts");
export const fixturePassword = "Local-fixture-password-123!";
export const privateMarkers = [
  "owner@example.invalid",
  "other@example.invalid",
  "PRIVATE_REVIEW_REASON",
  "PRIVATE_PASSWORD_HASH",
  "PRIVATE_ORDER_ID",
  "PRIVATE_TOKEN_HASH",
];

export async function seedWorkerData(db, documents) {
  const statements = readFileSync("migrations/0001_initial.sql", "utf8")
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.batch(statements.map((s) => db.prepare(s)));
  const password = await bcrypt.hash(fixturePassword, 10);
  const now = new Date().toISOString();
  for (const [id, role] of [
    ["owner", "USER"],
    ["other", "USER"],
    ["editor", "EDITOR"],
    ["admin", "ADMIN"],
  ]) {
    await db
      .prepare(
        "INSERT INTO users(id,email,name,password,emailVerified,role) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        id,
        id.concat("@example.invalid"),
        "Local ".concat(id),
        password,
        now,
        role,
      )
      .run();
  }
  const assetId = "image-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-800x600-png";
  for (const type of ["category", "tag"]) {
    documents.push({
      _id: type.concat("-local"),
      _type: type,
      _createdAt: now,
      _updatedAt: now,
      _rev: "initial",
      name: "Local ".concat(type),
      slug: { current: "local" },
      description: "Synthetic taxonomy",
      priority: 1,
    });
  }
  documents.push({
    _id: "group-local",
    _type: "group",
    name: "Local group",
    slug: { current: "local" },
  });
  documents.push({ _id: assetId, _type: "sanity.imageAsset", metadata: {} });
  const content = {
    name: "Local published listing",
    link: "https://example.invalid",
    description: "Synthetic directory content",
    introduction:
      "## Features\n\nSafe **Markdown**.\n\n| Feature | Value |\n| --- | --- |\n| Local | Yes |\n\n```js\nconst safe = true;\n```\n\n<script>globalThis.pwned = true</script>",
    imageId: assetId,
    iconId: assetId,
    categories: ["category-local"],
    tags: ["tag-local"],
  };
  await db
    .prepare(
      "INSERT INTO uploads(id,owner_id,status,asset_id,mime_type,size_bytes) VALUES('upload','owner','ready',?,'image/png',100)",
    )
    .bind(assetId)
    .run();
  for (const [id, review, published, hidden] of [
    ["published", "approved", true, false],
    ["pending", "pending", false, false],
    ["hidden", "approved", true, true],
    ["paid", "draft", false, false],
  ]) {
    await db
      .prepare(
        "INSERT INTO listings(id,owner_id,slug,content_json,review_status,review_reason,first_published_at,publish_requested,admin_hidden,published_version) VALUES(?,'owner',?,?,?,'PRIVATE_REVIEW_REASON',?,?,?,1)",
      )
      .bind(
        id,
        "local-".concat(id),
        JSON.stringify({ ...content, name: "Local ".concat(id, " listing") }),
        review,
        published ? now : null,
        published ? 1 : 0,
        hidden ? 1 : 0,
      )
      .run();
    const row = await db
      .prepare("SELECT * FROM listings WHERE id=?")
      .bind(id)
      .first();
    documents.push({
      ...projectListing(row, now, {
        name: "Public author",
        image: null,
        link: "",
      }),
      _rev: "initial",
      _createdAt: now,
      _updatedAt: now,
    });
  }
  documents.push({
    _id: "collection-local",
    _type: "collection",
    name: "Local collection",
    slug: { current: "local" },
    description: "Synthetic collection",
    _createdAt: now,
    _updatedAt: now,
    items: [{ _ref: "listing.published" }, { _ref: "listing.hidden" }],
  });
  // Poisoned legacy documents must never appear in public queries, HTML or RSC.
  await db
    .prepare("UPDATE listings SET desired_version=2 WHERE id='published'")
    .run();
  await db
    .prepare(
      "INSERT INTO outbox(id,listing_id,version,status,last_error,available_at) VALUES('failed-publication','published',2,'failed','Publication failed','2099-01-01')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO orders(id,user_id,listing_id,plan,price_id,amount,currency,stripe_session_id) VALUES('local-order','owner','paid','pro','price_local_pro',990,'usd','cs_local')",
    )
    .run();
  documents.push(
    {
      _id: "private-user",
      _type: "user",
      email: privateMarkers[0],
      password: privateMarkers[3],
    },
    { _id: privateMarkers[4], _type: "order" },
    { _id: privateMarkers[5], _type: "verificationToken" },
  );
}
