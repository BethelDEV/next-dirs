import { llmsPartResponse } from "@/data/llms";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  return llmsPartResponse(request, (await params).section);
}
