import { llmsDocumentResponse } from "@/data/llms";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return llmsDocumentResponse("page", (await params).slug);
}
