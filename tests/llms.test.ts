import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  LLMS_INDEX_PAGE_SIZE,
  LLMS_PAGE_BYTES,
  type LlmsDocument,
  renderLlms,
  renderLlmsDocument,
  renderLlmsPart,
} from "../src/lib/llms";
import {
  llmsDocumentByIdQuery,
  llmsDocumentQuery,
  llmsQuery,
} from "../src/sanity/lib/llms-query";

const require = createRequire(import.meta.url);
const { parse, evaluate } = createRequire(
  require.resolve("sanity/package.json"),
)("groq-js");
const site = {
  name: "目录",
  description: "Public directory",
  url: "https://example.com/",
};

test("LLMs queries exclude nonpublic documents and project only public fields", async () => {
  const item = {
    _id: "listing-public",
    _type: "item",
    slug: { current: "public" },
    name: "Public listing",
    description: "Summary",
    introduction: "## Full introduction",
    visible: true,
    publishDate: "2026-09-15",
    owner: "PRIVATE_OWNER",
    email: "PRIVATE_EMAIL",
  };
  const dataset = [
    item,
    { ...item, _id: "hidden", visible: false },
    { ...item, _id: "pending", publishDate: null },
    { ...item, _id: "drafts.public" },
    { ...item, _id: "versions.release.public" },
    { ...item, _id: "no-slug", slug: null },
    { ...item, _id: "user", _type: "user" },
    { ...item, _id: "unpublished-blog", _type: "blogPost", publishDate: null },
    {
      _id: "page",
      _type: "page",
      title: "About",
      slug: { current: "about" },
      body: [
        {
          _type: "block",
          children: [{ text: "Public body", privateNote: "PRIVATE_NOTE" }],
        },
      ],
      privateNote: "PRIVATE_NOTE",
    },
  ];
  for (const type of ["item", "page"]) {
    const expectedId = type === "item" ? "listing-public" : "page";
    const result = await (
      await evaluate(parse(llmsQuery(false)), {
        dataset,
        params: { after: "", type },
      })
    ).get();
    assert.deepEqual(
      result.map((doc: LlmsDocument) => doc._id),
      [expectedId],
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /PRIVATE_|Full introduction|Public body/,
    );
    const doc = await (
      await evaluate(parse(llmsDocumentQuery), {
        dataset,
        params: { type, slug: type === "item" ? "public" : "about" },
      })
    ).get();
    assert.doesNotMatch(JSON.stringify(doc), /PRIVATE_/);
    const text = renderLlmsDocument(site, doc);
    assert.ok(
      text.includes(type === "item" ? "Full introduction" : "Public body"),
    );
  }
  for (const id of [
    "hidden",
    "pending",
    "drafts.public",
    "versions.release.public",
    "unpublished-blog",
  ]) {
    const type = id === "unpublished-blog" ? "blogPost" : "item";
    assert.equal(
      await (
        await evaluate(parse(llmsDocumentByIdQuery), {
          dataset,
          params: { type, id },
        })
      ).get(),
      null,
    );
  }
});

test("LLMs keyset indexes cover all entries through bounded continuation pages", async () => {
  const dataset = Array.from({ length: 205 }, (_, index) => ({
    _id: `category-${String(index).padStart(3, "0")}`,
    _type: "category",
    name: `Category ${index}`,
    slug: { current: `category-${index}` },
  }));
  let after = "";
  const ids: string[] = [];
  let pages = 0;
  do {
    const docs = await (
      await evaluate(parse(llmsQuery(false)), {
        dataset,
        params: { type: "category", after },
      })
    ).get();
    assert.ok(docs.length <= LLMS_INDEX_PAGE_SIZE + 1);
    const part = await renderLlmsPart(
      site,
      "category",
      false,
      docs,
      async () => {
        throw new Error("Indexes must not load bodies");
      },
    );
    ids.push(
      ...docs
        .slice(0, LLMS_INDEX_PAGE_SIZE)
        .map((doc: LlmsDocument) => doc._id),
    );
    assert.ok(Buffer.byteLength(part.text) <= LLMS_PAGE_BYTES);
    after = part.next
      ? (new URL(part.next).searchParams.get("after") ?? "")
      : "";
    assert.ok(++pages < 10);
  } while (after);
  assert.equal(ids.length, 205);
  assert.equal(new Set(ids).size, 205);
});

test("LLMs exports escape index labels and preserve CMS text, links and code", () => {
  const documents: LlmsDocument[] = [
    {
      _id: "post",
      _type: "blogPost",
      slug: "你好(test)",
      title: "A [title]\nInjected",
      description: "First\nSecond",
      body: [
        { _type: "block", style: "h2", children: [{ text: "Heading" }] },
        {
          _type: "block",
          listItem: "bullet",
          children: [
            { text: "Read ", marks: [] },
            { text: "docs", marks: ["url"] },
          ],
          markDefs: [
            { _key: "url", _type: "link", href: "https://example.org/docs" },
          ],
        },
        { _type: "code", language: "js", code: "const fence = '```';" },
        { _type: "image", alt: "Diagram" },
      ],
    },
  ];
  const text = renderLlmsDocument(site, documents[0]);
  assert.match(text, /^# A/);
  assert.ok(text.includes("A \\[title\\] Injected"));
  assert.ok(text.includes("/blog/%E4%BD%A0%E5%A5%BD%28test%29"));
  assert.ok(text.includes("## Heading"));
  assert.ok(text.includes("- Read [docs](<https://example.org/docs>)"));
  assert.ok(text.includes("````js\nconst fence = '```';\n````"));
  assert.ok(text.includes("Image: Diagram"));
  assert.doesNotMatch(text, /\/auth\/|\/admin|\/dashboard|\/studio|undefined/);
  assert.match(renderLlms(site), /llms-full\.txt/);
  assert.throws(() => renderLlms({ ...site, url: "invalid" }));
});

test("full blog parts honor UTF-8 bytes, retain continuations and link oversized articles", async () => {
  const docs: LlmsDocument[] = Array.from({ length: 13 }, (_, i) => ({
    _id: `post-${String(i).padStart(2, "0")}`,
    _type: "blogPost",
    slug: `post-${i}`,
    title: `Post ${i}`,
    description: "Summary",
    body: [
      {
        _type: "block",
        children: [
          {
            text: `START-${i} ${"正文".repeat(i === 0 ? 40000 : 12000)} END-${i}`,
          },
        ],
      },
    ],
  }));
  let after = "";
  const outputs: string[] = [];
  let count = 0;
  do {
    const batch = docs.filter((doc) => doc._id > after).slice(0, 11);
    let loads = 0;
    const result = await renderLlmsPart(
      site,
      "blogPost",
      true,
      batch,
      async (id) => {
        loads++;
        return docs.find((doc) => doc._id === id) ?? null;
      },
    );
    assert.ok(loads <= 10);
    assert.ok(Buffer.byteLength(result.text) <= LLMS_PAGE_BYTES);
    outputs.push(result.text);
    after = result.next
      ? (new URL(result.next).searchParams.get("after") ?? "")
      : "";
    assert.ok(++count < 20);
  } while (after);
  const all = outputs.join("\n");
  assert.match(all, /blog\/post-0\/index.md/);
  assert.match(all, /exceeds the part size budget/);
  assert.ok(renderLlmsDocument(site, docs[0]).includes("END-0"));
  for (let i = 1; i < docs.length; i++) {
    assert.equal(all.split(`START-${i} `).length - 1, 1);
    assert.ok(all.includes(`END-${i}`));
  }
});

test("count-limited full parts and a concurrently hidden entry preserve progress", async () => {
  const docs: LlmsDocument[] = Array.from({ length: 11 }, (_, i) => ({
    _id: `id-${i}`,
    _type: "item",
    slug: `item-${i}`,
    title: `Title ${i}`,
    description: "",
    introduction: `Body ${i}`,
  }));
  const result = await renderLlmsPart(site, "item", true, docs, async (id) =>
    id === "id-0" ? null : (docs.find((doc) => doc._id === id) ?? null),
  );
  assert.doesNotMatch(result.text, /Title 0|Body 10/);
  assert.equal(
    new URL(result.next ?? "https://invalid.test").searchParams.get("after"),
    "id-9",
  );
  const empty = await renderLlmsPart(site, "item", false, [], async () => null);
  assert.equal(empty.next, null);
  assert.match(empty.text, /No public entries/);
});

test("root and blog manifests remain small and identify their full-content parts", () => {
  for (const full of [false, true]) {
    const root = renderLlms(site, full);
    const blog = renderLlms(site, full, true);
    assert.ok(Buffer.byteLength(root) < 4096);
    assert.ok(Buffer.byteLength(blog) < 4096);
    assert.ok(blog.includes(full ? "llms/blog-full.txt" : "llms/blog.txt"));
    assert.doesNotMatch(blog, /llms\/items/);
  }
});
