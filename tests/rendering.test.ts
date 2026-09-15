import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Stripe from "stripe";
import { CustomMdx } from "../src/components/shared/custom-mdx";
import { renderMarkdownPreview } from "../src/components/shared/markdown-preview";
import { boundedBody } from "../src/lib/bounded-body";
import { publicWebsiteUrl } from "../src/lib/public-url";

test("Markdown preserves typography and treats executable content as inert data", () => {
  const source =
    '# Features\n\n**Bold** and [link](https://example.com)\n\n<script>globalThis.compromised=true</script>\n\n<Widget onClick={alert(1)} />\n\nimport x from "node:fs"\n\n[unsafe](javascript:alert%281%29)\n\n![track](https://tracker.example/pixel)\n\n```js\nalert(1)\n```';
  const html = renderToStaticMarkup(createElement(CustomMdx, { source }));
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<h1[^>]*>Features/);
  assert.match(html, /<pre/);
  assert.doesNotMatch(
    html,
    /<script|<Widget|onClick=|javascript:|https:\/\/tracker|node="/i,
  );
  assert.equal(
    (globalThis as { compromised?: boolean }).compromised,
    undefined,
  );
});
test("editor preview rejects active HTML and external images before DOM insertion", () => {
  const html = renderMarkdownPreview(
    '**Safe**\n\n<img src=x onerror="globalThis.compromised=true">\n\n<svg onload="alert(1)"></svg>\n\n[unsafe](javascript:alert%281%29)\n\n![tracking](https://tracker.example/pixel)',
  );
  assert.match(html, /<strong>Safe<\/strong>/);
  assert.doesNotMatch(
    html,
    /<img|<svg|onerror|onload|javascript:|tracker\.example/i,
  );
});

test("Public fetch inputs and bounded bodies reject private targets and oversize streams", async () => {
  for (const value of [
    "http://example.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://169.254.169.254",
    "https://u:p@example.com",
    "https://internal",
    "https://x.local",
    "https://example.com:8443",
  ])
    assert.throws(() => publicWebsiteUrl(value));
  assert.equal(
    publicWebsiteUrl("https://example.com/path").hostname,
    "example.com",
  );
  await assert.rejects(boundedBody(new Response("12345"), 4));
  assert.equal(
    new TextDecoder().decode(await boundedBody(new Response("ok"), 4)),
    "ok",
  );
});
test("Stripe Web Crypto signature verification rejects tampering without network calls", async () => {
  const stripe = new Stripe("sk_test_synthetic");
  const secret = "whsec_synthetic";
  const payload = JSON.stringify({
    id: "evt_local",
    type: "checkout.session.completed",
    data: { object: { id: "cs_local" } },
  });
  const header = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
  });
  const event = await stripe.webhooks.constructEventAsync(
    payload,
    header,
    secret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
  assert.equal(event.id, "evt_local");
  await assert.rejects(
    stripe.webhooks.constructEventAsync(
      `${payload} `,
      header,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    ),
  );
});
