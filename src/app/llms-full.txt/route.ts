import { llmsResponse } from "@/data/llms";

export const dynamic = "force-dynamic";

export async function GET() {
  return llmsResponse(true);
}
