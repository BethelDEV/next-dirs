import assert from "node:assert/strict";

export async function llmsSmoke(runtime, documents, faults) {
  const generated = Array.from({ length: 55 }, (_, i) => ({
    _id: `llms-post-${String(i).padStart(2, "0")}`,
    _type: "blogPost",
    title: `LLMs article ${i}`,
    slug: { current: `llms-article-${i}` },
    publishDate: "2026-09-15",
    excerpt: "Public blog summary",
    body: [
      {
        _type: "block",
        children: [
          {
            _type: "span",
            text: `${i === 0 ? "正文".repeat(30000) : "Article body"} END-${i}`,
            privateNote: "PRIVATE_BLOG_NOTE",
          },
        ],
      },
    ],
    owner: "PRIVATE_BLOG_OWNER",
  }));
  generated.push(
    {
      ...generated[0],
      _id: "llms-unpublished",
      slug: { current: "llms-unpublished" },
      publishDate: null,
    },
    {
      ...generated[0],
      _id: "drafts.llms-draft",
      slug: { current: "llms-draft" },
    },
    {
      _id: "llms-page",
      _type: "page",
      title: "LLMs CMS page",
      slug: { current: "llms-page" },
      body: [{ _type: "block", children: [{ text: "Public CMS body" }] }],
    },
  );
  documents.push(...generated);
  const request = async (path, status = 200) => {
    const response = await runtime.dispatchFetch(
      new URL(path, "http://localhost:8787"),
    );
    assert.equal(response.status, status, path);
    assert.match(
      response.headers.get("cache-control"),
      /(?:^|,\s*)no-store(?:,|$)/,
      path,
    );
    const body = await response.text();
    assert.doesNotMatch(
      body,
      /PRIVATE_|Local hidden listing|Local pending listing/,
    );
    return { response, body };
  };
  try {
    for (const path of ["/blog/llms.txt", "/blog/llms-full.txt"]) {
      const { body } = await request(path);
      assert.match(body, /llms\/blog/);
      assert.ok(Buffer.byteLength(body) < 4096);
      assert.ok(!body.includes("LLMs article"));
    }
    const index = await request("/llms/blog.txt");
    assert.match(index.body, /blog\/llms-article-0\/index.md/);
    assert.ok(!index.body.includes("Article body"));
    assert.match(index.response.headers.get("link"), /rel="next"/);
    const nextIndex = index.response.headers.get("link").match(/<([^>]+)>/)[1];
    const lastIndex = await request(nextIndex);
    assert.match(lastIndex.body, /LLMs article 54/);
    assert.equal(lastIndex.response.headers.get("link"), null);

    let next = "/llms/blog-full.txt";
    let parts = 0;
    const texts = [];
    while (next) {
      const { response, body } = await request(next);
      assert.ok(Buffer.byteLength(body) <= 128 * 1024);
      texts.push(body);
      next = response.headers.get("link")?.match(/<([^>]+)>/)?.[1];
      assert.ok(++parts < 10);
    }
    const full = texts.join("\n");
    assert.match(full, /exceeds the part size budget/);
    for (let i = 1; i < 55; i++) assert.ok(full.includes(`END-${i}`));
    const article = await request("/blog/llms-article-0/index.md");
    assert.match(
      article.response.headers.get("content-type"),
      /text\/markdown/,
    );
    assert.match(
      article.response.headers.get("link"),
      /blog\/llms.txt.*describedby/,
    );
    assert.ok(article.body.includes("END-0"));
    assert.ok(Buffer.byteLength(article.body) > 128 * 1024);
    assert.match(
      (await request("/llms-page/index.md")).body,
      /Public CMS body/,
    );
    assert.match(
      (await request("/llms/pages-full.txt")).body,
      /Public CMS body/,
    );
    assert.match(
      (await request("/item/local-published/index.md")).body,
      /Safe \*\*Markdown\*\*/,
    );
    assert.match(
      (await request("/llms/items-full.txt")).body,
      /Safe \*\*Markdown\*\*/,
    );
    for (const path of [
      "/item/local-hidden/index.md",
      "/item/local-pending/index.md",
      "/blog/llms-unpublished/index.md",
      "/blog/llms-draft/index.md",
      "/missing-page/index.md",
      "/llms/unknown.txt",
    ])
      await request(path, 404);
    await request("/llms/blog.txt?after=invalid%20cursor", 400);

    const listing = documents.find((doc) => doc._id === "listing-published");
    listing.visible = false;
    generated[1].publishDate = null;
    try {
      await request("/item/local-published/index.md", 404);
      await request("/blog/llms-article-1/index.md", 404);
      assert.ok(
        !(await request("/llms/items.txt")).body.includes(
          "Local published listing",
        ),
      );
      assert.ok(
        !(await request("/llms/items-full.txt")).body.includes(
          "Local published listing",
        ),
      );
      assert.ok(
        !(await request("/llms/blog.txt")).body.includes(
          "llms-article-1/index.md",
        ),
      );
    } finally {
      listing.visible = true;
    }
    faults.sanityReads = true;
    try {
      await request("/llms.txt");
      await request("/blog/llms-full.txt");
      const failed = await request("/llms/blog-full.txt", 503);
      assert.equal(failed.response.headers.get("retry-after"), "60");
      await request("/blog/llms-article-0/index.md", 503);
    } finally {
      faults.sanityReads = false;
    }
    console.log(
      "Worker LLMs: manifests, paginated indexes/full parts, long blog, Markdown and visibility passed",
    );
  } finally {
    const ids = new Set(generated.map((doc) => doc._id));
    for (let i = documents.length - 1; i >= 0; i--)
      if (ids.has(documents[i]._id)) documents.splice(i, 1);
  }
}
