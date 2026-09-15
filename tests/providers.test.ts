import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeNotifications, FakePublisher } from "./helpers/providers";

test("local providers model lost responses and idempotent delivery", async () => {
  const publisher = new FakePublisher<{ version: number; visible: boolean }>();
  publisher.failure = "after";
  await assert.rejects(
    publisher.write("listing", { version: 2, visible: false }),
  );
  publisher.failure = undefined;
  await publisher.write("listing", { version: 1, visible: true });
  assert.equal(publisher.documents.get("listing")?.visible, false);
  const mail = new FakeNotifications();
  const message = { to: "owner@example.invalid", subject: "Local test" };
  await mail.send("payment-1", message);
  await mail.send("payment-1", message);
  assert.equal(mail.deliveries.size, 1);
});

test("external fetch fails closed", () => {
  assert.throws(() => fetch("https://example.invalid"), /Network is disabled/);
});
