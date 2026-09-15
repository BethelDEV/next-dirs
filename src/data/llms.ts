import "server-only";
import { siteConfig } from "@/config/site";
import {
  type LlmsDocument,
  type LlmsType,
  llmsDocumentPath,
  llmsUrl,
  parseLlmsSection,
  renderLlms,
  renderLlmsDocument,
  renderLlmsPart,
} from "@/lib/llms";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  llmsDocumentByIdQuery,
  llmsDocumentQuery,
  llmsQuery,
} from "@/sanity/lib/llms-query";

function textResponse(
  text: string,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
function unavailable() {
  return textResponse("Public content is temporarily unavailable.\n", 503, {
    "Retry-After": "60",
  });
}
export async function llmsResponse(full = false, blog = false) {
  try {
    // Root manifests require no catalog scan.
    return textResponse(renderLlms(siteConfig, full, blog));
  } catch {
    return unavailable();
  }
}
export async function llmsPartResponse(request: Request, section: string) {
  const parsed = parseLlmsSection(section);
  if (!parsed) return textResponse("Not found.\n", 404);
  const after = new URL(request.url).searchParams.get("after") ?? "";
  if (after && !/^[a-zA-Z0-9_.-]{1,128}$/.test(after))
    return textResponse("Invalid cursor.\n", 400);
  const { type, full } = parsed;
  try {
    const documents = await sanityFetch<LlmsDocument[]>({
      query: llmsQuery(full),
      params: { type, after },
      perspective: "published",
    });
    const part = await renderLlmsPart(siteConfig, type, full, documents, (id) =>
      sanityFetch<LlmsDocument | null>({
        query: llmsDocumentByIdQuery,
        params: { type, id },
        perspective: "published",
      }),
    );
    return textResponse(
      part.text,
      200,
      part.next ? { Link: `<${part.next}>; rel="next"` } : {},
    );
  } catch {
    return unavailable();
  }
}
export async function llmsDocumentResponse(type: LlmsType, slug: string) {
  try {
    const doc = await sanityFetch<LlmsDocument | null>({
      query: llmsDocumentQuery,
      params: { type, slug },
      perspective: "published",
    });
    if (!doc) return textResponse("Not found.\n", 404);
    const canonical = llmsUrl(siteConfig, llmsDocumentPath(doc));
    const index = llmsUrl(
      siteConfig,
      type === "blogPost" ? "blog/llms.txt" : "llms.txt",
    );
    return textResponse(renderLlmsDocument(siteConfig, doc), 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${canonical}>; rel="canonical", <${index}>; rel="describedby"`,
    });
  } catch {
    return unavailable();
  }
}
