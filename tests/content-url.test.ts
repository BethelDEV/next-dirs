import assert from "node:assert/strict";
import { test } from "node:test";
import { safeContentUrl } from "../src/lib/content-url";

test("content URLs reject executable protocols and external embedded images", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,boom",
    "java\nscript:alert(1)",
    "//evil.invalid",
    "https://name:pass@example.invalid",
    "\\evil.invalid",
  ]) {
    assert.equal(safeContentUrl(value), "");
  }
  assert.equal(safeContentUrl("https://tracker.invalid/a.png", true), "");
  assert.equal(
    safeContentUrl("https://cdn.sanity.io/images/local/a.png", true),
    "https://cdn.sanity.io/images/local/a.png",
  );
  assert.equal(safeContentUrl("#features"), "#features");
  assert.equal(safeContentUrl("/item/example"), "/item/example");
});
