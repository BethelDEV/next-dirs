import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const require = createRequire(import.meta.url);
require("tsx/cjs");
const {
  findUser,
  createToken,
  consumeToken,
} = require("../src/db/identity.ts");
const { D1AuthAdapter } = require("../src/db/auth-adapter.ts");
const {
  createListing,
  listingById,
  transitionListing,
} = require("../src/db/listings.ts");
const { drainOutbox, projectListing } = require("../src/db/outbox.ts");
const { subscribe, unsubscribe } = require("../src/db/newsletter.ts");
const { drainNotifications } = require("../src/services/notifications.ts");
const { uploadImage } = require("../src/db/uploads.ts");
const { maintainDatabase } = require("../src/db/maintenance.ts");
const { SanityPublisher } = require("../src/services/publisher.ts");
const { recordPayment, recordRefund } = require("../src/db/payments.ts");

// workerd needs loopback HTTP for its binding bridge. Outbound Worker calls fail.
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    cf: false,
    modules: true,
    script: "export default { fetch() { return new Response('local'); } }",
    compatibilityDate: "2026-09-15",
    d1Databases: ["DB"],
    outboundService() {
      throw new Error("External calls are forbidden in local D1 tests");
    },
  }),
);

try {
  const db = await runtime.getD1Database("DB");
  const sql = readFileSync(
    new URL("../migrations/0001_initial.sql", import.meta.url),
    "utf8",
  );
  const statements = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.batch(statements.map((s) => db.prepare(s)));
  assert.equal(
    (await db.prepare("SELECT version FROM schema_migrations").first()).version,
    1,
  );
  await db
    .prepare(
      "INSERT INTO users(id,email) VALUES('owner','owner@example.invalid')",
    )
    .run();
  await assert.rejects(
    db.batch([
      db.prepare(
        "INSERT INTO listings(id,owner_id,slug,content_json) VALUES('one','owner','local','{}')",
      ),
      db.prepare(
        "INSERT INTO outbox(id,listing_id,version) VALUES('bad','missing',1)",
      ),
    ]),
  );
  assert.equal(
    await db.prepare("SELECT id FROM listings WHERE id='one'").first(),
    null,
  );
  console.log(
    "Local workerd D1: initialization, foreign keys and atomic batch rollback passed",
  );

  const adapter = D1AuthAdapter(db);
  const created = await adapter.createUser({
    email: "oauth@example.invalid",
    name: "OAuth",
    emailVerified: new Date(),
    image: null,
  });
  await adapter.linkAccount({
    userId: created.id,
    type: "oauth",
    provider: "github",
    providerAccountId: "local-123",
  });
  assert.equal(
    (
      await adapter.getUserByAccount({
        provider: "github",
        providerAccountId: "local-123",
      })
    ).id,
    created.id,
  );
  await assert.rejects(
    adapter.createUser({ email: "OAUTH@example.invalid", name: "duplicate" }),
  );
  const verification = await createToken(db, "owner@example.invalid", "verify");
  assert.equal(
    (
      await db.prepare("SELECT token_hash FROM verification_tokens").first()
    ).token_hash.includes(verification.token),
    false,
  );
  const consumed = await Promise.all([
    consumeToken(db, verification.token, "verify"),
    consumeToken(db, verification.token, "verify"),
  ]);
  assert.equal(consumed.filter(Boolean).length, 1);
  const reset = await createToken(db, "owner@example.invalid", "reset");
  await consumeToken(db, reset.token, "reset", "local-password-hash");
  assert.equal((await findUser(db, "id", "owner")).session_version, 1);
  const expired = await createToken(db, "owner@example.invalid", "verify");
  await db
    .prepare("UPDATE verification_tokens SET expires_at='2000-01-01'")
    .run();
  assert.equal(await consumeToken(db, expired.token, "verify"), false);
  console.log(
    "D1 identity: OAuth mapping, unique registration, hashed/expired/single-use tokens and session invalidation passed",
  );

  await db
    .prepare(
      "INSERT INTO users(id,email,role) VALUES('editor','editor@example.invalid','EDITOR'),('other','other@example.invalid','USER')",
    )
    .run();
  const owner = await findUser(db, "id", "owner");
  const editor = await findUser(db, "id", "editor");
  const other = await findUser(db, "id", "other");
  const content = {
    name: "Local item",
    link: "https://example.invalid",
    description: "Synthetic",
    introduction: "## Features\n\nContent",
    categories: ["cat-local"],
    tags: ["tag-local"],
    imageId: "image-local-800x600-png",
  };
  await db
    .prepare(
      "INSERT INTO uploads(id,owner_id,status,asset_id,mime_type,size_bytes) VALUES('upload','owner','ready',?,'image/png',100)",
    )
    .bind(content.imageId)
    .run();
  await assert.rejects(
    createListing(db, owner, { ...content, owner_id: "other" }),
  );
  await assert.rejects(createListing(db, other, content));
  const id = await createListing(db, owner, content);
  const slug = (await listingById(db, id)).slug;
  await assert.rejects(transitionListing(db, other, id, 1, "edit", content));
  await assert.rejects(transitionListing(db, editor, id, 1, "edit", content));
  await assert.rejects(transitionListing(db, owner, id, 1, "publish"));
  await transitionListing(db, owner, id, 1, "request-review");
  await transitionListing(db, editor, id, 2, "approve");
  assert.equal((await listingById(db, id)).publish_requested, 0);
  await transitionListing(db, owner, id, 3, "publish");
  const docs = new Map();
  let mode = "before";
  const publisher = {
    async write(doc) {
      if (mode === "before") throw new Error("Sanity unavailable");
      if (!docs.has(doc._id) || docs.get(doc._id).version < doc.version)
        docs.set(doc._id, structuredClone(doc));
      if (mode === "after") throw new Error("Lost response");
    },
  };
  await drainOutbox(db, publisher);
  assert.equal(docs.size, 0);
  assert.equal((await listingById(db, id)).published_version, 0);
  mode = "after";
  await db.prepare("UPDATE outbox SET available_at='2000-01-01'").run();
  await drainOutbox(db, publisher);
  assert.equal(docs.size, 1);
  assert.equal((await listingById(db, id)).published_version, 0);
  mode = "ok";
  await db.prepare("UPDATE outbox SET available_at='2000-01-01'").run();
  await drainOutbox(db, publisher);
  assert.ok((await listingById(db, id)).first_published_at);
  await transitionListing(db, owner, id, 4, "edit", {
    ...content,
    name: "Edited",
  });
  assert.equal((await listingById(db, id)).review_status, "approved");
  assert.equal((await listingById(db, id)).slug, slug);
  await assert.rejects(transitionListing(db, editor, id, 4, "edit", content));
  await transitionListing(db, editor, id, 5, "hide");
  await transitionListing(db, owner, id, 6, "edit", content);
  await assert.rejects(transitionListing(db, owner, id, 7, "publish"));
  await Promise.all([drainOutbox(db, publisher), drainOutbox(db, publisher)]);
  assert.equal(docs.get(`listing.${id}`).visible, false);
  const stale = projectListing(
    { ...(await listingById(db, id)), desired_version: 5, admin_hidden: 0 },
    new Date().toISOString(),
  );
  await publisher.write(stale);
  assert.equal(docs.get(`listing.${id}`).visible, false);
  for (const privateField of [
    "owner_id",
    "password",
    "email",
    "content_json",
    "review_reason",
    "paid_plan",
  ])
    assert.equal(privateField in docs.get(`listing.${id}`), false);
  console.log(
    "D1 listings: author/editor permissions, first review, stable slug, optimistic concurrency, recovery and hidden-state preservation passed",
  );

  const paidId = await createListing(db, owner, {
    ...content,
    name: "Paid item",
  });
  await db
    .prepare(
      "INSERT INTO orders(id,user_id,listing_id,plan,price_id,amount,currency,stripe_session_id) VALUES('order1','owner',?,'pro','price_test',990,'usd','cs_test')",
    )
    .bind(paidId)
    .run();
  const paid = {
    eventId: "event1",
    eventType: "checkout.session.completed",
    orderId: "order1",
    sessionId: "cs_test",
    paymentId: "pi_test",
    amount: 990,
    currency: "usd",
    state: "paid",
  };
  await assert.rejects(recordPayment(db, { ...paid, amount: 1 }));
  await recordPayment(db, { ...paid, state: "processing", paymentId: null });
  assert.equal((await listingById(db, paidId)).paid_plan, null);
  await Promise.all([
    recordPayment(db, { ...paid, eventId: "event2" }),
    recordPayment(db, { ...paid, eventId: "event2" }),
  ]);
  const paidRow = await listingById(db, paidId);
  assert.equal(paidRow.paid_plan, "pro");
  assert.equal(paidRow.publish_requested, 0);
  await recordPayment(db, { ...paid, eventId: "event3", state: "failed" });
  assert.equal(
    (await listingById(db, paidId)).desired_version,
    paidRow.desired_version,
  );
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM notifications WHERE id='payment:order1'",
        )
        .first()
    ).count,
    1,
  );
  await recordRefund(db, {
    eventId: "refund1",
    paymentId: "pi_test",
    refunded: 990,
    currency: "usd",
  });
  assert.equal((await listingById(db, paidId)).paid_plan, null);
  await recordPayment(db, { ...paid, eventId: "event4" });
  assert.equal((await listingById(db, paidId)).paid_plan, null);
  console.log(
    "D1 payment: exact order matching, delayed payment, duplicate/concurrent events, refund and author-first-publication checks passed",
  );
  // Recover an expired lease without allowing the old writer to acknowledge it.
  const recovery = await createListing(db, owner, content);
  await transitionListing(db, owner, recovery, 1, "request-review");
  await db
    .prepare(
      "UPDATE outbox SET status='running',lease_token='expired',lease_until='2000-01-01' WHERE listing_id=?",
    )
    .bind(recovery)
    .run();
  await drainOutbox(db, publisher);
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM outbox WHERE listing_id=?")
        .bind(recovery)
        .first()
    ).status,
    "done",
  );
  const publicAuthor = projectListing(
    { ...paidRow, review_status: "approved", publish_requested: 1 },
    new Date().toISOString(),
    { ...owner, name: "Public name", link: "javascript:alert(1)", image: null },
  );
  assert.deepEqual(publicAuthor.submitter, {
    name: "Public name",
    link: "",
    image: null,
  });

  // The production publisher uses Sanity's revision precondition, not a blind set.
  let stored = null;
  let rev = 0;
  let conflict = true;
  const sanity = {
    async getDocument() {
      return stored ? structuredClone(stored) : undefined;
    },
    async createIfNotExists(value) {
      stored ??= { ...structuredClone(value), _rev: String(++rev) };
    },
    patch() {
      let expected;
      let fields;
      let removed = [];
      return {
        ifRevisionId(value) {
          expected = value;
          return this;
        },
        set(value) {
          fields = value;
          return this;
        },
        unset(value) {
          removed = value;
          return this;
        },
        async commit() {
          if (conflict) {
            conflict = false;
            throw Object.assign(new Error("conflict"), { statusCode: 409 });
          }
          if (stored._rev !== expected)
            throw Object.assign(new Error("revision"), { statusCode: 409 });
          stored = { ...stored, ...fields, _rev: String(++rev) };
          for (const key of removed) delete stored[key];
        },
      };
    },
  };
  const productionPublisher = new SanityPublisher(sanity);
  await productionPublisher.write(publicAuthor);
  await productionPublisher.write({
    _id: publicAuthor._id,
    _type: "item",
    version: publicAuthor.version + 1,
    visible: false,
  });
  await productionPublisher.write(publicAuthor);
  assert.equal(stored.visible, false);
  assert.equal("introduction" in stored, false);
  assert.equal("submitter" in stored, false);

  // Asset intent, failure, per-owner deduplication and recovery are real D1 writes.
  const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  let uploadFails = true;
  const assets = {
    async upload() {
      if (uploadFails) throw Error("offline");
      return {
        _id: "image-second-10x10-png",
        url: "https://cdn.sanity.io/local.png",
      };
    },
  };
  await assert.rejects(uploadImage(db, owner, imageBytes, "image/png", assets));
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS count FROM uploads WHERE status='failed'")
        .first()
    ).count,
    1,
  );
  uploadFails = false;
  await Promise.all([
    uploadImage(db, owner, imageBytes, "image/png", assets),
    uploadImage(db, owner, imageBytes, "image/png", assets),
  ]);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM uploads WHERE asset_id='image-second-10x10-png' AND status='ready'",
        )
        .first()
    ).count,
    1,
  );
  await assert.rejects(
    uploadImage(db, owner, imageBytes, "image/svg+xml", assets),
  );

  // Expired sponsor becomes Pro even without a public page request.
  await db
    .prepare(
      "UPDATE listings SET paid_plan='sponsor',sponsor_started_at='2000-01-01',sponsor_ends_at='2000-02-01' WHERE id=?",
    )
    .bind(paidId)
    .run();
  await maintainDatabase(db);
  assert.equal((await listingById(db, paidId)).paid_plan, "pro");

  const sent = new Map();
  const contacts = new Map();
  let lostResponse = true;
  const mail = {
    async send(value) {
      sent.set(value.id, value);
      if (lostResponse) {
        lostResponse = false;
        throw Error("lost response");
      }
    },
    async contact(email, unsubscribed) {
      contacts.set(email, unsubscribed);
    },
  };
  await subscribe(db, "newsletter@example.invalid");
  const welcome = await db
    .prepare(
      "SELECT payload_json FROM notifications WHERE kind='newsletter-welcome'",
    )
    .first();
  const token = JSON.parse(welcome.payload_json).unsubscribeToken;
  await subscribe(db, "newsletter@example.invalid");
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM notifications WHERE kind='newsletter-welcome'",
        )
        .first()
    ).count,
    1,
  );
  await drainNotifications(
    db,
    mail,
    { siteUrl: "http://localhost", adminEmail: "admin@example.invalid" },
    100,
  );
  await db
    .prepare(
      "UPDATE notifications SET available_at='2000-01-01' WHERE status='failed'",
    )
    .run();
  await drainNotifications(
    db,
    mail,
    { siteUrl: "http://localhost", adminEmail: "admin@example.invalid" },
    100,
  );
  assert.equal(contacts.get("newsletter@example.invalid"), false);
  await unsubscribe(db, "wrong-token");
  assert.equal(
    (await db.prepare("SELECT status FROM newsletter_subscriptions").first())
      .status,
    "subscribed",
  );
  await unsubscribe(db, token);
  await drainNotifications(
    db,
    mail,
    { siteUrl: "http://localhost", adminEmail: "admin@example.invalid" },
    100,
  );
  assert.equal(contacts.get("newsletter@example.invalid"), true);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM notifications WHERE status='sent' AND payload_json!='{}'",
        )
        .first()
    ).count,
    0,
  );
  await db
    .prepare(
      "INSERT INTO notifications(id,kind,payload_json,first_attempt_at) VALUES('old-delivery','payment','{}','2000-01-01')",
    )
    .run();
  await drainNotifications(db, mail, { siteUrl: "http://localhost" }, 1);
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM notifications WHERE id='old-delivery'")
        .first()
    ).status,
    "paused",
  );
  console.log(
    "D1 recovery: expired leases, production CAS/tombstones, author whitelist, upload failure/concurrency, sponsor expiry, newsletter tokens and idempotent notifications passed",
  );
} finally {
  await runtime.dispose();
}
