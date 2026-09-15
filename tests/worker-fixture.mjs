import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { parse as parseEnv } from "dotenv";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import Stripe from "stripe";
import ts from "typescript";
import { aiHttpResponse } from "./helpers/ai-http.mjs";
import { sanityMutationResponse } from "./helpers/sanity-http.mjs";
import { stripeHttpProvider } from "./helpers/stripe-http.mjs";
import { privateMarkers, seedWorkerData } from "./helpers/worker-data.mjs";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("wrangler"))("esbuild");
const { parse, evaluate } = createRequire(
  require.resolve("sanity/package.json"),
)("groq-js");

export async function startWorkerFixture() {
  assert.ok(
    existsSync(".open-next/worker.js"),
    "Build first: node scripts/local-build.mjs --worker",
  );
  const outfile = path.resolve(".open-next/local-worker.mjs");
  const nativeModules = new Map();
  await build({
    entryPoints: ["worker.ts"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    conditions: ["workerd", "worker", "browser"],
    minify: true,
    external: ["cloudflare:*", "node:*"],
    banner: {
      js: 'import { createRequire } from "node:module"; import nodeProcess from "node:process"; const nativeRequire = createRequire("file:///worker.js"); const require = (id) => id === "node:process" || id === "process" ? nodeProcess : nativeRequire(id);',
    },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "native-modules",
        setup(builder) {
          builder.onResolve({ filter: /\.(wasm|bin)(\?module)?$/ }, (args) => {
            const filename = path.resolve(
              args.resolveDir,
              args.path.replace(/\?module$/, ""),
            );
            nativeModules.set(filename, {
              path: filename,
              type: filename.endsWith(".wasm") ? "CompiledWasm" : "Data",
            });
            return {
              path: "./".concat(path.relative(path.dirname(outfile), filename)),
              external: true,
            };
          });
        },
      },
    ],
  });
  console.log(
    "Worker bundle bytes/gzip:",
    readFileSync(outfile).length,
    gzipSync(readFileSync(outfile)).length,
  );
  // Read only checked-in synthetic values; never load .env or .dev.vars.
  const bindings = {
    ...parseEnv(readFileSync(".dev.vars.example")),
    DEFAULT_AI_PROVIDER: "openai",
    AI_MODEL: "local-fixture-model",
    OPENAI_API_KEY: "local-placeholder",
  };
  const { config, error } = ts.parseConfigFileTextToJson(
    "wrangler.jsonc",
    readFileSync("wrangler.jsonc", "utf8"),
  );
  assert.equal(error, undefined);
  assert.ok(config.d1_databases.every((binding) => binding.remote === false));
  const documents = [];
  const stripeProvider = stripeHttpProvider();
  const unexpectedOutbound = [];
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      name: config.name,
      cf: false,
      unsafeTriggerHandlers: true,
      host: "127.0.0.1",
      port: 8787,
      compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags,
      modulesRoot: path.dirname(outfile),
      // Miniflare 5 requires explicit native modules; v4 module rules cannot convert.
      modules: [{ path: outfile, type: "ESModule" }, ...nativeModules.values()],
      bindings,
      d1Databases: config.d1_databases.map((binding) => binding.binding),
      assets: { ...config.assets, routerConfig: { has_user_worker: true } },
      async outboundService(request) {
        const url = new URL(request.url);
        const aiResponse = await aiHttpResponse(request);
        if (aiResponse) return aiResponse;
        const stripeResponse = await stripeProvider(request);
        if (stripeResponse) return stripeResponse;
        const mutation = await sanityMutationResponse(request, documents);
        if (mutation) return mutation;
        if (
          url.hostname === "localtest.api.sanity.io" &&
          url.pathname.endsWith("/data/query/local")
        ) {
          const body = request.method === "POST" ? await request.json() : {};
          const query = body.query ?? url.searchParams.get("query");
          const params =
            body.params ??
            Object.fromEntries(
              [...url.searchParams]
                .filter(([key]) => key.startsWith("$"))
                .map(([key, value]) => [key.slice(1), JSON.parse(value)]),
            );
          const result = await (
            await evaluate(parse(query, { params }), {
              dataset: documents,
              params,
            })
          ).get();
          return Response.json({ result, ms: 1, query });
        }
        // Unhandled requests fail closed; no real providers are contacted.
        unexpectedOutbound.push(
          [request.method, url.hostname, url.pathname].join(" "),
        );
        return new Response("Unexpected fixture request", { status: 503 });
      },
    }),
  );
  try {
    const db = await runtime.getD1Database("DB");
    await seedWorkerData(db, documents);
    return { runtime, db, documents, unexpectedOutbound };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}

async function smoke({ runtime, db, unexpectedOutbound }) {
  const stripe = new Stripe("sk_test_local_placeholder");
  const paymentEvent = JSON.stringify({
    id: "evt_local_paid",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_local",
        metadata: { orderId: "local-order" },
        payment_intent: "pi_local",
        payment_status: "paid",
        amount_total: 990,
        currency: "usd",
      },
    },
  });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload: paymentEvent,
    secret: "local-placeholder",
  });
  const postPayment = (body) =>
    runtime.dispatchFetch("http://localhost:8787/api/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body,
    });
  assert.equal((await postPayment(paymentEvent.concat(" "))).status, 400);
  assert.equal((await postPayment(paymentEvent)).status, 200);
  assert.equal((await postPayment(paymentEvent)).status, 200);
  const paid = await db
    .prepare("SELECT paid_plan,publish_requested FROM listings WHERE id='paid'")
    .first();
  assert.deepEqual(paid, { paid_plan: "pro", publish_requested: 0 });
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS count FROM payment_events").first())
      .count,
    1,
  );
  for (const route of [
    "/",
    "/auth/login",
    "/auth/register",
    "/studio",
    "/search",
    "/category/local",
    "/tag/local",
    "/collection/local",
    "/item/local-published",
    "/sitemap.xml",
    "/robots.txt",
  ]) {
    const response = await runtime.dispatchFetch(
      new URL(route, "http://localhost:8787"),
    );
    const body = await response.text();
    assert.equal(response.status, 200, route.concat(": ", body.slice(0, 300)));
    for (const marker of privateMarkers)
      assert.ok(!body.includes(marker), route.concat(" leaked ", marker));
    assert.ok(!body.includes("Local hidden listing"), route);
    assert.ok(!body.includes("Local pending listing"), route);
    if (route === "/item/local-published")
      assert.match(body, /Local published listing/);
    console.log("Worker route passed:", route);
  }
  for (const [route, hasPublished] of [
    ["/search?q=published", true],
    ["/search?q=not-in-this-directory", false],
    ["/search?category=local&tag=local", true],
    ["/search?page=2", false],
    ["/category/local", true],
    ["/tag/local", true],
    ["/collection/local", true],
  ]) {
    const response = await runtime.dispatchFetch(
      new URL(route, "http://localhost:8787"),
    );
    const body = await response.text();
    assert.equal(response.status, 200, route);
    assert.equal(body.includes("Local published listing"), hasPublished, route);
    assert.ok(!body.includes("Local hidden listing"), route);
    assert.ok(!body.includes("Local pending listing"), route);
  }
  for (const route of ["/item/local-hidden", "/item/local-pending"]) {
    const response = await runtime.dispatchFetch(
      new URL(route, "http://localhost:8787"),
    );
    const body = await response.text();
    assert.ok(
      response.status === 404 || body.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
    );
    assert.ok(!body.includes("Synthetic directory content"));
  }
  const privateRoute = await runtime.dispatchFetch(
    "http://localhost:8787/dashboard",
    { redirect: "manual" },
  );
  assert.equal(privateRoute.status, 307);
  assert.match(privateRoute.headers.get("location"), /\/auth\/login/);
  const rsc = await runtime.dispatchFetch(
    "http://localhost:8787/item/local-published",
    { headers: { RSC: "1" } },
  );
  assert.match(rsc.headers.get("content-type"), /text\/x-component/);
  const payload = await rsc.text();
  for (const marker of privateMarkers) assert.ok(!payload.includes(marker));
  const og = await runtime.dispatchFetch(
    "http://localhost:8787/api/og?title=Local&type=Directory",
  );
  assert.equal(og.status, 200);
  assert.match(og.headers.get("content-type"), /image\/png/);
  assert.ok((await og.arrayBuffer()).byteLength > 1000);
  await db
    .prepare(
      "INSERT INTO uploads(id,owner_id,status,mime_type,size_bytes,created_at) VALUES('expired-upload','owner','pending','image/png',100,'2000-01-01')",
    )
    .run();
  const scheduled = await runtime.dispatchFetch(
    "http://localhost:8787/cdn-cgi/local/scheduled?format=json",
  );
  assert.equal(scheduled.status, 200, await scheduled.text());
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM uploads WHERE id='expired-upload'")
        .first()
    ).status,
    "abandoned",
  );
  assert.deepEqual(unexpectedOutbound, []);
  console.log(
    "Worker visibility, private route, RSC privacy and OG checks passed",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const fixture = await startWorkerFixture();
  try {
    await smoke(fixture);
    if (process.argv.includes("--serve")) {
      console.log("Local Worker fixture ready: http://localhost:8787");
      await new Promise((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
      assert.deepEqual(fixture.unexpectedOutbound, []);
    }
  } finally {
    await fixture.runtime.dispose();
  }
}
