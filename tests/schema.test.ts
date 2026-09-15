import assert from "node:assert/strict";
import { test } from "node:test";
import { createDatabase } from "./helpers/sqlite";

test("empty initialization records a version and enforces identity constraints", () => {
  const db = createDatabase();
  try {
    assert.equal(
      db.prepare("SELECT version FROM schema_migrations").get()?.version,
      1,
    );
    assert.throws(
      () =>
        db
          .prepare("INSERT INTO users(id,email) VALUES(?,?)")
          .run("duplicate", "OWNER@example.invalid"),
      /UNIQUE/,
    );
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO accounts(id,userId,type,provider,providerAccountId) VALUES('bad','missing','oauth','github','1')",
          )
          .run(),
      /FOREIGN KEY/,
    );
    assert.throws(
      () => db.prepare("UPDATE users SET role='SUPERUSER'").run(),
      /CHECK/,
    );
  } finally {
    db.close();
  }
});

test("slug, outbox and active checkout constraints protect concurrent operations", () => {
  const db = createDatabase();
  try {
    db.exec(
      "INSERT INTO listings(id,owner_id,slug,content_json) VALUES('one','user-owner','stable','{}')",
    );
    assert.throws(
      () =>
        db.exec(
          "INSERT INTO listings(id,owner_id,slug,content_json) VALUES('two','user-owner','stable','{}')",
        ),
      /UNIQUE/,
    );
    db.exec("INSERT INTO outbox(id,listing_id,version) VALUES('job1','one',1)");
    assert.throws(
      () =>
        db.exec(
          "INSERT INTO outbox(id,listing_id,version) VALUES('job2','one',1)",
        ),
      /UNIQUE/,
    );
    const order = db.prepare(
      "INSERT INTO orders(id,user_id,listing_id,plan,price_id,amount,currency) VALUES(?,'user-owner','one','pro','price_local',9900,'usd')",
    );
    order.run("order1");
    assert.throws(() => order.run("order2"), /UNIQUE/);
    db.exec("UPDATE orders SET status='expired' WHERE id='order1'");
    order.run("order2");
  } finally {
    db.close();
  }
});
