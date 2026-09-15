export const llmsSections = {
  item: { key: "items", title: "Listings", path: "item/" },
  category: { key: "categories", title: "Categories", path: "category/" },
  tag: { key: "tags", title: "Tags", path: "tag/" },
  collection: { key: "collections", title: "Collections", path: "collection/" },
  blogPost: { key: "blog", title: "Blog posts", path: "blog/" },
  blogCategory: {
    key: "blog-categories",
    title: "Blog categories",
    path: "blog/category/",
  },
  page: { key: "pages", title: "Pages", path: "" },
} as const;

type TextBlock = {
  _type: string;
  style?: string;
  listItem?: string;
  children?: { text?: string; marks?: string[] }[];
  markDefs?: { _key: string; _type: string; href?: string }[];
  code?: string;
  language?: string;
  alt?: string;
};

export type LlmsDocument = {
  _id: string;
  _type: keyof typeof llmsSections;
  slug: string;
  title: string | null;
  description: string | null;
  introduction?: string | null;
  body?: TextBlock[] | null;
};

function inline(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`*_[\]<>]/g, "\\$&");
}

function portableText(blocks: TextBlock[] | null | undefined): string {
  return (blocks ?? [])
    .map((block) => {
      if (block._type === "code") {
        const code = block.code ?? "";
        let fenceLength = 3;
        for (const run of code.match(/`+/g) ?? [])
          fenceLength = Math.max(fenceLength, run.length + 1);
        const fence = "`".repeat(fenceLength);
        return `${fence}${(block.language ?? "").replace(/[^a-zA-Z0-9+-]/g, "")}\n${code}\n${fence}`;
      }
      if (block._type === "image")
        return block.alt ? `Image: ${inline(block.alt)}` : "";
      if (block._type !== "block") return "";
      const text = (block.children ?? [])
        .map((span) => {
          let value = inline(span.text ?? "");
          // Preserve spaces between adjacent Portable Text spans.
          if (/^\s/.test(span.text ?? "")) value = ` ${value}`;
          if (/\s$/.test(span.text ?? "")) value += " ";
          for (const mark of span.marks ?? []) {
            if (mark === "strong") value = `**${value}**`;
            if (mark === "em") value = `*${value}*`;
            const link = block.markDefs?.find(
              (entry) => entry._key === mark && entry._type === "link",
            );
            if (link?.href && /^https?:\/\//i.test(link.href)) {
              try {
                value = `[${value}](<${new URL(link.href).href.replace(/>/g, "%3E")}>)`;
              } catch {
                /* Keep the readable label for malformed URLs. */
              }
            }
          }
          return value;
        })
        .join("");
      const prefix =
        block.listItem === "bullet"
          ? "- "
          : block.listItem === "number"
            ? "1. "
            : block.style === "blockquote"
              ? "> "
              : /^h[1-6]$/.test(block.style ?? "")
                ? `${"#".repeat(Number(block.style?.slice(1)))} `
                : "";
      return prefix + text;
    })
    .filter(Boolean)
    .join("\n\n");
}

export type LlmsType = keyof typeof llmsSections;
export type LlmsSite = { name: string; description: string; url: string };
export const LLMS_INDEX_PAGE_SIZE = 50;
export const LLMS_FULL_PAGE_SIZE = 10;
export const LLMS_PAGE_BYTES = 128 * 1024;
const FOOTER_RESERVE = 4096;
const encoder = new TextEncoder();
const hasBody = (type: LlmsType) => ["item", "blogPost", "page"].includes(type);

export function llmsUrl(site: LlmsSite, path: string) {
  const base = new URL(site.url);
  if (!/^https?:$/.test(base.protocol) || base.username || base.password)
    throw new Error("Invalid site URL");
  base.pathname = `${base.pathname.replace(/\/$/, "")}/`;
  base.search = "";
  base.hash = "";
  return new URL(path, base).href;
}

export function llmsDocumentPath(
  doc: Pick<LlmsDocument, "_type" | "slug">,
  markdown = false,
) {
  const slug = encodeURIComponent(doc.slug)
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  return `${llmsSections[doc._type].path}${slug}${markdown && hasBody(doc._type) ? "/index.md" : ""}`;
}

export function llmsSectionPath(type: LlmsType, full: boolean, after = "") {
  return `llms/${llmsSections[type].key}${full ? "-full" : ""}.txt${after ? `?after=${encodeURIComponent(after)}` : ""}`;
}

export function parseLlmsSection(section: string) {
  for (const type of Object.keys(llmsSections) as LlmsType[]) {
    for (const full of [false, true]) {
      if (section === `${llmsSections[type].key}${full ? "-full" : ""}.txt`)
        return { type, full };
    }
  }
  return null;
}

export function renderLlms(site: LlmsSite, full = false, blog = false) {
  const url = (path: string) => llmsUrl(site, path);
  const types: LlmsType[] = blog
    ? ["blogPost", "blogCategory"]
    : (Object.keys(llmsSections) as LlmsType[]);
  const lines = [
    `# ${inline(site.name)}${blog ? " — Blog" : ""}`,
    `> ${inline(site.description)}`,
    full
      ? "Full content is split into linked parts. Follow each section and its Next part links to read all public content. Oversized articles link to their complete individual Markdown file."
      : "Browse the section indexes, then follow individual Markdown links to read the content you need. Follow Next part links for further entries.",
    "## Content sections",
    ...types.map(
      (type) =>
        `- [${llmsSections[type].title}](${url(llmsSectionPath(type, full))}): ${full ? "Full content parts" : "Summaries and links"}.`,
    ),
    "## Site",
    `- [Home](${url("")}): Browse the directory.`,
    `- [Search](${url("search")}): Search public listings.`,
    `- [Blog](${url("blog")}): Read public blog posts.`,
    `- [Blog content index](${url("blog/llms.txt")})`,
    "## Optional",
    `- [${full ? "Content index" : "Full content parts"}](${url(`${blog ? "blog/" : ""}${full ? "llms.txt" : "llms-full.txt"}`)})`,
    `- [Sitemap](${url("sitemap.xml")}): Public page URLs.`,
  ];
  return `${lines.join("\n\n")}\n`;
}

export function renderLlmsDocument(site: LlmsSite, doc: LlmsDocument) {
  const canonical = llmsUrl(site, llmsDocumentPath(doc));
  const lines = [
    `# ${inline(doc.title || doc.slug)}`,
    `Source: [Canonical page](${canonical})`,
  ];
  if (doc.description) lines.push(inline(doc.description));
  const body = doc._type === "item" ? doc.introduction : portableText(doc.body);
  if (body?.trim()) lines.push(body.trim());
  return `${lines.join("\n\n")}\n`;
}

function summary(site: LlmsSite, doc: LlmsDocument) {
  const label = inline((doc.title || doc.slug).slice(0, 160));
  const description = inline((doc.description ?? "").slice(0, 280));
  return `- [${label}](${llmsUrl(site, llmsDocumentPath(doc, true))})${description ? `: ${description}` : ""}`;
}

// Fetch one metadata page, then load at most one article at a time.
export async function renderLlmsPart(
  site: LlmsSite,
  type: LlmsType,
  full: boolean,
  documents: LlmsDocument[],
  loadDocument: (id: string) => Promise<LlmsDocument | null>,
) {
  const limit = full ? LLMS_FULL_PAGE_SIZE : LLMS_INDEX_PAGE_SIZE;
  const lines = [
    `# ${inline(site.name)} — ${llmsSections[type].title}`,
    full
      ? "Full content part. Follow Next part to continue; individual Markdown links contain complete articles."
      : "Content index. Follow Markdown links for complete articles and Next part for more entries.",
  ];
  let bytes = encoder.encode(lines.join("\n\n")).byteLength;
  let consumed = 0;
  let lastId = "";
  for (const metadata of documents.slice(0, limit)) {
    let entry = summary(site, metadata);
    if (full && hasBody(type)) {
      const doc = await loadDocument(metadata._id);
      // Visibility can change between index and body reads.
      if (!doc) {
        consumed++;
        lastId = metadata._id;
        continue;
      }
      entry = renderLlmsDocument(site, doc);
      if (encoder.encode(entry).byteLength > LLMS_PAGE_BYTES - FOOTER_RESERVE) {
        entry = `${summary(site, doc)}\n\nThis article exceeds the part size budget. Read the complete Markdown at the link above.`;
      }
    }
    const size = encoder.encode(entry).byteLength + 2;
    if (bytes + size > LLMS_PAGE_BYTES - FOOTER_RESERVE) {
      // Retry this entry on the next part without skipping its ID.
      if (consumed) break;
      entry = `${summary(site, metadata)}\n\nRead the complete article at its individual link.`;
    }
    lines.push(entry);
    bytes += encoder.encode(entry).byteLength + 2;
    consumed++;
    lastId = metadata._id;
  }
  const next =
    consumed < documents.length && lastId
      ? llmsUrl(site, llmsSectionPath(type, full, lastId))
      : null;
  if (!documents.length) lines.push("No public entries in this part.");
  if (next) lines.push(`## Continue\n\n- [Next part](${next})`);
  lines.push(
    `- [Content sections](${llmsUrl(site, full ? "llms-full.txt" : "llms.txt")})`,
  );
  return { text: `${lines.join("\n\n")}\n`, next };
}
